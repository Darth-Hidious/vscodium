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
				vscode.commands.executeCommand('prism.agent.sendMessage', msg.text);

				const agentExt = vscode.extensions.getExtension('marc27.prism-agent-chat');
				if (agentExt?.isActive && agentExt.exports) {
					const api = agentExt.exports as { onEvent: vscode.Event<{ type: string; text?: string }> };
					let responseText = '';
					const disposable = api.onEvent((event: { type: string; text?: string }) => {
						if (event.type === 'text.delta' && event.text) {
							responseText += event.text;
							this.panel.webview.postMessage({ type: 'agent-response-delta', text: responseText });
						} else if (event.type === 'turn.complete' || event.type === 'error') {
							this.panel.webview.postMessage({ type: 'agent-response-done', text: responseText });
							disposable.dispose();
						}
					});
				}
			}
		});

		this.panel.onDidDispose(() => { WelcomePanel.currentPanel = undefined; });
	}

	private async loadAndSendImage(): Promise<void> {
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
    content="default-src 'none'; style-src 'nonce-${nonce}' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'nonce-${nonce}'; img-src https: http: data:;">
  <title>Welcome to PRISM</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@200;300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
  <style nonce="${nonce}">
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 100vw; height: 100vh; overflow: hidden;
      font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
      color: #fff; user-select: none;
      background: #0a0b10;
    }

    /* ════════════════════════════════════════════
       BACKGROUND IMAGE
       ════════════════════════════════════════════ */
    #bg {
      position: fixed; inset: 0;
      background-size: cover; background-position: center;
      background-color: #0a0b10;
      opacity: 0;
      transition: opacity 2s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 0;
    }
    #bg.loaded { opacity: 1; }

    /* Subtle vignette — always present */
    #vignette {
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%);
      z-index: 1; pointer-events: none;
    }

    /* ════════════════════════════════════════════
       GAUSSIAN OVERLAY — activated on chat focus
       ════════════════════════════════════════════ */
    #gaussian-overlay {
      position: fixed; inset: 0;
      background: rgba(10, 11, 16, 0.55);
      backdrop-filter: blur(60px) saturate(1.2) brightness(0.6);
      -webkit-backdrop-filter: blur(60px) saturate(1.2) brightness(0.6);
      z-index: 5;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    body.chat-active #gaussian-overlay {
      opacity: 1;
      pointer-events: all;
    }

    /* ════════════════════════════════════════════
       AMBIENT CONTENT — clock, quote, image info
       ════════════════════════════════════════════ */
    #ambient {
      position: fixed; inset: 0;
      z-index: 10; pointer-events: none;
      transition: opacity 0.5s ease, transform 0.5s ease;
    }
    body.chat-active #ambient {
      opacity: 0;
      transform: scale(0.97) translateY(-10px);
    }

    #clock-area {
      position: absolute;
      top: 40%; left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    #clock {
      font-size: 110px; font-weight: 200; letter-spacing: -3px;
      line-height: 1;
      text-shadow: 0 2px 30px rgba(0,0,0,0.5);
    }
    #date-line {
      font-size: 15px; font-weight: 300; margin-top: 10px;
      opacity: 0.6;
      text-shadow: 0 1px 10px rgba(0,0,0,0.5);
    }
    #greeting {
      position: absolute; top: 28px; left: 0; right: 0;
      text-align: center;
      font-size: 14px; font-weight: 300; letter-spacing: 0.3px;
      opacity: 0.7;
      text-shadow: 0 1px 8px rgba(0,0,0,0.6);
    }
    #image-info {
      position: absolute; bottom: 80px; left: 40px;
      max-width: 350px;
    }
    #image-title {
      font-size: 13px; font-weight: 500; opacity: 0.8;
      text-shadow: 0 1px 6px rgba(0,0,0,0.6);
    }
    #image-credit {
      font-size: 11px; font-weight: 300; opacity: 0.5; margin-top: 2px;
    }

    /* ════════════════════════════════════════════
       CHAT LAYER — messages + pill input
       ════════════════════════════════════════════ */
    #chat-layer {
      position: fixed; inset: 0;
      z-index: 20;
      display: flex; flex-direction: column;
      align-items: center; justify-content: flex-end;
      padding-bottom: 48px;
      pointer-events: none;
    }

    /* Messages container — hidden until chat active */
    #messages {
      width: 640px; max-width: 88vw;
      max-height: 0;
      overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column;
      gap: 10px;
      padding: 0 4px;
      margin-bottom: 16px;
      transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1),
                  opacity 0.4s ease;
      opacity: 0;
      pointer-events: none;
    }
    body.chat-active #messages {
      max-height: calc(100vh - 180px);
      opacity: 1;
      pointer-events: auto;
    }

    .msg {
      max-width: 85%;
      line-height: 1.65; font-size: 14px;
      animation: msgSlide 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      word-wrap: break-word;
    }
    .msg.user {
      align-self: flex-end;
      background: rgba(251, 191, 36, 0.14);
      border: 1px solid rgba(251, 191, 36, 0.22);
      padding: 10px 16px;
      border-radius: 18px 18px 6px 18px;
    }
    .msg.agent {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 16px;
      border-radius: 18px 18px 18px 6px;
    }
    .msg.hint {
      align-self: center;
      opacity: 0.35; font-size: 13px; font-weight: 300;
      text-align: center;
      padding: 24px 0 8px;
      background: none; border: none;
    }

    @keyframes msgSlide {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ════════════════════════════════════════════
       THE PILL — glassmorphic input bar
       ════════════════════════════════════════════ */
    #pill {
      width: 580px; max-width: 85vw;
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(24px) saturate(1.3);
      -webkit-backdrop-filter: blur(24px) saturate(1.3);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 26px;
      display: flex; align-items: flex-end;
      padding: 6px 6px 6px 20px;
      gap: 8px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.35),
                  inset 0 1px 0 rgba(255, 255, 255, 0.06);
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
    }
    #pill:focus-within {
      background: rgba(255, 255, 255, 0.10);
      border-color: rgba(251, 191, 36, 0.35);
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4),
                  0 0 0 1px rgba(251, 191, 36, 0.15),
                  inset 0 1px 0 rgba(255, 255, 255, 0.08);
    }
    body.chat-active #pill {
      width: 640px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.07);
    }

    #pill-input {
      flex: 1;
      background: none; border: none; outline: none;
      color: #fff;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 15px; font-weight: 400;
      line-height: 1.5;
      resize: none;
      max-height: 120px;
      padding: 8px 0;
    }
    #pill-input::placeholder {
      color: rgba(255, 255, 255, 0.30);
      font-weight: 300;
    }

    #pill-send {
      width: 40px; height: 40px;
      border-radius: 20px;
      background: rgba(251, 191, 36, 0.18);
      border: 1px solid rgba(251, 191, 36, 0.28);
      color: #fbbf24;
      font-size: 16px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
      opacity: 0;
      transform: scale(0.8);
    }
    body.chat-active #pill-send,
    #pill:focus-within #pill-send {
      opacity: 1;
      transform: scale(1);
    }
    #pill-send:hover {
      background: rgba(251, 191, 36, 0.3);
      transform: scale(1.05);
    }

    /* ════════════════════════════════════════════
       PRISM LOGO WATERMARK — subtle bottom-right
       ════════════════════════════════════════════ */
    #watermark {
      position: fixed; bottom: 14px; right: 24px;
      z-index: 2;
      font-size: 12px; font-weight: 400;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      opacity: 0.2;
      transition: opacity 0.4s ease;
    }
    body.chat-active #watermark { opacity: 0.1; }

    /* ════════════════════════════════════════════
       SCROLLBAR
       ════════════════════════════════════════════ */
    #messages::-webkit-scrollbar { width: 3px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.12);
      border-radius: 2px;
    }

    /* ════════════════════════════════════════════
       RESPONSIVE
       ════════════════════════════════════════════ */
    @media (max-width: 700px) {
      #clock { font-size: 72px; }
      #pill, body.chat-active #pill { max-width: 95vw; }
      #messages { max-width: 95vw; }
      #chat-layer { padding-bottom: 24px; }
    }
  </style>
</head>
<body>
  <!-- Background -->
  <div id="bg"></div>
  <div id="vignette"></div>
  <div id="gaussian-overlay"></div>

  <!-- Ambient content (fades on chat) -->
  <div id="ambient">
    <div id="greeting"></div>
    <div id="clock-area">
      <div id="clock"></div>
      <div id="date-line"></div>
    </div>
    <div id="image-info">
      <div id="image-title"></div>
      <div id="image-credit"></div>
    </div>
  </div>

  <!-- Chat layer: messages + pill -->
  <div id="chat-layer">
    <div id="messages">
      <div class="msg hint">Ask about materials, simulations, or anything science.</div>
    </div>
    <div id="pill">
      <textarea id="pill-input" rows="1" placeholder="Ask PRISM anything..."></textarea>
      <button id="pill-send" title="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>

  <!-- Watermark -->
  <div id="watermark">PRISM</div>

  <script nonce="${nonce}">
  (function() {
    var vscode = acquireVsCodeApi();
    var bg = document.getElementById('bg');
    var pillInput = document.getElementById('pill-input');
    var pillSend = document.getElementById('pill-send');
    var messages = document.getElementById('messages');
    var isActive = false;

    // ── Clock ──
    function tick() {
      var now = new Date();
      document.getElementById('clock').textContent =
        String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      document.getElementById('date-line').textContent =
        now.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    }
    tick();
    setInterval(tick, 10000);

    // ── Greeting ──
    var quotes = [
      "The universe is under no obligation to make sense to you.",
      "Somewhere, something incredible is waiting to be known.",
      "The atoms of our bodies are traceable to stars that manufactured them.",
      "We are a way for the universe to know itself.",
      "Materials are the language of engineering.",
      "The next breakthrough is hidden in the periodic table.",
      "Look up at the stars and not down at your feet.",
      "Every atom in your body came from a star that exploded."
    ];
    document.getElementById('greeting').textContent =
      quotes[Math.floor(Math.random() * quotes.length)];

    // ── Image from host ──
    window.addEventListener('message', function(event) {
      var msg = event.data;

      if (msg.type === 'image') {
        if (msg.url) {
          bg.style.backgroundImage = 'url(' + msg.url + ')';
          bg.classList.add('loaded');
        } else {
          bg.style.background = 'linear-gradient(135deg, #0a0b10 0%, #0f1628 30%, #1a0a2e 60%, #0a0b10 100%)';
          bg.classList.add('loaded');
        }
        document.getElementById('image-title').textContent = msg.title || '';
        document.getElementById('image-credit').textContent = msg.credit || '';
      }

      if (msg.type === 'agent-response-delta') {
        var el = document.getElementById('streaming-response');
        if (el) {
          el.textContent = msg.text;
          el.style.opacity = '1';
          messages.scrollTop = messages.scrollHeight;
        }
      }

      if (msg.type === 'agent-response-done') {
        var doneEl = document.getElementById('streaming-response');
        if (doneEl) {
          doneEl.id = '';
          doneEl.textContent = msg.text || 'Done.';
          doneEl.style.opacity = '1';
        }
      }
    });

    // ── Activate chat mode ──
    function activateChat() {
      if (!isActive) {
        isActive = true;
        document.body.classList.add('chat-active');
      }
    }

    function deactivateChat() {
      // Only deactivate if no messages have been sent (empty conversation)
      var userMessages = messages.querySelectorAll('.msg.user');
      if (userMessages.length === 0) {
        isActive = false;
        document.body.classList.remove('chat-active');
      }
    }

    // Focus pill → activate overlay
    pillInput.addEventListener('focus', activateChat);

    // Click on gaussian overlay (outside pill/messages) → deactivate
    document.getElementById('gaussian-overlay').addEventListener('click', function(e) {
      if (e.target === this) {
        pillInput.blur();
        deactivateChat();
      }
    });

    // Escape key → deactivate
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && isActive) {
        pillInput.blur();
        deactivateChat();
      }
    });

    // ── Send message ──
    function sendMessage() {
      var text = pillInput.value.trim();
      if (!text) return;

      activateChat();

      // Remove hint if present
      var hint = messages.querySelector('.msg.hint');
      if (hint) hint.remove();

      // User bubble
      var userMsg = document.createElement('div');
      userMsg.className = 'msg user';
      userMsg.textContent = text;
      messages.appendChild(userMsg);
      messages.scrollTop = messages.scrollHeight;

      pillInput.value = '';
      pillInput.style.height = 'auto';

      // Send to agent
      vscode.postMessage({ type: 'agent-message', text: text });

      // Streaming placeholder
      var agentMsg = document.createElement('div');
      agentMsg.className = 'msg agent';
      agentMsg.id = 'streaming-response';
      agentMsg.style.opacity = '0.5';
      agentMsg.textContent = '';
      messages.appendChild(agentMsg);
      messages.scrollTop = messages.scrollHeight;
    }

    pillSend.addEventListener('click', sendMessage);
    pillInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize pill input
    pillInput.addEventListener('input', function() {
      pillInput.style.height = 'auto';
      pillInput.style.height = Math.min(pillInput.scrollHeight, 120) + 'px';
    });

    // ── Init ──
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
