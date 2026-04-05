import * as vscode from 'vscode';

interface NasaApodResponse {
	title?: string;
	url?: string;
	hdurl?: string;
	media_type?: string;
	copyright?: string;
	explanation?: string;
}

interface NasaSearchResponse {
	collection: {
		items: Array<{
			data: Array<{ title?: string; photographer?: string; center?: string }>;
			links?: Array<{ href: string }>;
		}>;
	};
}

export class WelcomePanel {
	public static readonly viewType = 'prism.welcome';
	private static currentPanel: WelcomePanel | undefined;
	private readonly panel: vscode.WebviewPanel;
	private readonly extensionUri: vscode.Uri;

	public static createOrShow(extensionUri: vscode.Uri): void {
		if (WelcomePanel.currentPanel) {
			WelcomePanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
			return;
		}
		const panel = vscode.window.createWebviewPanel(
			WelcomePanel.viewType,
			'Welcome',
			vscode.ViewColumn.One,
			{ enableScripts: true, retainContextWhenHidden: true },
		);
		WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this.panel = panel;
		this.extensionUri = extensionUri;
		this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'prism-icon.svg');

		// Set initial HTML, then fetch image from Node.js side and push it in
		this.panel.webview.html = this.getHtml();

		this.panel.webview.onDidReceiveMessage(async (msg: { type: string; command?: string }) => {
			if (msg.type === 'ready') {
				await this.loadAndSendImage();
			} else if (msg.type === 'command' && msg.command) {
				vscode.commands.executeCommand(msg.command);
			}
		});

		this.panel.onDidDispose(() => {
			WelcomePanel.currentPanel = undefined;
		});
	}

	/**
	 * Fetch image on the Node.js side (no CSP restrictions here),
	 * then send the URL to the webview.
	 */
	private async loadAndSendImage(): Promise<void> {
		// Try NASA APOD first
		try {
			const resp = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true');
			if (resp.ok) {
				const data = await resp.json() as NasaApodResponse;
				if (data.media_type === 'image') {
					this.panel.webview.postMessage({
						type: 'image',
						url: data.hdurl || data.url,
						title: data.title || '',
						credit: data.copyright ? `\u00a9 ${data.copyright}` : 'NASA Astronomy Picture of the Day',
					});
					return;
				}
			}
		} catch { /* try next */ }

		// Try NASA Image Library
		const queries = ['nebula', 'galaxy', 'earth from space', 'hubble deep field', 'aurora borealis', 'international space station', 'rocket launch', 'supernova', 'mars surface', 'saturn rings'];
		const query = queries[Math.floor(Math.random() * queries.length)];
		try {
			const resp = await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=20`);
			if (resp.ok) {
				const data = await resp.json() as NasaSearchResponse;
				const items = data.collection.items;
				if (items.length > 0) {
					const pick = items[Math.floor(Math.random() * Math.min(items.length, 10))];
					const imgLink = pick.links?.[0]?.href;
					if (imgLink) {
						this.panel.webview.postMessage({
							type: 'image',
							url: imgLink.replace('~thumb', '~large').replace('~small', '~large'),
							title: pick.data[0]?.title || query,
							credit: pick.data[0]?.photographer || pick.data[0]?.center || 'NASA',
						});
						return;
					}
				}
			}
		} catch { /* fallback */ }

		// Fallback — no image
		this.panel.webview.postMessage({
			type: 'image',
			url: '',
			title: 'PRISM',
			credit: 'Materials Discovery Platform by MARC27',
		});
	}

	private getHtml(): string {
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src https: http: data:;">
  <title>Welcome to PRISM</title>
  <style nonce="${nonce}">
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100vw; height: 100vh; overflow: hidden;
      font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      color: #fff; user-select: none;
    }
    #bg {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background-size: cover; background-position: center; background-repeat: no-repeat;
      background-color: #0D0E15;
      transition: opacity 1.5s ease;
      opacity: 0;
      z-index: 0;
    }
    #bg.loaded { opacity: 1; }
    #vignette {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%);
      z-index: 1; pointer-events: none;
    }
    #top-bar {
      position: fixed; top: 0; left: 0; right: 0;
      padding: 28px 40px; text-align: center; z-index: 10;
    }
    #greeting {
      font-size: 15px; font-weight: 300; letter-spacing: 0.3px;
      opacity: 0.85; text-shadow: 0 1px 8px rgba(0,0,0,0.6);
    }
    #center {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center; z-index: 10;
    }
    #clock {
      font-size: 120px; font-weight: 200; letter-spacing: -4px;
      line-height: 1; text-shadow: 0 2px 20px rgba(0,0,0,0.5);
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
    }
    #date-line {
      font-size: 16px; font-weight: 300; margin-top: 8px;
      opacity: 0.7; text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }
    #image-info {
      position: fixed; bottom: 24px; left: 40px; z-index: 10; max-width: 400px;
    }
    #image-title {
      font-size: 14px; font-weight: 500; opacity: 0.9;
      text-shadow: 0 1px 6px rgba(0,0,0,0.6); margin-bottom: 2px;
    }
    #image-credit {
      font-size: 11px; font-weight: 300; opacity: 0.6;
      text-shadow: 0 1px 4px rgba(0,0,0,0.5);
    }
    #actions {
      position: fixed; bottom: 24px; right: 40px;
      display: flex; gap: 12px; z-index: 10;
    }
    .action-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px;
      border: 1px solid rgba(255,255,255,0.2); border-radius: 8px;
      background: rgba(0,0,0,0.3);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      color: #fff; font-size: 13px; font-weight: 400;
      cursor: pointer; transition: all 0.2s ease;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
    }
    .action-btn:hover {
      background: rgba(255,255,255,0.15);
      border-color: rgba(255,255,255,0.4);
      transform: translateY(-1px);
    }
    .action-icon { font-size: 16px; opacity: 0.8; }
    @media (max-width: 700px) {
      #clock { font-size: 72px; }
      #actions { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div id="bg"></div>
  <div id="vignette"></div>

  <div id="top-bar"><span id="greeting"></span></div>

  <div id="center">
    <div id="clock"></div>
    <div id="date-line"></div>
  </div>

  <div id="image-info">
    <div id="image-title"></div>
    <div id="image-credit"></div>
  </div>

  <div id="actions">
    <button class="action-btn" data-cmd="prism.agent.openFloatingChat">
      <span class="action-icon">&#9671;</span><span>New Chat</span>
    </button>
    <button class="action-btn" data-cmd="workbench.action.files.openFile">
      <span class="action-icon">&#9776;</span><span>Open File</span>
    </button>
    <button class="action-btn" data-cmd="workbench.action.terminal.new">
      <span class="action-icon">&#9002;</span><span>Terminal</span>
    </button>
    <button class="action-btn" data-cmd="workbench.action.openRecent">
      <span class="action-icon">&#8634;</span><span>Recent</span>
    </button>
  </div>

  <script nonce="${nonce}">
    (function() {
      var vscode = acquireVsCodeApi();
      var bg = document.getElementById('bg');
      var titleEl = document.getElementById('image-title');
      var creditEl = document.getElementById('image-credit');

      // Clock
      function updateClock() {
        var now = new Date();
        document.getElementById('clock').textContent =
          String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        document.getElementById('date-line').textContent =
          now.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      }
      updateClock();
      setInterval(updateClock, 10000);

      // Greeting
      var quotes = [
        "The universe is under no obligation to make sense to you.",
        "Somewhere, something incredible is waiting to be known.",
        "The atoms of our bodies are traceable to stars that manufactured them.",
        "We are a way for the universe to know itself.",
        "The nitrogen in our DNA, the calcium in our teeth, the iron in our blood \\u2014 all made in collapsing stars.",
        "Materials are the language of engineering.",
        "The next breakthrough is hidden in the periodic table.",
        "What we observe is not nature itself, but nature exposed to our method of questioning.",
        "Look up at the stars and not down at your feet.",
        "Every atom in your body came from a star that exploded.",
      ];
      var h = new Date().getHours();
      var greeting = (h < 5 || h >= 22)
        ? "It's late \\u2014 time to rest."
        : quotes[Math.floor(Math.random() * quotes.length)];
      document.getElementById('greeting').textContent = greeting;

      // Receive image from extension host (fetched on Node.js side, no CSP issues)
      window.addEventListener('message', function(event) {
        var msg = event.data;
        if (msg.type === 'image') {
          if (msg.url) {
            bg.style.backgroundImage = 'url(' + msg.url + ')';
            bg.classList.add('loaded');
          } else {
            bg.style.background = 'linear-gradient(135deg, #0D0E15 0%, #0f1628 30%, #1a0a2e 60%, #0D0E15 100%)';
            bg.classList.add('loaded');
          }
          titleEl.textContent = msg.title || '';
          creditEl.textContent = msg.credit || '';
        }
      });

      // Action buttons
      document.querySelectorAll('.action-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var cmd = btn.getAttribute('data-cmd');
          if (cmd) { vscode.postMessage({ type: 'command', command: cmd }); }
        });
      });

      // Tell extension host we're ready
      vscode.postMessage({ type: 'ready' });
    })();
  </script>
</body>
</html>`;
	}
}

function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 32; i++) {
		nonce += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return nonce;
}
