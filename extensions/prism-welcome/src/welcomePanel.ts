import * as vscode from 'vscode';

export class WelcomePanel {
  public static readonly viewType = 'prism.welcome';
  private static currentPanel: WelcomePanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposed = false;

  public static createOrShow(extensionUri: vscode.Uri): void {
    // If panel already exists, reveal it
    if (WelcomePanel.currentPanel) {
      WelcomePanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      WelcomePanel.viewType,
      'Welcome',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      },
    );

    WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;

    this.panel.webview.html = this.getHtml(this.panel.webview);
    this.panel.iconPath = vscode.Uri.joinPath(extensionUri, 'media', 'prism-icon.svg');

    this.panel.onDidDispose(() => {
      WelcomePanel.currentPanel = undefined;
      this.disposed = true;
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'welcome.css'));
    const nonce = getNonce();
    const config = vscode.workspace.getConfiguration('prism.welcome');
    const source = config.get<string>('imageSource', 'nasa-apod');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src https: http: data:; connect-src https://api.nasa.gov https://epic.gsfc.nasa.gov https://apod.nasa.gov https://images-api.nasa.gov https://images-assets.nasa.gov https://www.esa.int https://cdn.eso.org;">
  <link rel="stylesheet" href="${cssUri}">
  <title>Welcome to PRISM</title>
</head>
<body>
  <!-- Full-bleed background image -->
  <div id="bg"></div>
  <div id="vignette"></div>

  <!-- Top bar: gentle message -->
  <div id="top-bar">
    <span id="greeting"></span>
  </div>

  <!-- Center: clock -->
  <div id="center">
    <div id="clock"></div>
    <div id="date-line"></div>
  </div>

  <!-- Bottom left: image info -->
  <div id="image-info">
    <div id="image-title"></div>
    <div id="image-credit"></div>
  </div>

  <!-- Bottom right: quick actions -->
  <div id="actions">
    <button class="action-btn" data-cmd="prism.agent.newChat">
      <span class="action-icon">&#9671;</span>
      <span>New Chat</span>
    </button>
    <button class="action-btn" data-cmd="workbench.action.files.openFile">
      <span class="action-icon">&#9776;</span>
      <span>Open File</span>
    </button>
    <button class="action-btn" data-cmd="workbench.action.terminal.new">
      <span class="action-icon">&#9002;</span>
      <span>Terminal</span>
    </button>
    <button class="action-btn" data-cmd="workbench.action.openRecent">
      <span class="action-icon">&#8634;</span>
      <span>Recent</span>
    </button>
  </div>

  <script nonce="${nonce}">
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    const imageSource = "${source}";

    // --- Clock ---
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      document.getElementById('clock').textContent = h + ':' + m;

      const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      document.getElementById('date-line').textContent = now.toLocaleDateString(undefined, opts);
    }
    updateClock();
    setInterval(updateClock, 10000);

    // --- Greeting ---
    function getGreeting() {
      const h = new Date().getHours();
      const greetings = [
        "The universe is under no obligation to make sense to you.",
        "Somewhere, something incredible is waiting to be known.",
        "The good thing about science is that it's true whether or not you believe in it.",
        "Not only is the universe stranger than we imagine, it is stranger than we can imagine.",
        "The atoms of our bodies are traceable to stars that manufactured them.",
        "Science is a way of thinking much more than it is a body of knowledge.",
        "The important thing is not to stop questioning.",
        "Look up at the stars and not down at your feet.",
        "We are a way for the universe to know itself.",
        "Every atom in your body came from a star that exploded.",
        "The nitrogen in our DNA, the calcium in our teeth, the iron in our blood — all made in the interiors of collapsing stars.",
        "Materials are the language of engineering.",
        "The next breakthrough is hidden in the periodic table.",
        "What we observe is not nature itself, but nature exposed to our method of questioning.",
      ];
      if (h < 5) return "It's late \\u2014 time to rest.";
      if (h < 12) return greetings[Math.floor(Math.random() * greetings.length)];
      if (h < 17) return greetings[Math.floor(Math.random() * greetings.length)];
      if (h < 21) return greetings[Math.floor(Math.random() * greetings.length)];
      return "It's late \\u2014 time to rest.";
    }
    document.getElementById('greeting').textContent = getGreeting();

    // --- Image Loading: try NASA APOD first, then NASA Image Library, then fallback ---
    async function loadImage() {
      var bg = document.getElementById('bg');
      var titleEl = document.getElementById('image-title');
      var creditEl = document.getElementById('image-credit');

      // Helper to set background with smooth load
      function setBg(url, title, credit) {
        var img = new Image();
        img.onload = function() {
          bg.style.backgroundImage = 'url(' + url + ')';
          bg.style.opacity = '1';
        };
        img.src = url;
        titleEl.textContent = title;
        creditEl.textContent = credit;
      }

      // Try NASA APOD (Astronomy Picture of the Day)
      try {
        var apodResp = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&thumbs=true');
        if (apodResp.ok) {
          var apod = await apodResp.json();
          if (apod.media_type === 'image' && apod.hdurl) {
            setBg(apod.hdurl, apod.title, apod.copyright ? '\\u00a9 ' + apod.copyright : 'NASA APOD');
            return;
          } else if (apod.url) {
            setBg(apod.url, apod.title, apod.copyright ? '\\u00a9 ' + apod.copyright : 'NASA APOD');
            return;
          }
        }
      } catch (e) { /* try next source */ }

      // Try NASA Image Library — search for stunning space/materials images
      var nasaQueries = ['nebula', 'galaxy', 'earth from space', 'hubble deep field', 'aurora', 'ISS', 'rocket launch', 'crystal structure', 'supernova', 'mars surface', 'saturn rings', 'solar flare'];
      var query = nasaQueries[Math.floor(Math.random() * nasaQueries.length)];
      try {
        var nasaResp = await fetch('https://images-api.nasa.gov/search?q=' + encodeURIComponent(query) + '&media_type=image&page_size=20');
        if (nasaResp.ok) {
          var nasaData = await nasaResp.json();
          var items = nasaData.collection.items;
          if (items.length > 0) {
            var pick = items[Math.floor(Math.random() * Math.min(items.length, 10))];
            var nasaTitle = pick.data[0].title || query;
            var nasaCredit = pick.data[0].photographer || pick.data[0].center || 'NASA';
            // Get the image href from the links array
            var imgLink = pick.links && pick.links[0] && pick.links[0].href;
            if (imgLink) {
              // Swap ~thumb for ~orig or ~large for HD
              var hdLink = imgLink.replace('~thumb', '~large').replace('~small', '~large');
              setBg(hdLink, nasaTitle, nasaCredit);
              return;
            }
          }
        }
      } catch (e) { /* try next source */ }

      // Try ESO (European Southern Observatory) — stunning space images
      try {
        var esoResp = await fetch('https://cdn.eso.org/images/screen/eso0932a.jpg');
        if (esoResp.ok) {
          setBg('https://cdn.eso.org/images/screen/eso0932a.jpg', 'The Milky Way', 'ESO / S. Brunier');
          return;
        }
      } catch (e) { /* fallback */ }

      // Final fallback
      bg.style.background = 'linear-gradient(135deg, #0D0E15 0%, #0f1628 30%, #1a0a2e 60%, #0D0E15 100%)';
      titleEl.textContent = 'PRISM';
      creditEl.textContent = 'Materials Discovery Platform by MARC27';
    }
    loadImage();

    // --- Quick action buttons ---
    document.querySelectorAll('.action-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var cmd = btn.getAttribute('data-cmd');
        if (cmd) {
          vscode.postMessage({ type: 'command', command: cmd });
        }
      });
    });

    // Handle commands from webview
    window.addEventListener('message', function(event) {
      // future: handle theme changes, etc.
    });
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
