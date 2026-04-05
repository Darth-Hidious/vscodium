import * as vscode from 'vscode';

interface NasaApodResponse {
	title?: string;
	url?: string;
	hdurl?: string;
	media_type?: string;
	copyright?: string;
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
			WelcomePanel.viewType, 'Welcome', vscode.ViewColumn.One,
			{ enableScripts: true, retainContextWhenHidden: true },
		);
		WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
	}

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this.panel = panel;
		this.extensionUri = extensionUri;
		this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'prism-icon.svg');
		this.panel.webview.html = this.getHtml();

		this.panel.webview.onDidReceiveMessage(async (msg: { type: string; command?: string; text?: string }) => {
			if (msg.type === 'ready') {
				await this.loadAndSendImage();
			} else if (msg.type === 'command' && msg.command) {
				vscode.commands.executeCommand(msg.command);
			} else if (msg.type === 'agent-message' && msg.text) {
				// Forward to the real PRISM agent
				vscode.commands.executeCommand('prism.agent.openFloatingChat');
				// Small delay then send the message
				globalThis.setTimeout(() => {
					vscode.commands.executeCommand('prism.agent.sendMessage', msg.text);
				}, 500);
			}
		});

		this.panel.onDidDispose(() => { WelcomePanel.currentPanel = undefined; });
	}

	private async loadAndSendImage(): Promise<void> {
		// Try NASA APOD
		try {
			const resp = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true');
			if (resp.ok) {
				const data = await resp.json() as NasaApodResponse;
				if (data.media_type === 'image') {
					this.panel.webview.postMessage({
						type: 'image',
						url: data.hdurl || data.url,
						title: data.title || '',
						credit: data.copyright ? `\u00a9 ${data.copyright}` : 'NASA APOD',
					});
					return;
				}
			}
		} catch { /* next */ }

		// Try NASA Image Library
		const queries = ['nebula', 'galaxy', 'earth from space', 'hubble deep field', 'aurora borealis', 'international space station', 'rocket launch', 'supernova', 'saturn rings', 'solar flare'];
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

		this.panel.webview.postMessage({ type: 'image', url: '', title: 'PRISM', credit: 'MARC27' });
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
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@200;300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 100vw; height: 100vh; overflow: hidden;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      color: #fff; user-select: none;
    }

    /* ── Background image ── */
    #bg {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background-size: cover; background-position: center;
      background-color: #0D0E15;
      transition: opacity 1.5s ease, filter 0.6s ease;
      opacity: 0; z-index: 0;
    }
    #bg.loaded { opacity: 1; }
    body.chat-open #bg { filter: blur(20px) brightness(0.4); }

    /* ── Vignette ── */
    #vignette {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%);
      z-index: 1; pointer-events: none;
      transition: opacity 0.4s ease;
    }
    body.chat-open #vignette { opacity: 0; }

    /* ── Welcome content (fades out when chat opens) ── */
    #welcome-content {
      transition: opacity 0.4s ease, transform 0.4s ease;
      z-index: 10; position: relative;
    }
    body.chat-open #welcome-content {
      opacity: 0; pointer-events: none; transform: scale(0.95);
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
      position: fixed; top: 45%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center; z-index: 10;
    }
    #clock {
      font-size: 120px; font-weight: 200; letter-spacing: -4px;
      line-height: 1; text-shadow: 0 2px 20px rgba(0,0,0,0.5);
    }
    #date-line {
      font-size: 16px; font-weight: 300; margin-top: 8px;
      opacity: 0.7; text-shadow: 0 1px 8px rgba(0,0,0,0.5);
    }

    #image-info {
      position: fixed; bottom: 24px; left: 40px; z-index: 10; max-width: 400px;
    }
    #image-title { font-size: 14px; font-weight: 500; opacity: 0.9; text-shadow: 0 1px 6px rgba(0,0,0,0.6); }
    #image-credit { font-size: 11px; font-weight: 300; opacity: 0.6; }

    /* ── Agent bubble (glassmorphic, bottom-right) ── */
    #agent-bubble {
      position: fixed; bottom: 28px; right: 28px; z-index: 20;
      width: 56px; height: 56px; border-radius: 50%;
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 24px rgba(0,0,0,0.3);
    }
    #agent-bubble:hover {
      background: rgba(255,255,255,0.2);
      transform: scale(1.08);
      box-shadow: 0 6px 32px rgba(0,0,0,0.4);
    }
    #agent-bubble svg { width: 26px; height: 26px; }
    body.chat-open #agent-bubble { display: none; }

    /* ── Chat overlay (glassmorphic canvas) ── */
    #chat-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 30;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 0.4s ease;
    }
    body.chat-open #chat-overlay { opacity: 1; pointer-events: all; }

    #chat-canvas {
      width: 580px; max-width: 90vw;
      max-height: 80vh;
      background: rgba(13, 14, 21, 0.65);
      backdrop-filter: blur(40px) saturate(1.4);
      -webkit-backdrop-filter: blur(40px) saturate(1.4);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      display: flex; flex-direction: column;
      overflow: hidden;
      box-shadow: 0 16px 64px rgba(0,0,0,0.5);
      transform: translateY(20px);
      transition: transform 0.4s ease;
    }
    body.chat-open #chat-canvas { transform: translateY(0); }

    /* Chat header */
    #chat-header {
      padding: 16px 20px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    #chat-header .logo { font-size: 18px; opacity: 0.8; }
    #chat-header .title { font-size: 14px; font-weight: 500; flex: 1; }
    #chat-close {
      width: 28px; height: 28px; border-radius: 8px;
      background: rgba(255,255,255,0.08); border: none;
      color: #fff; font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #chat-close:hover { background: rgba(255,255,255,0.15); }

    /* Chat messages */
    #chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 20px;
      display: flex; flex-direction: column; gap: 12px;
      min-height: 200px; max-height: 50vh;
    }
    .chat-msg {
      max-width: 90%; line-height: 1.6; font-size: 14px;
      animation: fadeIn 0.3s ease;
    }
    .chat-msg.user {
      align-self: flex-end;
      background: rgba(255,255,255,0.1);
      padding: 10px 14px; border-radius: 14px 14px 4px 14px;
    }
    .chat-msg.agent {
      align-self: flex-start;
      padding: 4px 0; opacity: 0.9;
    }
    .chat-msg.hint {
      align-self: center; opacity: 0.4; font-size: 13px;
      text-align: center; padding: 20px 0;
    }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

    /* Chat input */
    #chat-input-area {
      padding: 12px 16px;
      border-top: 1px solid rgba(255,255,255,0.08);
      display: flex; gap: 8px; align-items: flex-end;
    }
    #chat-input {
      flex: 1; resize: none;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 10px 14px;
      color: #fff; font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 14px; line-height: 1.4;
      outline: none; max-height: 120px;
    }
    #chat-input:focus { border-color: rgba(251, 191, 36, 0.5); }
    #chat-input::placeholder { color: rgba(255,255,255,0.3); }
    #chat-send {
      width: 38px; height: 38px; border-radius: 10px;
      background: rgba(251, 191, 36, 0.2);
      border: 1px solid rgba(251, 191, 36, 0.3);
      color: #fbbf24; font-size: 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    #chat-send:hover { background: rgba(251, 191, 36, 0.35); }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }

    @media (max-width: 700px) {
      #clock { font-size: 72px; }
      #chat-canvas { width: 95vw; max-height: 90vh; border-radius: 16px; }
    }
  </style>
</head>
<body>
  <div id="bg"></div>
  <div id="vignette"></div>

  <div id="welcome-content">
    <div id="top-bar"><span id="greeting"></span></div>
    <div id="center">
      <div id="clock"></div>
      <div id="date-line"></div>
    </div>
    <div id="image-info">
      <div id="image-title"></div>
      <div id="image-credit"></div>
    </div>
  </div>

  <!-- Agent bubble -->
  <div id="agent-bubble" title="Talk to PRISM Agent">
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
      <path d="M12 3 L3 18 L21 18 Z" stroke-linejoin="round"/>
      <line x1="1" y1="11" x2="6" y2="11"/>
      <line x1="15" y1="8" x2="23" y2="5" opacity="0.7"/>
      <line x1="15" y1="11" x2="23" y2="11" opacity="0.5"/>
      <line x1="15" y1="14" x2="23" y2="17" opacity="0.3"/>
    </svg>
  </div>

  <!-- Chat overlay -->
  <div id="chat-overlay">
    <div id="chat-canvas">
      <div id="chat-header">
        <span class="logo">&#9671;</span>
        <span class="title">PRISM Agent</span>
        <button id="chat-close">&#10005;</button>
      </div>
      <div id="chat-messages">
        <div class="chat-msg hint">Ask me about materials, simulations, data, or anything science.</div>
      </div>
      <div id="chat-input-area">
        <textarea id="chat-input" rows="1" placeholder="Ask the PRISM agent..."></textarea>
        <button id="chat-send">&#9654;</button>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    (function() {
      var vscode = acquireVsCodeApi();
      var bg = document.getElementById('bg');

      // ── Clock ──
      function updateClock() {
        var now = new Date();
        document.getElementById('clock').textContent =
          String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
        document.getElementById('date-line').textContent =
          now.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
      }
      updateClock();
      setInterval(updateClock, 10000);

      // ── Greeting ──
      var quotes = [
        "The universe is under no obligation to make sense to you.",
        "Somewhere, something incredible is waiting to be known.",
        "The atoms of our bodies are traceable to stars that manufactured them.",
        "We are a way for the universe to know itself.",
        "Materials are the language of engineering.",
        "The next breakthrough is hidden in the periodic table.",
        "Look up at the stars and not down at your feet.",
        "Every atom in your body came from a star that exploded.",
      ];
      var h = new Date().getHours();
      document.getElementById('greeting').textContent = (h < 5 || h >= 22)
        ? "It\\u2019s late \\u2014 time to rest."
        : quotes[Math.floor(Math.random() * quotes.length)];

      // ── Image from extension host ──
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
          document.getElementById('image-title').textContent = msg.title || '';
          document.getElementById('image-credit').textContent = msg.credit || '';
        }
      });

      // ── Agent bubble → open chat ──
      var bubble = document.getElementById('agent-bubble');
      var chatClose = document.getElementById('chat-close');
      var chatInput = document.getElementById('chat-input');
      var chatSend = document.getElementById('chat-send');
      var chatMessages = document.getElementById('chat-messages');

      bubble.addEventListener('click', function() {
        document.body.classList.add('chat-open');
        setTimeout(function() { chatInput.focus(); }, 400);
      });

      chatClose.addEventListener('click', function() {
        document.body.classList.remove('chat-open');
      });

      // ── Send message ──
      function sendMessage() {
        var text = chatInput.value.trim();
        if (!text) return;

        // Add user message
        var userMsg = document.createElement('div');
        userMsg.className = 'chat-msg user';
        userMsg.textContent = text;
        chatMessages.appendChild(userMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Clear input
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Send to extension host → routes to prism agent
        vscode.postMessage({ type: 'agent-message', text: text });

        // Show typing indicator
        var typing = document.createElement('div');
        typing.className = 'chat-msg agent';
        typing.id = 'typing';
        typing.textContent = 'Thinking...';
        typing.style.opacity = '0.4';
        chatMessages.appendChild(typing);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }

      chatSend.addEventListener('click', sendMessage);
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      // Auto-resize input
      chatInput.addEventListener('input', function() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
      });

      // Also close on clicking the blurred background
      document.getElementById('chat-overlay').addEventListener('click', function(e) {
        if (e.target === this) {
          document.body.classList.remove('chat-open');
        }
      });

      // ── Tell host we're ready ──
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
