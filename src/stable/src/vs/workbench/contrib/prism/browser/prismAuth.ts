/*---------------------------------------------------------------------------------------------
 *  Copyright (c) MARC27. All rights reserved.
 *  Licensed under the MARC27 Source-Available License.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IStatusbarService, StatusbarAlignment, IStatusbarEntry } from '../../../services/statusbar/browser/statusbar.js';

/**
 * Reads PRISM CLI credentials from cli-state.json and shows the
 * logged-in user in the status bar. Does NOT use VS Code's auth
 * provider system — just reads what `prism login` already wrote.
 */
export class Marc27AuthenticationProvider extends Disposable {

	constructor(
		@IStatusbarService private readonly _statusbarService: IStatusbarService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._checkAuth();
	}

	private async _checkAuth(): Promise<void> {
		try {
			const creds = await this._readCliState();

			if (creds && creds.display_name) {
				this._logService.info(`[MARC27] Logged in as ${creds.display_name}`);

				const entry: IStatusbarEntry = {
					name: 'MARC27 Account',
					text: `$(account) ${creds.display_name}`,
					tooltip: `Signed in as ${creds.display_name}\nOrg: ${creds.org_name || 'Personal'}\nProject: ${creds.project_name || 'None'}`,
					ariaLabel: `MARC27: ${creds.display_name}`,
				};

				this._statusbarService.addEntry(entry, 'prism.auth.status', StatusbarAlignment.RIGHT, 1000);
			} else {
				this._logService.info('[MARC27] Not logged in');

				const entry: IStatusbarEntry = {
					name: 'MARC27 Sign In',
					text: '$(sign-in) Sign in to MARC27',
					tooltip: 'Run "prism login" in the terminal to sign in',
					ariaLabel: 'Sign in to MARC27',
					command: 'workbench.action.terminal.new',
				};

				this._statusbarService.addEntry(entry, 'prism.auth.login', StatusbarAlignment.RIGHT, 1000);
			}
		} catch (err) {
			this._logService.warn(`[MARC27] Auth check failed: ${String(err)}`);
		}
	}

	private async _readCliState(): Promise<CliStateCredentials | null> {
		const paths = this._getCliStatePaths();

		for (const filePath of paths) {
			try {
				const resp = await fetch(`vscode-file://vscode-app${filePath}`);
				if (resp.ok) {
					const text = await resp.text();
					const json = JSON.parse(text);
					if (json.credentials?.access_token) {
						return json.credentials;
					}
				}
			} catch {
				continue;
			}
		}

		return null;
	}

	private _getCliStatePaths(): string[] {
		const home = (typeof process !== 'undefined' && process.env)
			? (process.env['HOME'] || process.env['USERPROFILE'] || '')
			: '';
		if (!home) { return []; }

		return [
			`${home}/Library/Application Support/com.marc27.prism/cli-state.json`,
			`${home}/.config/prism/cli-state.json`,
			`${home}/.prism/cli-state.json`,
		];
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
