'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';

export default function WidgetPage() {
  const params = useParams();
  const agentId = params?.agentId || 'agent_digital_agency';

  // Agent State
  const [agent, setAgent] = useState(null);
  const [activeView, setActiveView] = useState('voice'); // 'voice' | 'chat'
  const [isMuted, setIsMuted] = useState(false);
  const [voiceLang, setVoiceLang] = useState('ur-PK'); // 'ur-PK' | 'en-US' | 'hi-IN'
  const [isListening, setIsListening] = useState(false);
  const [agentState, setAgentState] = useState('idle'); // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [statusText, setStatusText] = useState('Ready to Talk');

  // Subtitles & History
  const [subtitle, setSubtitle] = useState({
    speaker: 'AI Agent',
    text: 'Hi there! Tap the microphone below to start talking, or ask me any question about our services.',
    time: 'Just now'
  });
  const [conversationHistory, setConversationHistory] = useState([]);

  // Drawers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isTextDrawerOpen, setIsTextDrawerOpen] = useState(false);
  const [typedMessage, setTypedMessage] = useState('');

  // Lead Form Data
  const [leadFormData, setLeadFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    budget: '',
    preferredTime: '',
    notes: '',
  });
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  // Audio References
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Time formatter
  const getNowTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Fetch Agent Details
  useEffect(() => {
    async function fetchAgentData() {
      try {
        const res = await fetch(`/api/agents/${agentId}`);
        const data = await res.json();
        if (data.success && data.agent) {
          setAgent(data.agent);
          const welcome = data.agent.welcomeMessage || 'Hi there! How can I assist you today?';
          setSubtitle({
            speaker: data.agent.name || 'AI Agent',
            text: welcome,
            time: getNowTime()
          });

          // Speak initial greeting if speech synthesis available
          setTimeout(() => {
            speakText(welcome, data.agent);
          }, 800);
        }
      } catch (err) {
        console.error('Failed to load agent:', err);
      }
    }

    if (agentId) {
      fetchAgentData();
    }
  }, [agentId]);

  // Speech Recognition & Synthesis Setup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.lang = voiceLang;

        recog.onstart = () => {
          setIsListening(true);
          setAgentState('listening');
          setStatusText('Listening to you...');
        };

        recog.onresult = (event) => {
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
            setSubtitle({
              speaker: 'You (Speaking)',
              text: interimTranscript,
              time: getNowTime()
            });
          }

          if (finalTranscript) {
            handleUserMessage(finalTranscript.trim());
          }
        };

        recog.onerror = (event) => {
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          setAgentState('idle');
          setStatusText('Tap Mic to Speak');
        };

        recog.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recog;
      }
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Scroll Chat to Bottom
  useEffect(() => {
    if (activeView === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationHistory, activeView]);

  // Speak Text via TTS
  const speakText = (text, agentObj = agent) => {
    if (isMuted || !synthRef.current) return;

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v =>
      v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setAgentState('speaking');
      setStatusText('Agent is speaking...');
    };

    utterance.onend = () => {
      setAgentState('idle');
      setStatusText('Ready to Talk');
    };

    utterance.onerror = () => {
      setAgentState('idle');
      setStatusText('Ready to Talk');
    };

    synthRef.current.speak(utterance);
  };

  // Toggle Microphone
  const toggleMicrophone = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or use Type mode below.');
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
      setAgentState('idle');
      setStatusText('Tap Mic to Speak');
    } else {
      if (synthRef.current) synthRef.current.cancel();
      try {
        if (recognitionRef.current) recognitionRef.current.lang = voiceLang;
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Recognition start error:', e);
      }
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted && synthRef.current) {
      synthRef.current.cancel();
      setAgentState('idle');
    }
  };

  // Close / Minimize
  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.parent.postMessage({ type: 'AI_VOICE_AGENT_CLOSE' }, '*');
    }
  };

  // Handle User Utterance / Message
  const handleUserMessage = async (text) => {
    if (!text.trim()) return;

    const userEntry = {
      role: 'customer',
      text: text,
      timestamp: getNowTime()
    };

    const updatedHistory = [...conversationHistory, userEntry];
    setConversationHistory(updatedHistory);

    setSubtitle({
      speaker: 'You',
      text: text,
      time: userEntry.timestamp
    });

    setAgentState('thinking');
    setStatusText('AI is thinking...');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent?.id || agentId,
          message: text,
          conversationHistory: updatedHistory
        })
      });

      const data = await res.json();
      if (data.success && data.response) {
        const agentResponseText = data.response;
        const agentEntry = {
          role: 'agent',
          text: agentResponseText,
          timestamp: getNowTime()
        };

        setConversationHistory([...updatedHistory, agentEntry]);

        setSubtitle({
          speaker: agent?.name || 'AI Agent',
          text: agentResponseText,
          time: agentEntry.timestamp
        });

        // Pre-fill lead form if contact info detected in message
        if (data.detectedInfo) {
          setLeadFormData(prev => ({
            ...prev,
            customerName: data.detectedInfo.name || prev.customerName,
            customerEmail: data.detectedInfo.email || prev.customerEmail,
            customerPhone: data.detectedInfo.phone || prev.customerPhone,
          }));
        }

        // Automatic Booking Confirmation feedback
        if (data.bookingConfirmed) {
          setLeadSubmitted(true);
          setStatusText(data.emailSent ? '🎉 Appointment Confirmed & Emailed!' : '🎉 Appointment Confirmed!');
          setTimeout(() => {
            setLeadSubmitted(false);
          }, 8000);
        }

        // Speak aloud
        speakText(agentResponseText);
      } else {
        setAgentState('idle');
        setStatusText('Ready to Talk');
      }
    } catch (err) {
      console.error('Chat API error:', err);
      setAgentState('idle');
      setStatusText('Ready to Talk');
    }
  };

  // Submit Typed Message
  const handleSendText = (e) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;
    const msg = typedMessage;
    setTypedMessage('');
    setIsTextDrawerOpen(false);
    handleUserMessage(msg);
  };

  // Submit Lead Form
  const handleSubmitLead = async (e) => {
    e.preventDefault();
    setIsSubmittingLead(true);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent?.id || agentId,
          ...leadFormData,
          transcript: conversationHistory,
        })
      });

      const data = await res.json();
      if (data.success) {
        setLeadSubmitted(true);
        const confirmMsg = "Thank you! I have confirmed your request and sent the full conversation transcript to your email.";
        setSubtitle({
          speaker: agent?.name || 'AI Agent',
          text: confirmMsg,
          time: getNowTime()
        });
        speakText(confirmMsg);

        setTimeout(() => {
          setIsFormOpen(false);
          setLeadSubmitted(false);
        }, 3500);
      } else {
        alert('Failed to submit lead: ' + (data.error || 'Server error'));
      }
    } catch (err) {
      alert('Error submitting lead: ' + err.message);
    } finally {
      setIsSubmittingLead(false);
    }
  };

  return (
    <>
      <link rel="stylesheet" href="/css/widget.css" />

      <div className="widget-container" id="widgetRoot">
        {/* Glowing Orbs */}
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>

        {/* Header */}
        <header className="widget-header">
          <div className="agent-profile">
            <div className="avatar-wrapper">
              <img
                src={agent?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                alt={agent?.name || 'Agent Avatar'}
                className="agent-avatar"
              />
              <span className="status-dot"></span>
            </div>
            <div className="agent-info">
              <h4>{agent?.name || 'Alex - AI Consultant'}</h4>
              <div className="service-tag">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{agent?.serviceName || 'Sales Specialist'}</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <select
              value={voiceLang}
              onChange={(e) => {
                const nextL = e.target.value;
                setVoiceLang(nextL);
                if (recognitionRef.current) recognitionRef.current.lang = nextL;
              }}
              title="Voice language (Urdu / English / Hindi)"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="ur-PK" style={{ background: '#0e1322', color: '#fff' }}>🇵🇰 Urdu</option>
              <option value="en-US" style={{ background: '#0e1322', color: '#fff' }}>🇺🇸 English</option>
              <option value="hi-IN" style={{ background: '#0e1322', color: '#fff' }}>🇮🇳 Hindi</option>
            </select>
            <button onClick={toggleMute} className="icon-btn" title={isMuted ? 'Unmute Speech' : 'Mute Speech'}>
              {!isMuted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <line x1="23" y1="9" x2="17" y2="15"></line>
                  <line x1="17" y1="9" x2="23" y2="15"></line>
                </svg>
              )}
            </button>
            <button onClick={handleClose} className="icon-btn" title="Minimize Widget">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="view-tabs">
          <button
            className={`tab-btn ${activeView === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveView('voice')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
            Live Voice
          </button>
          <button
            className={`tab-btn ${activeView === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveView('chat')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Transcript ({conversationHistory.length})
          </button>
        </nav>

        {/* Body Area */}
        <main className="widget-body">
          {/* VIEW 1: Live Voice Stage */}
          {activeView === 'voice' && (
            <section className="voice-view">
              {/* Status Pill */}
              <div className={`status-pill ${agentState === 'listening' ? 'state-listening' : agentState === 'thinking' ? 'state-thinking' : agentState === 'speaking' ? 'state-speaking' : ''}`}>
                <span className="status-indicator-dot"></span>
                <span>{statusText}</span>
              </div>

              {/* Glowing Visualizer Sphere */}
              <div className={`visualizer-stage ${agentState === 'listening' ? 'state-listening' : agentState === 'thinking' ? 'state-thinking' : agentState === 'speaking' ? 'state-speaking' : ''}`}>
                <div className="wave-ring wave-ring-1"></div>
                <div className="wave-ring wave-ring-2"></div>
                <div className="wave-ring wave-ring-3"></div>
                <div className="sphere-core">
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                  </svg>
                </div>
              </div>

              {/* Live Subtitle Box */}
              {leadSubmitted && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.35))',
                  border: '1px solid #10b981',
                  color: '#6ee7b7',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textAlign: 'center',
                  marginBottom: '10px',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)'
                }}>
                  🎉 <strong>Booking Confirmed!</strong> Confirmation & details dispatched to your email.
                </div>
              )}
              <div className="live-subtitle-box">
                <div className="live-speaker-label">
                  <span>{subtitle.speaker}</span>
                  <span style={{ fontWeight: 400, opacity: 0.6 }}>{subtitle.time}</span>
                </div>
                <div>
                  "{subtitle.text}"
                </div>
              </div>
            </section>
          )}

          {/* VIEW 2: Chat Transcript History */}
          {activeView === 'chat' && (
            <section className="chat-view" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
              {conversationHistory.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 20px', fontSize: '13px' }}>
                  No messages yet. Speak into the microphone or type below!
                </div>
              ) : (
                conversationHistory.map((item, idx) => (
                  <div key={idx} className={`chat-bubble ${item.role}`}>
                    <div>{item.text}</div>
                    <span className="bubble-time">
                      {item.role === 'agent' ? (agent?.name || 'Agent') : 'You'} • {item.timestamp}
                    </span>
                  </div>
                ))
              )}
              <div ref={chatBottomRef}></div>
            </section>
          )}

          {/* Slide-in Lead Confirmation Drawer */}
          {isFormOpen && (
            <div className="confirmation-card active" style={{ display: 'block' }}>
              <div className="card-header">
                <h5>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Confirm & Send Convo to Email
                </h5>
                <button onClick={() => setIsFormOpen(false)} className="icon-btn" style={{ width: '24px', height: '24px' }}>
                  &times;
                </button>
              </div>

              {leadSubmitted ? (
                <div className="success-banner active" style={{ display: 'block', margin: '20px 0' }}>
                  🎉 <strong>Details Confirmed!</strong> Full transcript and sales blueprint dispatched to your email.
                </div>
              ) : (
                <form onSubmit={handleSubmitLead}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Your Full Name *</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Tariq Khan"
                        value={leadFormData.customerName}
                        onChange={(e) => setLeadFormData({ ...leadFormData, customerName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone / WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        className="form-input"
                        placeholder="+92 300 1234567"
                        value={leadFormData.customerPhone}
                        onChange={(e) => setLeadFormData({ ...leadFormData, customerPhone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Email Address (to receive transcript & quotes) *</label>
                    <input
                      type="email"
                      required
                      className="form-input"
                      placeholder="name@company.com"
                      value={leadFormData.customerEmail}
                      onChange={(e) => setLeadFormData({ ...leadFormData, customerEmail: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Estimated Budget / Requirement</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. $1,000 - $3,000"
                        value={leadFormData.budget}
                        onChange={(e) => setLeadFormData({ ...leadFormData, budget: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Preferred Time Slot</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Tomorrow 4 PM"
                        value={leadFormData.preferredTime}
                        onChange={(e) => setLeadFormData({ ...leadFormData, preferredTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Specific Questions / Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Any specific requirements..."
                      value={leadFormData.notes}
                      onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                    />
                  </div>

                  <button type="submit" disabled={isSubmittingLead} className="submit-lead-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                    {isSubmittingLead ? 'Dispatching...' : 'Confirm & Email Complete Details'}
                  </button>
                </form>
              )}
            </div>
          )}
        </main>

        {/* Text Drawer (Fallback Type Mode) */}
        {isTextDrawerOpen && (
          <form onSubmit={handleSendText} className="text-drawer active" style={{ display: 'flex' }}>
            <input
              type="text"
              autoFocus
              className="text-input"
              placeholder="Type your question or message..."
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
            />
            <button type="submit" className="send-msg-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        )}

        {/* Footer Controls */}
        <footer className="widget-footer">
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="footer-btn"
            title="Review or edit lead details"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Confirm Form
          </button>

          {/* Center Mic Button */}
          <button
            onClick={toggleMicrophone}
            className={`mic-toggle-btn ${isListening ? 'active' : ''}`}
            aria-label="Toggle Microphone"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </button>

          {/* Keyboard Toggle */}
          <button
            onClick={() => setIsTextDrawerOpen(!isTextDrawerOpen)}
            className="footer-btn"
            title="Type instead of voice"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
              <line x1="6" y1="8" x2="6" y2="8"></line>
              <line x1="10" y1="8" x2="10" y2="8"></line>
              <line x1="14" y1="8" x2="14" y2="8"></line>
              <line x1="18" y1="8" x2="18" y2="8"></line>
              <line x1="6" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="18" y2="12"></line>
              <line x1="10" y1="16" x2="14" y2="16"></line>
            </svg>
            Type
          </button>
        </footer>
      </div>
    </>
  );
}
