import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  email: string;
  org?: string;
  expiresAt: number;
}

interface CliState {
  credentials?: {
    access_token: string;
    refresh_token: string;
    platform_url: string;
    user_id?: string;
    display_name?: string;
    org_id?: string;
    org_name?: string;
    expires_at?: string;
  };
}

/**
 * Reads PRISM CLI credentials from cli-state.json.
 * Users authenticate once via `prism login` — this extension just reads
 * that state. No separate OAuth flow, no duplicate credentials.
 */
export class AuthService {
  private session: AuthSession | null = null;

  private readonly _onSessionChange = new vscode.EventEmitter<AuthSession | null>();
  readonly onSessionChange = this._onSessionChange.event;

  constructor() {
    this.refresh();
  }

  getSession(): AuthSession | null {
    return this.session;
  }

  async refresh(): Promise<void> {
    const prev = this.session;
    this.session = await this._readCliState();
    if (prev?.accessToken !== this.session?.accessToken) {
      this._onSessionChange.fire(this.session);
    }
  }

  async login(): Promise<void> {
    const action = await vscode.window.showInformationMessage(
      'Sign in to MARC27 via the PRISM CLI.',
      { detail: 'This will open a terminal. Run `prism login` and follow the prompts.' },
      'Open Terminal',
    );
    if (action === 'Open Terminal') {
      const terminal = vscode.window.createTerminal('PRISM Login');
      terminal.show();
      terminal.sendText('prism login');
      const poll = setInterval(async () => {
        await this.refresh();
        if (this.session) {
          clearInterval(poll);
          vscode.window.showInformationMessage(`Signed in as ${this.session.username}`);
        }
      }, 3000);
      setTimeout(() => clearInterval(poll), 300000);
    }
  }

  async logout(): Promise<void> {
    const terminal = vscode.window.createTerminal('PRISM Logout');
    terminal.show();
    terminal.sendText('prism logout');
    this.session = null;
    this._onSessionChange.fire(null);
  }

  private async _readCliState(): Promise<AuthSession | null> {
    const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
    if (!home) { return null; }

    const paths = [
      path.join(home, 'Library', 'Application Support', 'com.marc27.prism', 'cli-state.json'),
      path.join(home, '.config', 'prism', 'cli-state.json'),
      path.join(home, '.prism', 'cli-state.json'),
    ];

    for (const p of paths) {
      try {
        const content = fs.readFileSync(p, 'utf-8');
        const state: CliState = JSON.parse(content);
        if (state.credentials?.access_token) {
          const creds = state.credentials;
          return {
            accessToken: creds.access_token,
            refreshToken: creds.refresh_token,
            username: creds.display_name || 'User',
            email: '',
            org: creds.org_name,
            expiresAt: creds.expires_at ? new Date(creds.expires_at).getTime() : Date.now() + 86400000,
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  dispose(): void {
    this._onSessionChange.dispose();
  }
}
