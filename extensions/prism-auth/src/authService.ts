import * as vscode from 'vscode';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  email: string;
  org?: string;
  expiresAt: number;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface UserInfoResponse {
  username?: string;
  name?: string;
  email?: string;
  org?: { name: string };
}

/**
 * MARC27 Platform authentication using device-flow OAuth.
 * Same flow as `prism login` in the CLI (prism-client crate).
 */
export class AuthService {
  private static readonly SESSION_KEY = 'prism.auth.session';
  private session: AuthSession | null = null;
  private readonly context: vscode.ExtensionContext;

  private readonly _onSessionChange = new vscode.EventEmitter<AuthSession | null>();
  readonly onSessionChange = this._onSessionChange.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadSession();
  }

  getSession(): AuthSession | null {
    if (this.session && this.session.expiresAt < Date.now()) {
      this.session = null;
      this.saveSession();
    }
    return this.session;
  }

  async login(): Promise<void> {
    const config = vscode.workspace.getConfiguration('prism.auth');
    const platformUrl = config.get<string>('platformUrl', 'https://api.marc27.com/api/v1');

    try {
      // Step 1: Request device code
      const deviceResp = await this.doPost<DeviceCodeResponse>(`${platformUrl}/oauth/device/code`, {
        client_id: 'prism-desktop',
        scope: 'read write marketplace mesh billing',
      });

      // Step 2: Show code to user + open browser
      const opened = await vscode.env.openExternal(vscode.Uri.parse(deviceResp.verification_uri));

      const action = await vscode.window.showInformationMessage(
        `Enter code: ${deviceResp.user_code}`,
        { modal: true, detail: `Your sign-in code is:\n\n${deviceResp.user_code}\n\n${opened ? 'A browser window has opened.' : 'Go to: ' + deviceResp.verification_uri}\nEnter the code above to complete sign-in.` },
        'Done',
        'Cancel',
      );

      if (action !== 'Done') { return; }

      // Step 3: Poll for token
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Signing in to MARC27...' },
        async () => {
          const pollInterval = (deviceResp.interval || 5) * 1000;
          const deadline = Date.now() + (deviceResp.expires_in || 900) * 1000;

          while (Date.now() < deadline) {
            await sleep(pollInterval);
            try {
              const tokenResp = await this.doPost<TokenResponse>(`${platformUrl}/oauth/token`, {
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                client_id: 'prism-desktop',
                device_code: deviceResp.device_code,
              });

              if (tokenResp.access_token) {
                const userInfo = await this.doGet<UserInfoResponse>(
                  `${platformUrl}/api/v1/me`,
                  tokenResp.access_token,
                );

                this.session = {
                  accessToken: tokenResp.access_token,
                  refreshToken: tokenResp.refresh_token || '',
                  username: userInfo.username || userInfo.name || 'User',
                  email: userInfo.email || '',
                  org: userInfo.org?.name,
                  expiresAt: Date.now() + (tokenResp.expires_in || 3600) * 1000,
                };
                await this.saveSession();
                this._onSessionChange.fire(this.session);
                vscode.window.showInformationMessage(`Signed in as ${this.session.username}`);
                return;
              }
            } catch (e: unknown) {
              const err = e as { error?: string };
              if (err.error === 'authorization_pending' || err.error === 'slow_down') {
                continue;
              }
              throw e;
            }
          }
          vscode.window.showErrorMessage('Sign-in timed out. Please try again.');
        },
      );
    } catch (err) {
      vscode.window.showErrorMessage(`Sign-in failed: ${err}`);
    }
  }

  async logout(): Promise<void> {
    this.session = null;
    await this.saveSession();
    this._onSessionChange.fire(null);
  }

  private async loadSession(): Promise<void> {
    const stored = await this.context.secrets.get(AuthService.SESSION_KEY);
    if (stored) {
      try {
        this.session = JSON.parse(stored);
      } catch {
        this.session = null;
      }
    }
  }

  private async saveSession(): Promise<void> {
    if (this.session) {
      await this.context.secrets.store(AuthService.SESSION_KEY, JSON.stringify(this.session));
    } else {
      await this.context.secrets.delete(AuthService.SESSION_KEY);
    }
  }

  private async doPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'PRISM/0.1.0' },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (!resp.ok) { throw json; }
    return json as T;
  }

  private async doGet<T>(url: string, token: string): Promise<T> {
    const resp = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'PRISM/0.1.0' },
    });
    return await resp.json() as T;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => globalThis.setTimeout(r, ms));
}
