document.addEventListener('DOMContentLoaded', () => {
  // Extract agent ID from pathname /widget/:agentId or search params
  const pathParts = window.location.pathname.split('/');
  const agentIdFromPath = pathParts[pathParts.length - 1];
  const urlParams = new URLSearchParams(window.location.search);
  const agentId = urlParams.get('agentId') || (agentIdFromPath !== 'widget' && agentIdFromPath !== 'widget.html' ? agentIdFromPath : 'agent_digital_agency');

  // DOM Elements
  const agentAvatar = document.getElementById('agentAvatar');
  const agentName = document.getElementById('agentName');
  const agentService = document.getElementById('agentService');
  const voiceLangSelect = document.getElementById('voiceLangSelect');
  const muteBtn = document.getElementById('muteBtn');
  const soundOnIcon = document.getElementById('soundOnIcon');
  const soundOffIcon = document.getElementById('soundOffIcon');
  const closeWidgetBtn = document.getElementById('closeWidgetBtn');

  // Mode Switcher Elements
  const switchVoiceBtn = document.getElementById('switchVoiceBtn');
  const switchTextBtn = document.getElementById('switchTextBtn');
  const voiceView = document.getElementById('voiceView');
  const textChatView = document.getElementById('textChatView');
  const voiceFooter = document.getElementById('voiceFooter');
  const footerSwitchTextBtn = document.getElementById('footerSwitchTextBtn');

  // Voice View Elements
  const visualizerStage = document.getElementById('visualizerStage');
  const statusPill = document.getElementById('statusPill');
  const statusLabel = document.getElementById('statusLabel');
  const liveSpeaker = document.getElementById('liveSpeaker');
  const liveTime = document.getElementById('liveTime');
  const liveSubtitleText = document.getElementById('liveSubtitleText');
  const micToggleBtn = document.getElementById('micToggleBtn');
  const openFormBtn = document.getElementById('openFormBtn');

  // Text Chat View Elements
  const chatMessagesContainer = document.getElementById('chatMessagesContainer');
  const chatInputBar = document.getElementById('chatInputBar');
  const chatInputField = document.getElementById('chatInputField');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatMicShortcutBtn = document.getElementById('chatMicShortcutBtn');
  const chipOpenForm = document.getElementById('chipOpenForm');

  // Lead Form Elements
  const confirmationCard = document.getElementById('confirmationCard');
  const closeConfirmCardBtn = document.getElementById('closeConfirmCardBtn');
  const leadSubmissionForm = document.getElementById('leadSubmissionForm');
  const leadName = document.getElementById('leadName');
  const leadPhone = document.getElementById('leadPhone');
  const leadEmail = document.getElementById('leadEmail');
  const leadBudget = document.getElementById('leadBudget');
  const leadTime = document.getElementById('leadTime');
  const leadNotes = document.getElementById('leadNotes');
  const submitLeadBtn = document.getElementById('submitLeadBtn');
  const submitLeadBtnText = document.getElementById('submitLeadBtnText');
  const successBanner = document.getElementById('successBanner');

  // State
  let currentAgent = null;
  let currentMode = 'voice'; // 'voice' | 'text'
  let isMuted = false;
  let isListening = false;
  let isSpeaking = false;
  let conversationHistory = [];
  let recognition = null;
  let synth = window.speechSynthesis || null;
  let availableVoices = [];

  const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';

  // Format current time
  function getNowTime() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Load Voices
  function loadVoices() {
    if (!synth) return;
    availableVoices = synth.getVoices();
  }
  if (synth) {
    loadVoices();
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = loadVoices;
    }
  }

  // Visualizer States: 'idle' | 'listening' | 'thinking' | 'speaking'
  function setAgentState(state, label) {
    if (!visualizerStage || !statusPill) return;
    visualizerStage.className = 'visualizer-stage';
    statusPill.className = 'status-pill';

    if (state === 'listening') {
      visualizerStage.classList.add('state-listening');
      statusPill.classList.add('state-listening');
      statusLabel.textContent = label || 'Listening to you...';
      if (micToggleBtn) micToggleBtn.classList.add('active');
      if (chatMicShortcutBtn) chatMicShortcutBtn.classList.add('active');
    } else if (state === 'thinking') {
      visualizerStage.classList.add('state-thinking');
      statusPill.classList.add('state-thinking');
      statusLabel.textContent = label || (currentMode === 'text' ? 'AI is typing...' : 'AI is thinking...');
      if (micToggleBtn) micToggleBtn.classList.remove('active');
      if (chatMicShortcutBtn) chatMicShortcutBtn.classList.remove('active');
    } else if (state === 'speaking') {
      visualizerStage.classList.add('state-speaking');
      statusPill.classList.add('state-speaking');
      statusLabel.textContent = label || `${currentAgent?.name || 'Agent'} is speaking...`;
      if (micToggleBtn) micToggleBtn.classList.remove('active');
      if (chatMicShortcutBtn) chatMicShortcutBtn.classList.remove('active');
    } else {
      statusLabel.textContent = label || (currentMode === 'text' ? 'Ready to chat' : 'Tap Mic to Speak');
      if (micToggleBtn) micToggleBtn.classList.remove('active');
      if (chatMicShortcutBtn) chatMicShortcutBtn.classList.remove('active');
    }
  }

  // Update Subtitle
  function updateSubtitle(speaker, text) {
    if (!liveSpeaker || !liveSubtitleText) return;
    liveSpeaker.textContent = speaker;
    if (liveTime) liveTime.textContent = getNowTime();
    liveSubtitleText.textContent = `"${text}"`;
  }

  // Add message bubble to chat view
  function renderMessageBubble(role, text, time) {
    if (!chatMessagesContainer) return;
    const msgTime = time || getNowTime();
    const row = document.createElement('div');
    row.className = `chat-bubble-row ${role}`;

    const isAgent = role === 'agent';
    const avatarHtml = isAgent
      ? `<img src="${currentAgent?.avatar || defaultAvatar}" alt="Agent" class="chat-row-avatar">`
      : '';

    row.innerHTML = `
      ${avatarHtml}
      <div class="bubble-content">
        <div class="chat-bubble">${text}</div>
        <div class="bubble-meta">${isAgent ? (currentAgent?.name || 'AI') : 'You'} &bull; ${msgTime}</div>
      </div>
    `;

    chatMessagesContainer.appendChild(row);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  // Typing indicator
  let typingBubbleEl = null;
  function showTypingIndicator() {
    if (typingBubbleEl || !chatMessagesContainer) return;
    typingBubbleEl = document.createElement('div');
    typingBubbleEl.className = 'chat-bubble-row agent';
    typingBubbleEl.innerHTML = `
      <img src="${currentAgent?.avatar || defaultAvatar}" alt="Agent" class="chat-row-avatar">
      <div class="typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    chatMessagesContainer.appendChild(typingBubbleEl);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    if (typingBubbleEl && typingBubbleEl.parentNode) {
      typingBubbleEl.parentNode.removeChild(typingBubbleEl);
    }
    typingBubbleEl = null;
  }

  // Switch Mode (Voice vs Text)
  function setMode(mode) {
    currentMode = mode;

    // Stop ongoing recognition and speech
    if (isListening && recognition) {
      try { recognition.stop(); } catch (e) {}
      isListening = false;
    }
    if (synth) {
      synth.cancel();
    }
    setAgentState('idle');

    if (mode === 'text') {
      switchTextBtn.className = 'mode-switch-btn active mode-text';
      switchVoiceBtn.className = 'mode-switch-btn';
      voiceView.style.display = 'none';
      if (voiceFooter) voiceFooter.style.display = 'none';
      textChatView.style.display = 'flex';
      if (submitLeadBtnText) submitLeadBtnText.textContent = 'Confirm & Email via Text Chat';

      // Focus input
      setTimeout(() => {
        if (chatInputField) chatInputField.focus();
        if (chatMessagesContainer) chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
      }, 100);
    } else {
      switchVoiceBtn.className = 'mode-switch-btn active mode-voice';
      switchTextBtn.className = 'mode-switch-btn';
      textChatView.style.display = 'none';
      voiceView.style.display = 'flex';
      if (voiceFooter) voiceFooter.style.display = 'flex';
      if (submitLeadBtnText) submitLeadBtnText.textContent = 'Confirm & Email via Voice Agent';
    }
  }

  if (switchVoiceBtn) switchVoiceBtn.addEventListener('click', () => setMode('voice'));
  if (switchTextBtn) switchTextBtn.addEventListener('click', () => setMode('text'));
  if (footerSwitchTextBtn) footerSwitchTextBtn.addEventListener('click', () => setMode('text'));

  // Language change
  if (voiceLangSelect) {
    voiceLangSelect.addEventListener('change', (e) => {
      if (recognition) recognition.lang = e.target.value;
    });
  }

  // Speak AI text
  function speakText(text, callback) {
    if (isMuted || !synth) {
      if (callback) callback();
      return;
    }

    synth.cancel();
    const cleanText = text.replace(/[*_#`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (availableVoices.length > 0) {
      const preferred = availableVoices.find(v =>
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny')) && v.lang.startsWith('en')
      ) || availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
      if (preferred) utterance.voice = preferred;
    }

    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      setAgentState('speaking', `${currentAgent?.name || 'Agent'} is speaking...`);
    };

    utterance.onend = () => {
      isSpeaking = false;
      setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Tap Mic to Speak');
      if (callback) callback();
    };

    utterance.onerror = (e) => {
      console.warn('Speech error:', e);
      isSpeaking = false;
      setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Tap Mic to Speak');
      if (callback) callback();
    };

    synth.speak(utterance);
  }

  // Speech Recognition
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported.');
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = voiceLangSelect ? voiceLangSelect.value : 'ur-PK';

    recognition.onstart = () => {
      isListening = true;
      setAgentState('listening', 'Listening to you...');
      if (synth && synth.speaking) synth.cancel();
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (interimTranscript) {
        updateSubtitle('You', interimTranscript);
      }

      if (finalTranscript) {
        const userText = finalTranscript.trim();
        handleUserMessage(userText);
      }
    };

    recognition.onerror = () => {
      isListening = false;
      setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Tap Mic to Speak');
    };

    recognition.onend = () => {
      isListening = false;
      if (!isSpeaking) {
        setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Tap Mic to Speak');
      }
    };
  }
  initSpeechRecognition();

  function toggleMic() {
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome/Edge or switch to Text Chat mode.');
      return;
    }

    if (isListening) {
      try { recognition.stop(); } catch (e) {}
      isListening = false;
      setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Tap Mic to Speak');
    } else {
      if (synth) synth.cancel();
      try {
        if (voiceLangSelect) recognition.lang = voiceLangSelect.value;
        recognition.start();
      } catch (err) {
        console.warn('Mic start error:', err);
      }
    }
  }

  if (micToggleBtn) micToggleBtn.addEventListener('click', toggleMic);
  if (chatMicShortcutBtn) chatMicShortcutBtn.addEventListener('click', toggleMic);

  // Send message to AI backend
  async function handleUserMessage(userText) {
    if (!userText || !userText.trim()) return;

    const time = getNowTime();
    conversationHistory.push({ role: 'customer', text: userText, timestamp: time });
    updateSubtitle('You', userText);
    renderMessageBubble('customer', userText, time);

    setAgentState('thinking', currentMode === 'text' ? 'AI is typing...' : 'AI is thinking...');
    if (currentMode === 'text') showTypingIndicator();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: currentAgent?.id || agentId,
          message: userText,
          conversationHistory: conversationHistory,
          mode: currentMode
        })
      });

      const data = await res.json();
      hideTypingIndicator();

      if (data.success && data.response) {
        const agentReply = data.response;
        const agentTime = getNowTime();
        conversationHistory.push({ role: 'agent', text: agentReply, timestamp: agentTime });

        updateSubtitle(currentAgent?.name || 'AI Agent', agentReply);
        renderMessageBubble('agent', agentReply, agentTime);

        // Pre-fill form if info detected
        if (data.detectedInfo) {
          if (data.detectedInfo.name && !leadName.value) leadName.value = data.detectedInfo.name;
          if (data.detectedInfo.email && !leadEmail.value) leadEmail.value = data.detectedInfo.email;
          if (data.detectedInfo.phone && !leadPhone.value) leadPhone.value = data.detectedInfo.phone;
        }

        if (data.bookingConfirmed) {
          const banner = document.createElement('div');
          banner.style.cssText = 'background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; border-radius: 12px; padding: 12px 14px; color: #6ee7b7; font-size: 12px; font-weight: 600; text-align: center; margin: 8px 0;';
          banner.innerHTML = `🎉 <strong>Booking Confirmed via ${currentMode === 'text' ? 'Text Chat' : 'Voice Agent'}!</strong> Full transcript and details dispatched to your email.`;
          chatMessagesContainer.appendChild(banner);
          chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }

        // Speak aloud in voice mode, or in text mode if not muted
        if (currentMode === 'voice' || !isMuted) {
          speakText(agentReply);
        } else {
          setAgentState('idle', 'Ready to chat');
        }
      } else {
        setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Ready to Talk');
      }
    } catch (err) {
      console.error('Chat API error:', err);
      hideTypingIndicator();
      setAgentState('idle', currentMode === 'text' ? 'Ready to chat' : 'Ready to Talk');
    }
  }

  // Handle Text Chat Submission
  if (chatInputBar) {
    chatInputBar.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = chatInputField.value.trim();
      if (!val) return;
      chatInputField.value = '';
      handleUserMessage(val);
    });
  }

  // Quick Chips click handler
  document.querySelectorAll('.quick-chip[data-chip]').forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-chip');
      if (query) handleUserMessage(query);
    });
  });

  if (chipOpenForm) {
    chipOpenForm.addEventListener('click', () => {
      confirmationCard.classList.add('open');
    });
  }

  // Lead Form Drawer Handlers
  if (openFormBtn) {
    openFormBtn.addEventListener('click', () => {
      confirmationCard.classList.add('open');
    });
  }

  if (closeConfirmCardBtn) {
    closeConfirmCardBtn.addEventListener('click', () => {
      confirmationCard.classList.remove('open');
    });
  }

  if (leadSubmissionForm) {
    leadSubmissionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitLeadBtn.disabled = true;
      submitLeadBtn.textContent = 'Dispatching...';

      const payload = {
        agentId: currentAgent?.id || agentId,
        customerName: leadName.value.trim(),
        customerPhone: leadPhone.value.trim(),
        customerEmail: leadEmail.value.trim(),
        budget: leadBudget.value.trim(),
        preferredTime: leadTime.value.trim(),
        notes: leadNotes.value.trim(),
        transcript: conversationHistory,
        mode: currentMode,
        leadSource: currentMode === 'text' ? 'Text Chat' : 'Voice Agent'
      };

      try {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          successBanner.style.display = 'block';
          leadSubmissionForm.style.display = 'none';
          const confirmText = 'Thank you! Your inquiry details and full conversation transcript have been sent to your email.';
          updateSubtitle(currentAgent?.name || 'AI Agent', confirmText);
          if (!isMuted) speakText(confirmText);

          setTimeout(() => {
            confirmationCard.classList.remove('open');
            successBanner.style.display = 'none';
            leadSubmissionForm.style.display = 'block';
            submitLeadBtn.disabled = false;
            submitLeadBtn.textContent = 'Confirm & Email Details';
          }, 3500);
        } else {
          alert('Submission error: ' + (data.error || 'Server error'));
          submitLeadBtn.disabled = false;
          submitLeadBtn.textContent = 'Confirm & Email Details';
        }
      } catch (err) {
        alert('Network error: ' + err.message);
        submitLeadBtn.disabled = false;
        submitLeadBtn.textContent = 'Confirm & Email Details';
      }
    });
  }

  // Mute / Unmute
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      if (isMuted) {
        soundOnIcon.style.display = 'none';
        soundOffIcon.style.display = 'block';
        if (synth) synth.cancel();
        setAgentState('idle');
      } else {
        soundOnIcon.style.display = 'block';
        soundOffIcon.style.display = 'none';
      }
    });
  }

  // Close widget
  if (closeWidgetBtn) {
    closeWidgetBtn.addEventListener('click', () => {
      window.parent.postMessage({ type: 'AI_VOICE_AGENT_CLOSE' }, '*');
    });
  }

  // Fetch agent details
  async function loadAgent() {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = await res.json();
      if (data.success && data.agent) {
        currentAgent = data.agent;
        if (agentName) agentName.textContent = currentAgent.name;
        if (agentService) agentService.textContent = currentAgent.serviceName;
        if (agentAvatar && currentAgent.avatar) agentAvatar.src = currentAgent.avatar;

        const welcome = currentAgent.welcomeMessage || 'Hi there! How can I assist you today? Feel free to talk or text!';
        updateSubtitle(currentAgent.name, welcome);

        // Initial agent message in chat thread
        renderMessageBubble('agent', welcome, getNowTime());

        setTimeout(() => {
          speakText(welcome);
        }, 800);
      }
    } catch (err) {
      console.error('Failed to load agent:', err);
    }
  }

  loadAgent();
});
