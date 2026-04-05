/*---------------------------------------------------------------------------------------------
 *  Copyright (c) MARC27. All rights reserved.
 *  Licensed under the MARC27 Source-Available License.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IAuthenticationService, IAuthenticationProvider, AuthenticationSession, AuthenticationSessionsChangeEvent, IAuthenticationProviderSessionOptions } from '../../../services/authentication/common/authentication.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

const MARC27_PROVIDER_ID = 'marc27';
const MARC27_PROVIDER_LABEL = 'MARC27';

/**
 * MARC27 authentication provider that reads credentials from the PRISM CLI's
 * cli-state.json file. No separate auth flow — uses whatever `prism login`
 * already stored.
 *
 * On macOS: ~/Library/Application Support/com.marc27.prism/cli-state.json
 * On Linux: ~/.config/prism/cli-state.json
 */
export class Marc27AuthenticationProvider extends Disposable implements IAuthenticationProvider {

	readonly id = MARC27_PROVIDER_ID;
	readonly label = MARC27_PROVIDER_LABEL;
	readonly supportsMultipleAccounts = false;

	private readonly _onDidChangeSessions = this._register(new Emitter<AuthenticationSessionsChangeEvent>());
	readonly onDidChangeSessions: Event<AuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

	constructor(
		@IAuthenticationService private readonly _authenticationService: IAuthenticationService,
		@IFileService private readonly _fileService: IFileService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ILogService private readonly _logService: ILogService,
		@ICommandService private readonly _commandService: ICommandService,
	) {
		super();

		// Register as auth provider
		this._authenticationService.registerDeclaredAuthenticationProvider({
			id: MARC27_PROVIDER_ID,
			label: MARC27_PROVIDER_LABEL,
		});
		this._authenticationService.registerAuthenticationProvider(MARC27_PROVIDER_ID, this);

		this._register({
			dispose: () => {
				this._authenticationService.unregisterAuthenticationProvider(MARC27_PROVIDER_ID);
			}
		});

		this._logService.info('[MARC27 Auth] Provider registered — reads from PRISM CLI cli-state.json');
	}

	async getSessions(_scopes?: string[], _options?: IAuthenticationProviderSessionOptions): Promise<readonly AuthenticationSession[]> {
		try {
			const creds = await this._readCliState();
			if (!creds) {
				return [];
			}

			// Check if token is expired
			if (creds.expires_at) {
				const expiry = new Date(creds.expires_at).getTime();
				if (expiry < Date.now()) {
					this._logService.info('[MARC27 Auth] Token expired — user should run prism login');
					return [];
				}
			}

			return [{
				id: creds.user_id || generateUuid(),
				accessToken: creds.access_token,
				account: {
					label: creds.display_name || 'MARC27 User',
					id: creds.user_id || 'unknown',
				},
				scopes: ['read', 'write', 'marketplace', 'mesh', 'billing'],
			}];
		} catch (err) {
			this._logService.warn(`[MARC27 Auth] Failed to read cli-state.json: ${err}`);
			return [];
		}
	}

	async createSession(_scopes: string[], _options?: IAuthenticationProviderSessionOptions): Promise<AuthenticationSession> {
		// First, check if already logged in via CLI
		try {
			const existing = await this._readCliState();
			if (existing && existing.access_token) {
				const session: AuthenticationSession = {
					id: existing.user_id || generateUuid(),
					accessToken: existing.access_token,
					account: {
						label: existing.display_name || 'MARC27 User',
						id: existing.user_id || 'unknown',
					},
					scopes: ['read', 'write', 'marketplace', 'mesh', 'billing'],
				};
				this._onDidChangeSessions.fire({ added: [session], removed: undefined, changed: undefined });
				return session;
			}
		} catch {
			// Fall through to terminal login
		}

		// Not logged in — open terminal with prism login
		this._notificationService.notify({
			severity: Severity.Info,
			message: 'Run `prism login` in the terminal to sign in to MARC27.',
			sticky: false,
		});

		// Open a terminal with prism login
		try {
			await this._commandService.executeCommand('workbench.action.terminal.new');
			// Small delay to let terminal initialize, then send the command
			await new Promise(resolve => globalThis.setTimeout(resolve, 500));
			await this._commandService.executeCommand('workbench.action.terminal.sendSequence', {
				text: 'prism login\n'
			});
		} catch {
			// Terminal might not be available — that's OK
		}

		// Wait for the user to complete login by polling cli-state.json
		const maxWait = 300_000; // 5 minutes
		const pollInterval = 2_000; // 2 seconds
		const start = Date.now();

		while (Date.now() - start < maxWait) {
			await new Promise(resolve => globalThis.setTimeout(resolve, pollInterval));

			const creds = await this._readCliState();
			if (creds && creds.access_token) {
				// Check it's a fresh token (not the one that was there before)
				const session: AuthenticationSession = {
					id: creds.user_id || generateUuid(),
					accessToken: creds.access_token,
					account: {
						label: creds.display_name || 'MARC27 User',
						id: creds.user_id || 'unknown',
					},
					scopes: ['read', 'write', 'marketplace', 'mesh', 'billing'],
				};

				this._onDidChangeSessions.fire({ added: [session], removed: undefined, changed: undefined });
				this._logService.info(`[MARC27 Auth] Session loaded for ${creds.display_name}`);
				return session;
			}
		}

		throw new Error('Login timed out — run `prism login` in the terminal and try again.');
	}

	async removeSession(_sessionId: string): Promise<void> {
		this._notificationService.notify({
			severity: Severity.Info,
			message: 'Run `prism logout` in the terminal to sign out of MARC27.',
			sticky: false,
		});
	}

	// ── Read PRISM CLI credentials ──────────────────────────────────────

	private async _readCliState(): Promise<CliStateCredentials | null> {
		const possiblePaths = this._getCliStatePaths();

		for (const filePath of possiblePaths) {
			try {
				const uri = URI.file(filePath);
				const content = await this._fileService.readFile(uri);
				const json = JSON.parse(content.value.toString());

				if (json.credentials && json.credentials.access_token) {
					this._logService.info(`[MARC27 Auth] Found credentials at ${filePath}`);
					return json.credentials;
				}
			} catch {
				continue;
			}
		}

		this._logService.info('[MARC27 Auth] No cli-state.json found');
		return null;
	}

	private _getCliStatePaths(): string[] {
		const home = this._getHomeDir();
		const paths: string[] = [];

		if (process.platform === 'darwin') {
			paths.push(`${home}/Library/Application Support/com.marc27.prism/cli-state.json`);
		} else if (process.platform === 'win32') {
			const appData = process.env['APPDATA'] || `${home}/AppData/Roaming`;
			paths.push(`${appData}/com.marc27.prism/cli-state.json`);
		} else {
			// Linux / other
			const configHome = process.env['XDG_CONFIG_HOME'] || `${home}/.config`;
			paths.push(`${configHome}/prism/cli-state.json`);
		}

		// Fallback: check ~/.prism/ too
		paths.push(`${home}/.prism/cli-state.json`);

		return paths;
	}

	private _getHomeDir(): string {
		return process.env['HOME'] || process.env['USERPROFILE'] || '/tmp';
	}
}

interface CliStateCredentials {
	access_token: string;
	refresh_token: string;
	platform_url: string;
	user_id?: string;
	display_name?: string;
	org_id?: string;
	org_name?: string;
	project_id?: string;
	project_name?: string;
	expires_at?: string;
}
