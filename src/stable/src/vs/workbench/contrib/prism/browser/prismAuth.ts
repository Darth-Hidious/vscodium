/*---------------------------------------------------------------------------------------------
 *  Copyright (c) MARC27. All rights reserved.
 *  Licensed under the MARC27 Source-Available License.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { IAuthenticationService, IAuthenticationProvider, AuthenticationSession, AuthenticationSessionsChangeEvent, AuthenticationSessionAccount, IAuthenticationProviderSessionOptions } from '../../../services/authentication/common/authentication.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ILogService } from '../../../../platform/log/common/log.js';

const MARC27_PROVIDER_ID = 'marc27';
const MARC27_PROVIDER_LABEL = 'MARC27';
const MARC27_SECRET_KEY = 'marc27.sessions';
const MARC27_CLIENT_ID = 'prism-cli';
const MARC27_DEFAULT_SCOPES = 'read write marketplace mesh billing';
const MARC27_DEFAULT_PLATFORM_URL = 'https://api.marc27.com/api/v1';

/** Polling interval (seconds) for device-flow token requests. */
const DEFAULT_POLL_INTERVAL = 5;

/** Maximum time (ms) to wait for user to complete device-flow authorization. */
const DEVICE_CODE_TIMEOUT_MS = 300_000; // 5 minutes

interface Marc27DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
}

interface Marc27TokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
}

interface Marc27TokenErrorResponse {
	error: string;
}

interface Marc27UserInfo {
	username: string;
	email: string;
	org: { name: string };
}

interface StoredSessionData {
	id: string;
	accessToken: string;
	refreshToken: string;
	account: AuthenticationSessionAccount;
	scopes: string[];
}

export class Marc27AuthenticationProvider extends Disposable implements IAuthenticationProvider {

	readonly id = MARC27_PROVIDER_ID;
	readonly label = MARC27_PROVIDER_LABEL;
	readonly supportsMultipleAccounts = false;

	private readonly _onDidChangeSessions = this._register(new Emitter<AuthenticationSessionsChangeEvent>());
	readonly onDidChangeSessions: Event<AuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

	private _sessionsPromise: Promise<AuthenticationSession[]>;

	constructor(
		@IAuthenticationService private readonly _authenticationService: IAuthenticationService,
		@ISecretStorageService private readonly _secretStorageService: ISecretStorageService,
		@IOpenerService private readonly _openerService: IOpenerService,
		@INotificationService private readonly _notificationService: INotificationService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();

		this._sessionsPromise = this._readSessions();

		// Register ourselves as both a declared and active authentication provider.
		this._authenticationService.registerDeclaredAuthenticationProvider({
			id: MARC27_PROVIDER_ID,
			label: MARC27_PROVIDER_LABEL,
		});
		this._authenticationService.registerAuthenticationProvider(MARC27_PROVIDER_ID, this);

		// React to secret storage changes (e.g. another window signed in).
		this._register(this._secretStorageService.onDidChangeSecret(key => {
			if (key === MARC27_SECRET_KEY) {
				this._handleSecretChange();
			}
		}));

		this._register({
			dispose: () => {
				this._authenticationService.unregisterAuthenticationProvider(MARC27_PROVIDER_ID);
			}
		});

		this._logService.info('[MARC27 Auth] Provider registered');
	}

	// ── IAuthenticationProvider ───────────────────────────────────────────

	async getSessions(scopes: string[] | undefined, _options: IAuthenticationProviderSessionOptions): Promise<readonly AuthenticationSession[]> {
		const sessions = await this._sessionsPromise;
		if (!scopes || scopes.length === 0) {
			return sessions;
		}
		const requested = new Set(scopes);
		return sessions.filter(s => s.scopes.every(scope => requested.has(scope)));
	}

	async createSession(scopes: string[], _options: IAuthenticationProviderSessionOptions): Promise<AuthenticationSession> {
		this._logService.info('[MARC27 Auth] Creating session...');

		const platformUrl = MARC27_DEFAULT_PLATFORM_URL;
		const scopeString = scopes.length > 0 ? scopes.join(' ') : MARC27_DEFAULT_SCOPES;

		// Step 1: Request device code
		const deviceResponse = await this._requestDeviceCode(platformUrl, scopeString);

		// Step 2: Show user code and open browser
		this._notificationService.notify({
			severity: Severity.Info,
			message: `MARC27: Enter code **${deviceResponse.user_code}** at ${deviceResponse.verification_uri}`,
			sticky: true,
		});

		this._openerService.open(URI.parse(deviceResponse.verification_uri));

		// Step 3: Poll for token
		const tokenResponse = await this._pollForToken(
			platformUrl,
			deviceResponse.device_code,
			deviceResponse.interval || DEFAULT_POLL_INTERVAL,
			deviceResponse.expires_in,
		);

		// Step 4: Get user info
		const userInfo = await this._getUserInfo(platformUrl, tokenResponse.access_token);

		const session: AuthenticationSession = {
			id: generateUuid(),
			accessToken: tokenResponse.access_token,
			account: {
				label: userInfo.username,
				id: userInfo.email,
			},
			scopes: scopeString.split(' '),
		};

		// Step 5: Persist
		const sessions = await this._sessionsPromise;
		sessions.push(session);
		await this._storeSessions(sessions, tokenResponse.refresh_token, session.id);

		this._onDidChangeSessions.fire({ added: [session], removed: undefined, changed: undefined });

		this._logService.info(`[MARC27 Auth] Session created for ${userInfo.username}`);
		return session;
	}

	async removeSession(sessionId: string): Promise<void> {
		this._logService.info(`[MARC27 Auth] Removing session ${sessionId}`);

		const sessions = await this._sessionsPromise;
		const index = sessions.findIndex(s => s.id === sessionId);
		if (index === -1) {
			this._logService.warn(`[MARC27 Auth] Session ${sessionId} not found`);
			return;
		}

		const [removed] = sessions.splice(index, 1);
		await this._storeSessionsRaw(sessions);
		this._sessionsPromise = Promise.resolve(sessions);

		this._onDidChangeSessions.fire({ added: undefined, removed: [removed], changed: undefined });
	}

	// ── Device-flow OAuth ────────────────────────────────────────────────

	private async _requestDeviceCode(platformUrl: string, scope: string): Promise<Marc27DeviceCodeResponse> {
		let response: Response;
		try {
			response = await fetch(`${platformUrl}/auth/device/start`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					client_id: MARC27_CLIENT_ID,
				}),
			});
		} catch (err) {
			throw new Error(`Cannot reach MARC27 platform at ${platformUrl}. Check your connection or configure prism.auth.platformUrl in settings.`);
		}

		const contentType = response.headers.get('content-type') || '';
		if (!contentType.includes('application/json')) {
			throw new Error(`MARC27 platform at ${platformUrl} returned HTML instead of JSON. The OAuth endpoint may not be deployed yet. Contact your administrator.`);
		}

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`MARC27 device code request failed (${response.status}): ${text}`);
		}

		return response.json() as Promise<Marc27DeviceCodeResponse>;
	}

	private async _pollForToken(
		platformUrl: string,
		deviceCode: string,
		intervalSeconds: number,
		expiresInSeconds: number,
	): Promise<Marc27TokenResponse> {
		const deadline = Date.now() + Math.min(expiresInSeconds * 1000, DEVICE_CODE_TIMEOUT_MS);
		const interval = Math.max(intervalSeconds, 1) * 1000;
		const cts = new CancellationTokenSource();

		this._register(cts);

		while (Date.now() < deadline) {
			if (cts.token.isCancellationRequested) {
				throw new Error('MARC27 authentication cancelled');
			}

			await new Promise(resolve => setTimeout(resolve, interval));

			const response = await fetch(`${platformUrl}/auth/device/poll`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					device_code: deviceCode,
				}),
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(`MARC27 token request failed (${response.status}): ${text}`);
			}

			const body = await response.json() as Marc27TokenResponse | Marc27TokenErrorResponse;

			if ('error' in body) {
				if (body.error === 'authorization_pending') {
					continue;
				}
				if (body.error === 'slow_down') {
					// Back off by adding 5 seconds per RFC 8628
					await new Promise(resolve => setTimeout(resolve, 5000));
					continue;
				}
				throw new Error(`MARC27 token error: ${body.error}`);
			}

			return body;
		}

		throw new Error('MARC27 device code expired — authentication timed out');
	}

	private async _getUserInfo(platformUrl: string, accessToken: string): Promise<Marc27UserInfo> {
		const response = await fetch(`${platformUrl}/api/v1/me`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`MARC27 user info request failed (${response.status}): ${text}`);
		}

		return response.json() as Promise<Marc27UserInfo>;
	}

	// ── Secret storage ───────────────────────────────────────────────────

	private async _readSessions(): Promise<AuthenticationSession[]> {
		try {
			const raw = await this._secretStorageService.get(MARC27_SECRET_KEY);
			if (!raw) {
				return [];
			}

			const stored: StoredSessionData[] = JSON.parse(raw);
			return stored.map(s => ({
				id: s.id,
				accessToken: s.accessToken,
				account: s.account,
				scopes: s.scopes,
			}));
		} catch (e) {
			this._logService.error(`[MARC27 Auth] Failed to read sessions: ${e}`);
			return [];
		}
	}

	private async _storeSessions(
		sessions: AuthenticationSession[],
		refreshToken: string,
		sessionId: string,
	): Promise<void> {
		// Read existing stored data to preserve refresh tokens for other sessions
		let existingStored: StoredSessionData[] = [];
		try {
			const raw = await this._secretStorageService.get(MARC27_SECRET_KEY);
			if (raw) {
				existingStored = JSON.parse(raw);
			}
		} catch { /* empty */ }

		const storedData: StoredSessionData[] = sessions.map(s => {
			const existing = existingStored.find(e => e.id === s.id);
			return {
				id: s.id,
				accessToken: s.accessToken,
				refreshToken: s.id === sessionId ? refreshToken : (existing?.refreshToken ?? ''),
				account: s.account,
				scopes: [...s.scopes],
			};
		});

		await this._secretStorageService.set(MARC27_SECRET_KEY, JSON.stringify(storedData));
		this._sessionsPromise = Promise.resolve(sessions);
	}

	private async _storeSessionsRaw(sessions: AuthenticationSession[]): Promise<void> {
		// Preserve refresh tokens from existing storage when just removing a session
		let existingStored: StoredSessionData[] = [];
		try {
			const raw = await this._secretStorageService.get(MARC27_SECRET_KEY);
			if (raw) {
				existingStored = JSON.parse(raw);
			}
		} catch { /* empty */ }

		const storedData: StoredSessionData[] = sessions.map(s => {
			const existing = existingStored.find(e => e.id === s.id);
			return {
				id: s.id,
				accessToken: s.accessToken,
				refreshToken: existing?.refreshToken ?? '',
				account: s.account,
				scopes: [...s.scopes],
			};
		});

		await this._secretStorageService.set(MARC27_SECRET_KEY, JSON.stringify(storedData));
	}

	private async _handleSecretChange(): Promise<void> {
		const previousSessions = await this._sessionsPromise;
		this._sessionsPromise = this._readSessions();
		const currentSessions = await this._sessionsPromise;

		const added = currentSessions.filter(c => !previousSessions.some(p => p.id === c.id));
		const removed = previousSessions.filter(p => !currentSessions.some(c => c.id === p.id));

		if (added.length || removed.length) {
			this._onDidChangeSessions.fire({
				added: added.length ? added : undefined,
				removed: removed.length ? removed : undefined,
				changed: undefined,
			});
		}
	}
}
