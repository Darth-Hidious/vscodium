import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  username: string;
  email: string;
  org?: string;
  expiresAt: number;
}

/**
 * MARC27 Platform authentication using device-flow OAuth.
 * Same flow as `prism login` in the CLI (prism-client crate).
 *
 * Flow:
 * 1. POST /oauth/device/code → get device_code + user_code + verification_uri
 * 2. Show user the code and open browser to verification_uri
 * 3. Poll POST /oauth/token until user completes auth
 * 4. Store tokens in VS Code SecretStorage
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
      // Token expired — clear it
      this.session = null;
      this.saveSession();
    }
    return this.session;
  }

  async login(): Promise<void> {
    const config = vscode.workspace.getConfiguration('prism.auth');
    const platformUrl = config.get<string>('platformUrl', 'https://platform.marc27.com');

    try {
      // Step 1: Request device code
      const deviceResp = await this.post(`${platformUrl}/oauth/device/code`, {
        client_id: 'prism-desktop',
        scope: 'read write marketplace mesh billing',
      });

      const { device_code, user_code, verification_uri, expires_in, interval } = deviceResp;

      // Step 2: Show code to user + open browser
      const opened = await vscode.env.openExternal(vscode.Uri.parse(verification_uri));

      const action = await vscode.window.showInformationMessage(
        `Enter code: ${user_code}`,
        { modal: true, detail: `Your sign-in code is:\n\n${user_code}\n\n${opened ? 'A browser window has opened.' : 'Go to: ' + verification_uri}\nEnter the code above to complete sign-in.` },
        'Done',
        'Cancel',
      );

      if (action !== 'Done') { return; }

      // Step 3: Poll for token
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Signing in to MARC27...' },
        async () => {
          const pollInterval = (interval || 5) * 1000;
          const deadline = Date.now() + (expires_in || 900) * 1000;

          while (Date.now() < deadline) {
            await sleep(pollInterval);
            try {
              const tokenResp = await this.post(`${platformUrl}/oauth/token`, {
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                client_id: 'prism-desktop',
                device_code,
              });

              if (tokenResp.access_token) {
                // Step 4: Get user info
                const userInfo = await this.get(`${platformUrl}/api/v1/me`, tokenResp.access_token);

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
              // "authorization_pending" is expected — keep polling
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

  private post(url: string, body: Record<string, string>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;

      const req = mod.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'PRISM-Desktop/0.1.0',
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode && res.statusCode >= 400) {
              reject(json);
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error(`Invalid response: ${body.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  private get(url: string, token: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const mod = parsed.protocol === 'https:' ? https : http;

      const req = mod.request({
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'PRISM-Desktop/0.1.0',
        },
      }, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error(`Invalid response: ${body.slice(0, 200)}`)); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
