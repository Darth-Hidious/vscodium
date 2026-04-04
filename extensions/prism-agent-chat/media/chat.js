// @ts-check
/// <reference lib="dom" />

/**
 * PRISM Agent Chat — WebView client-side logic.
 * Communicates with the extension host via vscode.postMessage / onDidReceiveMessage.
 */

(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const messagesEl = document.getElementById('messages');
  const inputEl = /** @type {HTMLTextAreaElement} */ (document.getElementById('input'));
  const sendBtn = document.getElementById('btn-send');
  const connectionDot = document.getElementById('connection-dot');
  const connectionText = document.getElementById('connection-text');
  const approvalBar = document.getElementById('approval-bar');
  const approvalText = document.getElementById('approval-text');
  const btnApprove = document.getElementById('btn-approve');
  const btnDeny = document.getElementById('btn-deny');
  const btnAlways = document.getElementById('btn-always');
  const costText = document.getElementById('cost-text');

  let streamingEl = null;
  let streamBuffer = '';
  let pendingApprovalCallId = null;

  // --- Send message ---

  function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) { return; }

    appendUserMessage(text);
    vscode.postMessage({ type: 'send-message', text });
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  // --- Approval buttons ---

  btnApprove.addEventListener('click', () => {
    if (pendingApprovalCallId) {
      vscode.postMessage({ type: 'approve-tool', callId: pendingApprovalCallId, approved: true });
      hideApproval();
    }
  });

  btnDeny.addEventListener('click', () => {
    if (pendingApprovalCallId) {
      vscode.postMessage({ type: 'approve-tool', callId: pendingApprovalCallId, approved: false });
      hideApproval();
    }
  });

  btnAlways.addEventListener('click', () => {
    if (pendingApprovalCallId) {
      vscode.postMessage({ type: 'approve-tool', callId: pendingApprovalCallId, approved: true });
      hideApproval();
    }
  });

  // --- Receive messages from extension host ---

  window.addEventListener('message', (event) => {
    const msg = event.data;

    switch (msg.type) {
      case 'agent-event':
        handleAgentEvent(msg.event);
        break;
      case 'connection-state':
        updateConnectionState(msg.state);
        break;
      case 'context-message':
        appendUserMessage(msg.text);
        break;
      case 'clear':
        clearMessages();
        break;
    }
  });

  // --- Agent event handlers ---

  function handleAgentEvent(event) {
    switch (event.type) {
      case 'text.delta':
        if (!streamingEl) {
          streamingEl = createAgentMessage();
          streamBuffer = '';
        }
        streamBuffer += event.text;
        streamingEl.textContent = streamBuffer;
        scrollToBottom();
        break;

      case 'text.flush':
        if (streamingEl) {
          streamingEl.textContent = event.text || streamBuffer;
          streamingEl = null;
          streamBuffer = '';
        }
        break;

      case 'tool.start':
        flushStreaming();
        appendToolCard(event.tool_name, event.call_id, 'running', null, null);
        break;

      case 'tool.result':
        updateToolCard(event.call_id, event.success ? 'success' : 'error', event.summary, event.elapsed_ms);
        break;

      case 'tool.approval':
        showApproval(event.tool_name, event.call_id, event.args);
        break;

      case 'plan':
        flushStreaming();
        appendPlanCard(event.steps);
        break;

      case 'cost':
        updateCost(event);
        break;

      case 'turn.complete':
        flushStreaming();
        break;

      case 'error':
        flushStreaming();
        appendError(event.message);
        break;
    }
  }

  // --- DOM helpers ---

  function appendUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'msg msg-user';
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function createAgentMessage() {
    const el = document.createElement('div');
    el.className = 'msg msg-agent';
    messagesEl.appendChild(el);
    return el;
  }

  function appendToolCard(toolName, callId, status, summary, elapsedMs) {
    const card = document.createElement('div');
    card.className = 'tool-card ' + status;
    card.id = 'tool-' + callId;

    const header = document.createElement('div');
    header.className = 'tool-card-header';

    // Icon
    const iconSpan = document.createElement('span');
    iconSpan.className = 'tool-icon';
    if (status === 'running') {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      iconSpan.appendChild(spinner);
    }
    header.appendChild(iconSpan);

    // Tool name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tool-name';
    nameSpan.textContent = toolName;
    header.appendChild(nameSpan);

    // Elapsed time
    const timeSpan = document.createElement('span');
    timeSpan.className = 'tool-time';
    if (elapsedMs != null) { timeSpan.textContent = formatMs(elapsedMs); }
    header.appendChild(timeSpan);

    card.appendChild(header);

    if (summary) {
      const body = document.createElement('div');
      body.className = 'tool-card-body';
      body.textContent = summary;
      card.appendChild(body);
    }

    messagesEl.appendChild(card);
    scrollToBottom();
  }

  function updateToolCard(callId, status, summary, elapsedMs) {
    const card = document.getElementById('tool-' + callId);
    if (!card) {
      appendToolCard('tool', callId, status, summary, elapsedMs);
      return;
    }

    card.className = 'tool-card ' + status;
    const icon = card.querySelector('.tool-icon');
    if (icon) {
      icon.textContent = status === 'success' ? '\u2714' : '\u2718';
    }
    const time = card.querySelector('.tool-time');
    if (time && elapsedMs != null) { time.textContent = formatMs(elapsedMs); }

    if (summary) {
      let body = card.querySelector('.tool-card-body');
      if (!body) {
        body = document.createElement('div');
        body.className = 'tool-card-body';
        card.appendChild(body);
      }
      body.textContent = summary;
    }
  }

  function appendPlanCard(steps) {
    const card = document.createElement('div');
    card.className = 'plan-card';

    const heading = document.createElement('h4');
    heading.textContent = 'Plan';
    card.appendChild(heading);

    const ol = document.createElement('ol');
    steps.forEach(function (step) {
      const li = document.createElement('li');
      li.textContent = step;
      ol.appendChild(li);
    });
    card.appendChild(ol);

    messagesEl.appendChild(card);
    scrollToBottom();
  }

  function appendError(message) {
    const el = document.createElement('div');
    el.className = 'msg msg-agent';
    el.style.color = 'var(--spec-red)';
    el.textContent = 'Error: ' + message;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function showApproval(toolName, callId, args) {
    pendingApprovalCallId = callId;
    approvalText.textContent = toolName + '(' + JSON.stringify(args).slice(0, 80) + ')';
    approvalBar.classList.remove('hidden');
  }

  function hideApproval() {
    pendingApprovalCallId = null;
    approvalBar.classList.add('hidden');
  }

  function updateCost(event) {
    var inTok = event.input_tokens > 1000 ? (event.input_tokens / 1000).toFixed(1) + 'k' : event.input_tokens;
    var outTok = event.output_tokens > 1000 ? (event.output_tokens / 1000).toFixed(1) + 'k' : event.output_tokens;
    costText.textContent = inTok + ' in \u00b7 ' + outTok + ' out \u00b7 $' + event.turn_cost.toFixed(4) + ' \u00b7 total: $' + event.session_cost.toFixed(4);
  }

  function updateConnectionState(state) {
    connectionDot.className = state;
    var labels = {
      connected: 'Connected to PRISM',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
      error: 'Connection error',
    };
    connectionText.textContent = labels[state] || state;
  }

  function flushStreaming() {
    if (streamingEl) {
      streamingEl = null;
      streamBuffer = '';
    }
  }

  function clearMessages() {
    while (messagesEl.firstChild) {
      messagesEl.removeChild(messagesEl.firstChild);
    }
    streamingEl = null;
    streamBuffer = '';
    costText.textContent = '';
    hideApproval();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function formatMs(ms) {
    return ms >= 1000 ? (ms / 1000).toFixed(1) + 's' : ms + 'ms';
  }

  // --- Init ---

  vscode.postMessage({ type: 'ready' });
})();
