(function() {
  // Find our script tag to read attributes
  const scriptTag = document.currentScript || Array.from(document.getElementsByTagName('script')).find(s => s.src.includes('snapmind-widget.js'));
  if (!scriptTag) {
    console.error("SnapMind AI Widget: Could not locate script tag.");
    return;
  }
  
  const siteId = scriptTag.getAttribute('data-site-id');
  if (!siteId) {
    console.error("SnapMind AI Widget: Missing 'data-site-id' attribute.");
    return;
  }
  
  const apiUrl = scriptTag.getAttribute('data-api-url') || 'http://localhost:8000';
  const themeColor = scriptTag.getAttribute('data-color') || '#7c3aed';
  const apiKey = scriptTag.getAttribute('data-api-key');
  
  // Inject styles
  const style = document.createElement('style');
  style.innerHTML = `
    .sm-widget-root {
      --sm-bg: #080c10;
      --sm-bg2: #141c24;
      --sm-purple: ${themeColor};
      --sm-text: #e8edf2;
      --sm-text-muted: #8a9ab0;
      --sm-border: ${themeColor}33; /* 20% opacity hex */
      font-family: 'Inter', system-ui, sans-serif;
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
    }
    
    .sm-widget-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--sm-purple);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px ${themeColor}66;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }
    .sm-widget-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px ${themeColor}99;
    }
    .sm-widget-btn svg {
      width: 28px;
      height: 28px;
      fill: #fff;
    }
    
    .sm-widget-panel {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 380px;
      height: 520px;
      background: rgba(8, 12, 16, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--sm-border);
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .sm-widget-panel.sm-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    
    .sm-widget-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--sm-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(20, 28, 36, 0.8);
    }
    .sm-widget-title {
      color: var(--sm-text);
      font-weight: 600;
      font-size: 15px;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sm-widget-title svg {
      fill: var(--sm-purple);
      width: 18px;
      height: 18px;
    }
    .sm-widget-close {
      background: transparent;
      border: none;
      color: var(--sm-text-muted);
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }
    .sm-widget-close:hover {
      color: var(--sm-text);
    }
    
    .sm-widget-messages {
      flex: 1;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .sm-widget-message {
      max-width: 85%;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
      color: var(--sm-text);
      word-wrap: break-word;
    }
    .sm-widget-message p {
      margin-top: 0;
      margin-bottom: 8px;
    }
    .sm-widget-message p:last-child {
      margin-bottom: 0;
    }
    .sm-widget-message a {
      color: ${themeColor};
    }
    .sm-widget-message.sm-user {
      align-self: flex-end;
      background: var(--sm-purple);
      border-bottom-right-radius: 2px;
    }
    .sm-widget-message.sm-bot {
      align-self: flex-start;
      background: var(--sm-bg2);
      border: 1px solid var(--sm-border);
      border-bottom-left-radius: 2px;
    }
    .sm-widget-message pre {
      background: #000;
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin-top: 8px;
      font-size: 12px;
    }
    .sm-widget-message code {
      font-family: monospace;
    }
    
    .sm-widget-input-area {
      padding: 16px;
      border-top: 1px solid var(--sm-border);
      background: rgba(20, 28, 36, 0.5);
    }
    .sm-widget-form {
      display: flex;
      gap: 8px;
    }
    .sm-widget-input {
      flex: 1;
      background: var(--sm-bg);
      border: 1px solid var(--sm-border);
      border-radius: 20px;
      padding: 10px 16px;
      color: var(--sm-text);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .sm-widget-input:focus {
      border-color: var(--sm-purple);
    }
    .sm-widget-submit {
      background: var(--sm-purple);
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s;
    }
    .sm-widget-submit:hover {
      transform: scale(1.05);
    }
    .sm-widget-submit svg {
      width: 16px;
      height: 16px;
      fill: #fff;
    }
    
    .sm-typing-indicator {
      display: flex;
      gap: 4px;
      padding: 12px 16px;
      background: var(--sm-bg2);
      border: 1px solid var(--sm-border);
      border-radius: 8px;
      border-bottom-left-radius: 2px;
      align-self: flex-start;
      margin-bottom: 16px;
    }
    .sm-typing-dot {
      width: 6px;
      height: 6px;
      background: var(--sm-text-muted);
      border-radius: 50%;
      animation: sm-typing 1.4s infinite ease-in-out both;
    }
    .sm-typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .sm-typing-dot:nth-child(2) { animation-delay: -0.16s; }
    @keyframes sm-typing {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    
    @media (max-width: 480px) {
      .sm-widget-panel {
        width: calc(100vw - 40px);
        height: 80vh;
        bottom: 80px;
        right: -4px;
      }
    }
  `;
  document.head.appendChild(style);

  // Inject HTML Shell
  const root = document.createElement('div');
  root.className = 'sm-widget-root';
  root.innerHTML = `
    <div class="sm-widget-panel" id="sm-chat-panel">
      <div class="sm-widget-header">
        <h3 class="sm-widget-title">
          <svg viewBox="0 0 18 18"><rect x="2" y="2" width="6" height="6" rx="1"/><rect x="10" y="2" width="6" height="6" rx="1" opacity="0.5"/><rect x="2" y="10" width="6" height="6" rx="1" opacity="0.5"/><rect x="10" y="10" width="6" height="6" rx="1" opacity="0.3"/></svg>
          SnapMind AI
        </h3>
        <button class="sm-widget-close" id="sm-chat-close">&times;</button>
      </div>
      <div class="sm-widget-messages" id="sm-chat-messages">
        <div class="sm-widget-message sm-bot">Hello! I'm trained on this website's content. What can I help you with today?</div>
      </div>
      <div class="sm-widget-input-area">
        <form class="sm-widget-form" id="sm-chat-form">
          <input type="text" class="sm-widget-input" id="sm-chat-input" placeholder="Ask a question..." autocomplete="off">
          <button type="submit" class="sm-widget-submit">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </form>
      </div>
    </div>
    <button class="sm-widget-btn" id="sm-chat-btn">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
  `;
  document.body.appendChild(root);

  // Logic
  const panel = document.getElementById('sm-chat-panel');
  const btn = document.getElementById('sm-chat-btn');
  const closeBtn = document.getElementById('sm-chat-close');
  const form = document.getElementById('sm-chat-form');
  const input = document.getElementById('sm-chat-input');
  const messagesDiv = document.getElementById('sm-chat-messages');
  
  // Create or retrieve a unique session ID for this browser instance to persist chat memory
  let sessionId = localStorage.getItem('sm_widget_session_id');
  if (!sessionId) {
    sessionId = 'widget-' + Math.random().toString(36).substring(2, 10);
    localStorage.setItem('sm_widget_session_id', sessionId);
  }
  
  let isOpen = false;
  
  const togglePanel = () => {
    isOpen = !isOpen;
    if (isOpen) {
      panel.classList.add('sm-open');
      input.focus();
    } else {
      panel.classList.remove('sm-open');
    }
  };
  
  btn.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', togglePanel);
  
  // Basic markdown parser
  const parseMarkdown = (text) => {
    return text
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
  };
  
  // Show typing indicator
  const showTyping = () => {
    const div = document.createElement('div');
    div.className = 'sm-typing-indicator';
    div.id = 'sm-typing';
    div.innerHTML = '<div class="sm-typing-dot"></div><div class="sm-typing-dot"></div><div class="sm-typing-dot"></div>';
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };
  
  const hideTyping = () => {
    const el = document.getElementById('sm-typing');
    if (el) el.remove();
  };
  
  const appendMessage = (text, sender) => {
    const div = document.createElement('div');
    div.className = `sm-widget-message ${sender === 'user' ? 'sm-user' : 'sm-bot'}`;
    div.innerHTML = sender === 'user' ? text : parseMarkdown(text);
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    
    appendMessage(query, 'user');
    input.value = '';
    showTyping();
    
    try {
      const response = await fetch(`${apiUrl}/widget/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(apiKey ? { 'x-gemini-key': apiKey, 'x-mistral-key': apiKey } : {})
        },
        body: JSON.stringify({
          query: query,
          widget_id: siteId,
          session_id: sessionId,
          api_key: apiKey
        })
      });
      
      const data = await response.json();
      hideTyping();
      
      if (data.error) {
        appendMessage('Error: ' + data.error, 'bot');
      } else {
        appendMessage(data.answer || 'No response received from the server.', 'bot');
      }
    } catch (err) {
      hideTyping();
      appendMessage('Could not connect to SnapMind AI server.', 'bot');
      console.error(err);
    }
  });

})();
