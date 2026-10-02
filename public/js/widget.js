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
  const muteBtn = document.getElementById('muteBtn');
  const soundOnIcon = document.getElementById('soundOnIcon');
  const soundOffIcon = document.getElementById('soundOffIcon');
  const closeWidgetBtn = document.getElementById('closeWidgetBtn');
  
  const tabVoiceBtn = document.getElementById('tabVoiceBtn');
  const tabChatBtn = document.getElementById('tabChatBtn');
  const voiceView = document.getElementById('voiceView');
  const chatView = document.getElementById('chatView');
  const transcriptCount = document.getElementById('transcriptCount');

  const visualizerStage = document.getElementById('visualizerStage');
  const statusPill = document.getElementById('statusPill');
  const statusLabel = document.getElementById('statusLabel');
  const liveSpeaker = document.getElementById('liveSpeaker');
  const liveTime = document.getElementById('liveTime');
  const liveSubtitleText = document.getElementById('liveSubtitleText');

  const micToggleBtn = document.getElementById('micToggleBtn');
  const toggleKeyboardBtn = document.getElementById('toggleKeyboardBtn');
  const openFormBtn = document.getElementById('openFormBtn');
  const textDrawer = document.getElementById('textDrawer');
  const textInput = document.getElementById('textInput');
  const sendTextBtn = document.getElementById('sendTextBtn');

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
  const successBanner = document.getElementById('successBanner');

  // State
  let currentAgent = null;
  let isMuted = false;
  let isListening = false;
  let isSpeaking = false;
  let conversationHistory = []; // { role: 'agent'|'customer', text, timestamp }
  let recognition = null;
  let synth = window.speechSynthesis || null;
  let availableVoices = [];

  // Voice synthesis voice selector
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
    visualizerStage.className = 'visualizer-stage';
    statusPill.className = 'status-pill';

    if (state === 'listening') {
      visualizerStage.classList.add('state-listening');
      statusPill.classList.add('state-listening');
      statusLabel.textContent = label || 'Listening to you...';
      micToggleBtn.classList.add('active');
    } else if (state === 'thinking') {
      visualizerStage.classList.add('state-thinking');
      statusPill.classList.add('state-thinking');
      statusLabel.textContent = label || 'AI is thinking...';
      micToggleBtn.classList.remove('active');
    } else if (state === 'speaking') {
      visualizerStage.classList.add('state-speaking');
      statusPill.classList.add('state-speaking');
      statusLabel.textContent = label || 'Agent is speaking...';
      micToggleBtn.classList.remove('active');
    } else {
      statusLabel.textContent = label || 'Tap Mic to Speak';
      micToggleBtn.classList.remove('active');
    }
  }

  // Format current time HH:MM
  function getNowTime() {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Update Live Subtitle Box
  function updateSubtitle(speaker, text) {
    liveSpeaker.textContent = speaker;
    liveTime.textContent = getNowTime();
    liveSubtitleText.textContent = `"${text}"`;
  }

  // Add message to chat view and memory
  function addMessage(role, text) {
    const time = getNowTime();
    conversationHistory.push({ role, text, timestamp: time });
    transcriptCount.textContent = conversationHistory.length;

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    bubble.innerHTML = `
      <div>${text}</div>
      <span class="bubble-time">${role === 'agent' ? (currentAgent?.name || 'Agent') : 'You'} &bull; ${time}</span>
    `;
    chatView.appendChild(bubble);
    chatView.scrollTop = chatView.scrollHeight;

    // Check for contact details extracted
    extractLeadDetailsFromText(text);
  }

  // Regex parser to auto-fill form as user speaks
  function extractLeadDetailsFromText(text) {
    if (!text) return;
    // Email regex
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !leadEmail.value) {
      leadEmail.value = emailMatch[0];
      highlightInput(leadEmail);
    }
    // Phone regex
    const phoneMatch = text.match(/(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d]{3}[-.\s]?[\d]{4}/);
    if (phoneMatch && !leadPhone.value && phoneMatch[0].length >= 7) {
      leadPhone.value = phoneMatch[0].trim();
      highlightInput(leadPhone);
    }
    // Name regex patterns (e.g. "my name is Alex", "I am Tariq")
    const nameMatch = text.match(/(?:my name is|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    if (nameMatch && nameMatch[1] && !leadName.value) {
      leadName.value = nameMatch[1].trim();
      highlightInput(leadName);
    }
  }

  function highlightInput(inputEl) {
    inputEl.style.borderColor = '#10b981';
    inputEl.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
    setTimeout(() => {
      inputEl.style.borderColor = '';
      inputEl.style.boxShadow = '';
    }, 2000);
  }

  // Speak AI text out loud using browser SpeechSynthesis
  function speakText(text, callback) {
    if (isMuted || !synth) {
      if (callback) callback();
      return;
    }

    synth.cancel(); // Stop any pending speech

    const cleanText = text.replace(/[*_#`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Pick a natural voice (prefer Google, Microsoft Natural, Samantha, or any English voice)
    if (availableVoices.length > 0) {
      const preferred = availableVoices.find(v => 
        (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Jenny')) && v.lang.startsWith('en')
      ) || availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];

      if (preferred) utterance.voice = preferred;
    }

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      setAgentState('speaking', `${currentAgent?.name || 'Agent'} is speaking...`);
    };

    utterance.onend = () => {
      isSpeaking = false;
      setAgentState('idle', 'Tap Mic to Speak');
      if (callback) callback();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      isSpeaking = false;
      setAgentState('idle', 'Tap Mic to Speak');
      if (callback) callback();
    };

    synth.speak(utterance);
  }

  // Initialize Speech Recognition (STT)
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech Recognition API not supported in this browser.');
      statusLabel.textContent = 'Voice not supported (use Type)';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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
        updateSubtitle('You', userText);
        addMessage('customer', userText);
        sendUserMessageToAI(userText);
      }
    };

    recognition.onerror = (event) => {
      console.log('Speech recognition event:', event.error);
      isListening = false;
      setAgentState('idle', 'Tap Mic to Speak');
    };

    recognition.onend = () => {
      isListening = false;
      if (!isSpeaking) {
        setAgentState('idle', 'Tap Mic to Speak');
      }
    };
  }

  function toggleListening() {
    if (!recognition) {
      initSpeechRecognition();
      if (!recognition) {
        alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or use the "Type" button.');
        return;
      }
    }

    if (isListening) {
      recognition.stop();
      isListening = false;
      setAgentState('idle', 'Tap Mic to Speak');
    } else {
      if (synth && synth.speaking) synth.cancel();
      try {
        recognition.start();
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  }

  // Send User Message to AI Backend (/api/chat)
  async function sendUserMessageToAI(message) {
    if (!message) return;

    setAgentState('thinking', 'AI is thinking...');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: currentAgent?.id || agentId,
          message: message,
          conversationHistory: conversationHistory
        })
      });

      const data = await res.json();

      if (data.success && data.response) {
        const agentReply = data.response;
        updateSubtitle(currentAgent?.name || 'Agent', agentReply);
        addMessage('agent', agentReply);

        // Check if agent suggested closing / confirmation -> slide in confirmation card
        const lowerReply = agentReply.toLowerCase();
        if (
          lowerReply.includes('email') ||
          lowerReply.includes('phone') ||
          lowerReply.includes('confirm') ||
          lowerReply.includes('consultation') ||
          lowerReply.includes('booking') ||
          lowerReply.includes('lock in')
        ) {
          openConfirmationCard();
        }

        // Speak aloud
        speakText(agentReply);
      } else {
        const fallback = "I'm having a slight connection glitch, but I'd love to help you book our service. Feel free to confirm your email in the form below!";
        updateSubtitle(currentAgent?.name || 'Agent', fallback);
        addMessage('agent', fallback);
        speakText(fallback);
      }
    } catch (err) {
      console.error('Chat API Error:', err);
      const errText = "I heard you! Let's lock in your requirements. Please confirm your contact details in the form so we can email you the full proposal.";
      updateSubtitle(currentAgent?.name || 'Agent', errText);
      addMessage('agent', errText);
      speakText(errText);
      openConfirmationCard();
    }
  }

  // Load Agent Data from API
  async function loadAgent() {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const data = await res.json();

      if (data.success && data.agent) {
        currentAgent = data.agent;
        applyAgentBranding(currentAgent);
      } else {
        // Fallback default
        currentAgent = {
          id: 'agent_digital_agency',
          name: 'Alex - Growth Advisor',
          serviceName: 'Web & AI Voice Solutions',
          primaryColor: '#6366f1',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          welcomeMessage: "Hi there! I am Alex. We build high-converting websites and AI voice agents that 3x sales. Are you looking to build a new website or automate your lead calls?"
        };
        applyAgentBranding(currentAgent);
      }

      // Initial Greeting
      const welcome = currentAgent.welcomeMessage || `Hello! I'm ${currentAgent.name}. How can I assist you with ${currentAgent.serviceName} today?`;
      updateSubtitle(currentAgent.name, welcome);
      addMessage('agent', welcome);
      
      // Auto-speak greeting after a short friendly delay
      setTimeout(() => {
        speakText(welcome);
      }, 600);

    } catch (err) {
      console.error('Failed to load agent:', err);
    }
  }

  function applyAgentBranding(agent) {
    if (agent.name) agentName.textContent = agent.name;
    if (agent.serviceName) agentService.textContent = agent.serviceName;
    if (agent.avatar) agentAvatar.src = agent.avatar;

    if (agent.primaryColor) {
      document.documentElement.style.setProperty('--primary', agent.primaryColor);
      document.documentElement.style.setProperty('--primary-glow', `${agent.primaryColor}66`);
    }
  }

  // Form Submission (Saves Lead + Sends Rich Email with Full Transcript)
  leadSubmissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitLeadBtn.disabled = true;
    submitLeadBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>
      Sending Email & Transcript...
    `;

    const payload = {
      agentId: currentAgent?.id || agentId,
      customerName: leadName.value.trim(),
      customerEmail: leadEmail.value.trim(),
      customerPhone: leadPhone.value.trim(),
      budget: leadBudget.value.trim(),
      preferredTime: leadTime.value.trim(),
      notes: leadNotes.value.trim(),
      transcript: conversationHistory,
      summary: `Lead confirmed via voice agent for ${currentAgent?.serviceName || 'Service'}. Customer requested confirmation and complete transcript sent to ${leadEmail.value.trim()}.`
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

        const successMsg = `Thank you ${payload.customerName}! Your confirmation has been locked in. The complete conversation transcript and requirements have been dispatched to your email.`;
        updateSubtitle(currentAgent?.name || 'Agent', successMsg);
        addMessage('agent', successMsg);
        speakText(successMsg);

        setTimeout(() => {
          confirmationCard.classList.remove('open');
        }, 4000);
      } else {
        alert('Could not submit form: ' + (data.error || 'Server error'));
        submitLeadBtn.disabled = false;
        submitLeadBtn.textContent = 'Try Again';
      }
    } catch (err) {
      console.error('Lead submission failed:', err);
      alert('Error submitting details: ' + err.message);
      submitLeadBtn.disabled = false;
      submitLeadBtn.textContent = 'Confirm & Email Complete Details';
    }
  });

  // UI Event Handlers
  micToggleBtn.addEventListener('click', toggleListening);

  // Mute / Unmute
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      if (synth && synth.speaking) synth.cancel();
      soundOnIcon.style.display = 'none';
      soundOffIcon.style.display = 'block';
      statusLabel.textContent = 'Voice Muted (Audio Off)';
    } else {
      soundOnIcon.style.display = 'block';
      soundOffIcon.style.display = 'none';
      statusLabel.textContent = 'Voice Unmuted';
    }
  });

  // Close / Minimize Modal
  closeWidgetBtn.addEventListener('click', () => {
    if (synth && synth.speaking) synth.cancel();
    if (isListening && recognition) recognition.stop();
    // Post message to parent window if running inside iframe
    window.parent.postMessage({ type: 'AI_VOICE_AGENT_CLOSE' }, '*');
  });

  // Tab Switching
  tabVoiceBtn.addEventListener('click', () => {
    tabVoiceBtn.classList.add('active');
    tabChatBtn.classList.remove('active');
    voiceView.style.display = 'flex';
    chatView.style.display = 'none';
  });

  tabChatBtn.addEventListener('click', () => {
    tabChatBtn.classList.add('active');
    tabVoiceBtn.classList.remove('active');
    voiceView.style.display = 'none';
    chatView.style.display = 'flex';
  });

  // Keyboard Drawer Toggle
  toggleKeyboardBtn.addEventListener('click', () => {
    textDrawer.classList.toggle('open');
    if (textDrawer.classList.contains('open')) {
      textInput.focus();
    }
  });

  // Send Text Message
  function handleSendText() {
    const text = textInput.value.trim();
    if (!text) return;

    textInput.value = '';
    textDrawer.classList.remove('open');

    updateSubtitle('You', text);
    addMessage('customer', text);
    sendUserMessageToAI(text);
  }

  sendTextBtn.addEventListener('click', handleSendText);
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendText();
  });

  // Confirmation Card Open/Close
  function openConfirmationCard() {
    confirmationCard.classList.add('open');
  }

  openFormBtn.addEventListener('click', () => {
    confirmationCard.classList.toggle('open');
  });

  closeConfirmCardBtn.addEventListener('click', () => {
    confirmationCard.classList.remove('open');
  });

  // Initialize
  initSpeechRecognition();
  loadAgent();
});
