(function() {
  // Prevent multiple initializations
  if (window.__AIVoiceAgentInitialized) return;
  window.__AIVoiceAgentInitialized = true;

  // Find the script tag that loaded this script
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const agentId = currentScript.getAttribute('data-agent-id') || 'agent_digital_agency';
  const customColor = currentScript.getAttribute('data-primary-color') || '#6366f1';
  const position = currentScript.getAttribute('data-position') || 'right'; // 'right' or 'left'

  // Extract base server URL from script src
  let serverBaseUrl = '';
  if (currentScript.src) {
    try {
      const url = new URL(currentScript.src);
      serverBaseUrl = `${url.protocol}//${url.host}`;
    } catch (e) {
      serverBaseUrl = window.location.origin;
    }
  } else {
    serverBaseUrl = window.location.origin;
  }

  const widgetUrl = `${serverBaseUrl}/widget/${agentId}`;

  // Create Container
  const container = document.createElement('div');
  container.id = 'ai-voice-agent-root';
  container.style.cssText = `
    position: fixed;
    bottom: 24px;
    ${position === 'left' ? 'left: 24px;' : 'right: 24px;'}
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // Create Floating Action Button
  const btn = document.createElement('button');
  btn.id = 'ai-voice-trigger-btn';
  btn.setAttribute('aria-label', 'Open AI Voice Agent');
  btn.style.cssText = `
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, ${customColor}, #8b5cf6);
    border: none;
    box-shadow: 0 8px 32px rgba(99, 102, 241, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    outline: none;
  `;

  // Glowing pulse rings
  const pulseRing = document.createElement('div');
  pulseRing.style.cssText = `
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: 50%;
    border: 2px solid ${customColor};
    animation: ai-pulse 2s cubic-bezier(0.24, 0, 0.38, 1) infinite;
    pointer-events: none;
    opacity: 0.8;
  `;

  // Audio / Mic Icon
  btn.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
  `;

  // Badge notification
  const badge = document.createElement('div');
  badge.id = 'ai-voice-badge';
  badge.innerText = 'Talk with AI';
  badge.style.cssText = `
    position: absolute;
    top: -12px;
    right: -6px;
    background: #10b981;
    color: white;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.4);
    letter-spacing: 0.3px;
    pointer-events: none;
    white-space: nowrap;
    animation: bounce 2.5s infinite;
  `;

  btn.appendChild(pulseRing);
  btn.appendChild(badge);

  // Create Iframe Modal Window
  const modal = document.createElement('div');
  modal.id = 'ai-voice-modal';
  modal.style.cssText = `
    position: fixed;
    bottom: 100px;
    ${position === 'left' ? 'left: 24px;' : 'right: 24px;'}
    width: 390px;
    height: 610px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 120px);
    background: #0f172a;
    border-radius: 24px;
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.12);
    overflow: hidden;
    display: none;
    flex-direction: column;
    z-index: 2147483647;
    transform: translateY(20px) scale(0.95);
    opacity: 0;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  `;

  // Iframe Element
  const iframe = document.createElement('iframe');
  iframe.src = widgetUrl;
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    background: transparent;
  `;
  iframe.setAttribute('allow', 'microphone; speech-recognition; autoplay');
  iframe.setAttribute('title', 'AI Voice Sales Agent');

  modal.appendChild(iframe);
  container.appendChild(modal);
  container.appendChild(btn);
  document.body.appendChild(container);

  // Add Keyframe Animations to DOM
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @keyframes ai-pulse {
      0% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.4); opacity: 0; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    #ai-voice-trigger-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 40px rgba(99, 102, 241, 0.6);
    }
    @media (max-width: 480px) {
      #ai-voice-modal {
        width: calc(100vw - 20px) !important;
        height: calc(100vh - 90px) !important;
        bottom: 80px !important;
        right: 10px !important;
        left: 10px !important;
        border-radius: 20px !important;
      }
    }
  `;
  document.head.appendChild(styleTag);

  // State
  let isOpen = false;

  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.style.transform = 'translateY(0) scale(1)';
        modal.style.opacity = '1';
      }, 10);
      btn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      badge.style.display = 'none';
    } else {
      modal.style.transform = 'translateY(20px) scale(0.95)';
      modal.style.opacity = '0';
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
      btn.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" x2="12" y2="22"></line>
        </svg>
      `;
      btn.appendChild(pulseRing);
      btn.appendChild(badge);
      badge.style.display = 'block';
    }
  }

  btn.addEventListener('click', toggleWidget);

  // Listen for close message from iframe
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'AI_VOICE_AGENT_CLOSE') {
      if (isOpen) toggleWidget();
    }
  });

})();
