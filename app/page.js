'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [settings, setSettings] = useState({
    geminiApiKey: '',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    notificationEmail: '',
    emailFromName: 'AI Voice Agent CRM',
    sendCustomerCopy: true,
  });

  // Filters & Search
  const [leadSearch, setLeadSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');

  // Modals
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentFormData, setAgentFormData] = useState({
    id: '',
    name: '',
    serviceName: '',
    avatar: '',
    primaryColor: '#6366f1',
    notificationEmail: '',
    welcomeMessage: '',
    voicePitch: '',
    qualificationQuestions: '',
    closingQuestion: '',
    knowledgeBase: [{ topic: '', content: '' }],
  });

  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Embed Tab State
  const [selectedEmbedAgent, setSelectedEmbedAgent] = useState('');
  const [embedPrimaryColor, setEmbedPrimaryColor] = useState('#6366f1');
  const [copyFeedback, setCopyFeedback] = useState('');

  // Settings Feedback
  const [settingsFeedback, setSettingsFeedback] = useState({ type: '', message: '' });
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // Load Initial Data
  useEffect(() => {
    fetchAgents();
    fetchLeads();
    fetchSettings();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      if (data.success) {
        setAgents(data.agents || []);
        if (data.agents?.length > 0 && !selectedEmbedAgent) {
          setSelectedEmbedAgent(data.agents[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  // Agent Modal Handlers
  const openNewAgentModal = () => {
    setEditingAgent(null);
    setAgentFormData({
      id: '',
      name: '',
      serviceName: '',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      primaryColor: '#6366f1',
      notificationEmail: settings.notificationEmail || '',
      welcomeMessage: 'Hi there! How can I assist you today?',
      voicePitch: 'Professional, friendly, and consultative tone.',
      qualificationQuestions: 'What is your main goal or project requirement?\nWhat is your preferred budget or timeline?',
      closingQuestion: 'Would you like to book a quick consultation? What is your full name and best phone number?',
      knowledgeBase: [
        { topic: 'Services & Pricing', content: 'We offer specialized solutions tailored to client needs.' },
        { topic: 'Process & Timeline', content: 'Standard delivery is within 2-3 weeks with dedicated support.' }
      ]
    });
    setIsAgentModalOpen(true);
  };

  const openEditAgentModal = (agent) => {
    setEditingAgent(agent);
    setAgentFormData({
      id: agent.id,
      name: agent.name || '',
      serviceName: agent.serviceName || '',
      avatar: agent.avatar || '',
      primaryColor: agent.primaryColor || '#6366f1',
      notificationEmail: agent.notificationEmail || '',
      welcomeMessage: agent.welcomeMessage || '',
      voicePitch: agent.voicePitch || '',
      qualificationQuestions: (agent.qualificationQuestions || []).join('\n'),
      closingQuestion: agent.confirmationFlow?.closingQuestion || '',
      knowledgeBase: (agent.knowledgeBase && agent.knowledgeBase.length > 0)
        ? agent.knowledgeBase
        : [{ topic: '', content: '' }]
    });
    setIsAgentModalOpen(true);
  };

  const handleSaveAgent = async (e) => {
    e.preventDefault();
    const payload = {
      id: agentFormData.id || undefined,
      name: agentFormData.name,
      serviceName: agentFormData.serviceName,
      avatar: agentFormData.avatar,
      primaryColor: agentFormData.primaryColor,
      notificationEmail: agentFormData.notificationEmail,
      welcomeMessage: agentFormData.welcomeMessage,
      voicePitch: agentFormData.voicePitch,
      qualificationQuestions: (typeof agentFormData.qualificationQuestions === 'string' ? agentFormData.qualificationQuestions : '')
        .split('\n')
        .map(q => q.trim())
        .filter(Boolean),
      knowledgeBase: (agentFormData.knowledgeBase || [])
        .filter(k => (k.topic || '').trim() || (k.content || '').trim())
        .map(k => ({ topic: (k.topic || '').trim(), content: (k.content || '').trim() })),
      confirmationFlow: {
        closingQuestion: agentFormData.closingQuestion,
        successMessage: 'Thank you! Your inquiry has been confirmed and dispatched to our team.'
      }
    };

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setIsAgentModalOpen(false);
        fetchAgents();
      }
    } catch (err) {
      alert('Error saving agent: ' + err.message);
    }
  };

  const handleDeleteAgent = async (id) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchAgents();
      }
    } catch (err) {
      alert('Error deleting agent: ' + err.message);
    }
  };

  // KB Rows
  const addKbRow = () => {
    setAgentFormData({
      ...agentFormData,
      knowledgeBase: [...agentFormData.knowledgeBase, { topic: '', content: '' }]
    });
  };

  const updateKbRow = (index, field, val) => {
    const updated = [...agentFormData.knowledgeBase];
    updated[index][field] = val;
    setAgentFormData({ ...agentFormData, knowledgeBase: updated });
  };

  const removeKbRow = (index) => {
    const updated = agentFormData.knowledgeBase.filter((_, i) => i !== index);
    setAgentFormData({ ...agentFormData, knowledgeBase: updated.length ? updated : [{ topic: '', content: '' }] });
  };

  // Lead Detail Handlers
  const handleUpdateLeadStatus = async (leadId, newStatus) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus });
        }
      }
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleResendEmail = async (leadId) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/resend-email`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Email successfully sent!');
      } else {
        alert('Failed: ' + (data.error || 'Check SMTP configuration'));
      }
    } catch (err) {
      alert('Resend error: ' + err.message);
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (!confirm('Delete this lead record permanently?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLeads(leads.filter(l => l.id !== leadId));
        setIsLeadModalOpen(false);
      }
    } catch (err) {
      alert('Delete error: ' + err.message);
    }
  };

  // Settings Handlers
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsFeedback({ type: '', message: '' });
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (data.success) {
        setSettingsFeedback({ type: 'success', message: 'Settings saved successfully!' });
      } else {
        setSettingsFeedback({ type: 'error', message: data.error || 'Failed to save settings' });
      }
    } catch (err) {
      setSettingsFeedback({ type: 'error', message: err.message });
    }
  };

  const handleTestSmtp = async () => {
    setTestEmailLoading(true);
    setSettingsFeedback({ type: '', message: '' });
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: settings.notificationEmail })
      });
      const data = await res.json();
      if (data.success) {
        setSettingsFeedback({ type: 'success', message: 'Test email sent successfully! Check inbox.' });
      } else {
        setSettingsFeedback({ type: 'error', message: data.error || 'SMTP test failed.' });
      }
    } catch (err) {
      setSettingsFeedback({ type: 'error', message: err.message });
    } finally {
      setTestEmailLoading(false);
    }
  };

  // Filtered Leads
  const filteredLeads = leads.filter(l => {
    const matchesAgent = agentFilter === 'all' || l.agentId === agentFilter;
    const query = leadSearch.toLowerCase();
    const matchesSearch = !leadSearch ||
      (l.customerName && l.customerName.toLowerCase().includes(query)) ||
      (l.customerEmail && l.customerEmail.toLowerCase().includes(query)) ||
      (l.customerPhone && l.customerPhone.toLowerCase().includes(query)) ||
      (l.serviceName && l.serviceName.toLowerCase().includes(query));
    return matchesAgent && matchesSearch;
  });

  // Embed Snippets
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const targetAgentId = selectedEmbedAgent || (agents[0]?.id || 'agent_digital_agency');

  const scriptSnippet = `<!-- AI Voice Sales Agent Footer Embed -->
<script 
  src="${currentOrigin}/embed.js" 
  data-agent-id="${targetAgentId}"
  data-primary-color="${embedPrimaryColor}"
  data-position="right"
  defer>
</script>`;

  const iframeSnippet = `<!-- AI Voice Agent Iframe Embed -->
<iframe 
  src="${currentOrigin}/widget/${targetAgentId}" 
  width="390" 
  height="610" 
  style="border:none; border-radius:24px; box-shadow:0 20px 60px rgba(0,0,0,0.5);"
  allow="microphone; speech-recognition; autoplay">
</iframe>`;

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(`${label} copied to clipboard!`);
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  return (
    <>
      <link rel="stylesheet" href="/css/dashboard.css" />

      {/* Sidebar */}
      <aside className="crm-sidebar">
        <div className="brand-section">
          <div className="brand-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.3">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="22"></line>
            </svg>
          </div>
          <div className="brand-text">
            <h2>Voice Agent CRM</h2>
            <span>Knowledge & Sales Engine</span>
          </div>
        </div>

        <nav className="nav-menu">
          <a
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Overview</span>
          </a>

          <a
            className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Voice Agents & KB</span>
            <span className="nav-badge">{agents.length}</span>
          </a>

          <a
            className={`nav-item ${activeTab === 'leads' ? 'active' : ''}`}
            onClick={() => setActiveTab('leads')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <span>Leads & Transcripts</span>
            <span className="nav-badge">{leads.length}</span>
          </a>

          <a
            className={`nav-item ${activeTab === 'embed' ? 'active' : ''}`}
            onClick={() => setActiveTab('embed')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            <span>Iframe & Footer Embed</span>
          </a>

          <a
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
            style={{ cursor: 'pointer' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>SMTP & Email Config</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <a href="/demo" target="_blank" className="demo-site-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            <span>Live Footer Demo Website</span>
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="crm-main">
        <header className="crm-header">
          <div className="crm-title">
            <h1>
              {activeTab === 'overview' && 'Overview Dashboard'}
              {activeTab === 'agents' && 'Voice Agents & Knowledge Base Studio'}
              {activeTab === 'leads' && 'Captured Leads & Full Transcripts'}
              {activeTab === 'embed' && 'Website Footer & Iframe Embed Generator'}
              {activeTab === 'settings' && 'Email Dispatcher & AI Settings'}
            </h1>
            <p>
              {activeTab === 'overview' && 'Voice agent performance, incoming inquiries, and conversion stats.'}
              {activeTab === 'agents' && 'Create custom agents tailored to each service with bespoke qualification rules.'}
              {activeTab === 'leads' && 'Inspect full customer voice conversations and auto-dispatched emails.'}
              {activeTab === 'embed' && 'Get 1-click embed code to add the voice agent to any client website footer.'}
              {activeTab === 'settings' && 'Configure SMTP credentials and Google Gemini intelligence.'}
            </p>
          </div>
          <div className="header-btn-group">
            <button onClick={openNewAgentModal} className="btn btn-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Voice Agent
            </button>
            <a href={`/widget/${targetAgentId}`} target="_blank" className="btn btn-outline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Live Widget Preview
            </a>
          </div>
        </header>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <section className="tab-content-section active">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon-box icon-purple">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="22"></line>
                  </svg>
                </div>
                <div className="metric-data">
                  <h3>{agents.length}</h3>
                  <p>Active Voice Agents</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-box icon-green">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <polyline points="16 11 18 13 22 9"></polyline>
                  </svg>
                </div>
                <div className="metric-data">
                  <h3>{leads.length}</h3>
                  <p>Captured Leads</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-box icon-orange">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <div className="metric-data">
                  <h3>{leads.filter(l => l.emailSent).length}</h3>
                  <p>Transcripts Emailed</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-icon-box icon-blue">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div className="metric-data">
                  <h3>{leads.length > 0 ? '88%' : '0%'}</h3>
                  <p>Avg Qualification Rate</p>
                </div>
              </div>
            </div>

            <div className="card-panel">
              <div className="panel-header">
                <div>
                  <h2>Recent Voice Leads & Transcripts</h2>
                  <p>Real-time customer inquiries captured from embedded widgets</p>
                </div>
                <button onClick={() => setActiveTab('leads')} className="btn btn-outline btn-sm">
                  View All Leads &rarr;
                </button>
              </div>

              <div className="table-responsive">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Service & Agent</th>
                      <th>Budget</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Transcript</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          No leads captured yet. Test the voice agent from the widget preview!
                        </td>
                      </tr>
                    ) : (
                      leads.slice(0, 5).map(lead => (
                        <tr key={lead.id}>
                          <td>
                            <strong>{lead.customerName || 'Website Visitor'}</strong>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {lead.customerEmail || ''} {lead.customerPhone ? `• ${lead.customerPhone}` : ''}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-purple">{lead.serviceName || 'Consultation'}</span>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                              Agent: {lead.agentName || 'AI'}
                            </div>
                          </td>
                          <td>{lead.budget || 'Flexible'}</td>
                          <td style={{ fontSize: '12px', color: '#94a3b8' }}>
                            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'Recent'}
                          </td>
                          <td>
                            <span className={`badge ${lead.status === 'Booked' ? 'badge-blue' : lead.status === 'Follow Up' ? 'badge-orange' : 'badge-green'}`}>
                              {lead.status || 'Qualified'}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-gray">
                              💬 {(lead.transcript || []).length} audio turns
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => { setSelectedLead(lead); setIsLeadModalOpen(true); }}
                              className="btn btn-outline btn-sm"
                            >
                              Inspect Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: VOICE AGENTS & KB */}
        {activeTab === 'agents' && (
          <section className="tab-content-section active">
            <div className="section-toolbar">
              <div>
                <h2>Custom Service Voice Agents</h2>
                <p>Each agent has its own tone, service domain, qualification rules, and custom knowledge base.</p>
              </div>
              <button onClick={openNewAgentModal} className="btn btn-primary">
                + Create New Agent
              </button>
            </div>

            <div className="agents-grid">
              {agents.map(agent => (
                <div key={agent.id} className="agent-card">
                  <div className="agent-card-header">
                    <img
                      src={agent.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                      className="agent-card-avatar"
                      style={{ borderColor: agent.primaryColor || '#6366f1' }}
                      alt={agent.name}
                    />
                    <div className="agent-card-meta">
                      <h3>{agent.name}</h3>
                      <span className="agent-service-badge">{agent.serviceName}</span>
                    </div>
                  </div>

                  <div className="agent-card-body">
                    <p style={{ marginBottom: '8px', fontStyle: 'italic', fontSize: '13px', color: '#cbd5e1' }}>
                      "{agent.welcomeMessage || 'How can I assist you today?'}"
                    </p>
                    <div className="agent-kb-stats">
                      <span>📚 {(agent.knowledgeBase || []).length} Knowledge Topics</span>
                      <span>🎯 {(agent.qualificationQuestions || []).length} Questions</span>
                    </div>
                  </div>

                  <div className="agent-card-actions">
                    <button onClick={() => openEditAgentModal(agent)} className="btn btn-primary btn-sm">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                      Edit KB & Agent
                    </button>
                    <a href={`/widget/${agent.id}`} target="_blank" className="btn btn-outline btn-sm">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      Test Voice
                    </a>
                    <button onClick={() => handleDeleteAgent(agent.id)} className="btn btn-danger btn-sm" title="Delete">
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB 3: LEADS & TRANSCRIPTS */}
        {activeTab === 'leads' && (
          <section className="tab-content-section active">
            <div className="filters-bar">
              <div className="search-box">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search leads by name, email, phone, or service..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Filter by Agent:</label>
                <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
                  <option value="all">All Voice Agents</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card-panel">
              <div className="table-responsive">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Customer Details</th>
                      <th>Service & Agent</th>
                      <th>Budget & Timeline</th>
                      <th>Summary</th>
                      <th>Status</th>
                      <th>Email Dispatch</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                          No leads matching current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map(lead => (
                        <tr key={lead.id}>
                          <td>
                            <strong>{lead.customerName || 'Website Visitor'}</strong>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              ✉️ {lead.customerEmail || 'No email'}<br />
                              📞 {lead.customerPhone || 'No phone'}
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-purple">{lead.serviceName || 'Consultation'}</span>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                              Agent: {lead.agentName || 'AI'}
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '13px' }}><strong>Budget:</strong> {lead.budget || 'Flexible'}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}><strong>Time:</strong> {lead.preferredTime || 'Immediate'}</div>
                          </td>
                          <td style={{ maxWidth: '240px' }}>
                            <div style={{ fontSize: '12px', color: '#cbd5e1', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {lead.summary || 'Lead captured via interactive audio consultation.'}
                            </div>
                          </td>
                          <td>
                            <select
                              value={lead.status || 'Qualified'}
                              onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value)}
                              className="status-select"
                            >
                              <option value="Qualified">Qualified</option>
                              <option value="Follow Up">Follow Up</option>
                              <option value="Booked">Booked</option>
                              <option value="Closed">Closed</option>
                            </select>
                          </td>
                          <td>
                            {lead.emailSent ? (
                              <span className="badge badge-green" title={lead.emailSentTo}>
                                ✓ Sent
                              </span>
                            ) : (
                              <span className="badge badge-gray">Not configured</span>
                            )}
                            {lead.emailPreviewUrl && (
                              <div style={{ marginTop: '4px' }}>
                                <a href={lead.emailPreviewUrl} target="_blank" style={{ fontSize: '11px', color: '#818cf8', textDecoration: 'underline' }}>
                                  View Ethereal Preview
                                </a>
                              </div>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => { setSelectedLead(lead); setIsLeadModalOpen(true); }}
                                className="btn btn-outline btn-sm"
                              >
                                Transcript
                              </button>
                              <button
                                onClick={() => handleResendEmail(lead.id)}
                                className="btn btn-outline btn-sm"
                                title="Resend Notification Email"
                              >
                                ✉️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* TAB 4: EMBED GENERATOR */}
        {activeTab === 'embed' && (
          <section className="tab-content-section active">
            <div className="card-panel" style={{ marginBottom: '24px' }}>
              <div className="panel-header">
                <div>
                  <h2>Website Footer & Iframe Embed Code</h2>
                  <p>Add this interactive voice sales agent into any external website (WordPress, Shopify, Webflow, React, HTML).</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label>Select Voice Agent to Embed</label>
                  <select
                    value={selectedEmbedAgent}
                    onChange={(e) => setSelectedEmbedAgent(e.target.value)}
                    className="form-control"
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serviceName})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Widget Primary Color</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={embedPrimaryColor}
                      onChange={(e) => setEmbedPrimaryColor(e.target.value)}
                      style={{ width: '44px', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent' }}
                    />
                    <input
                      type="text"
                      value={embedPrimaryColor}
                      onChange={(e) => setEmbedPrimaryColor(e.target.value)}
                      className="form-control"
                      style={{ width: '120px' }}
                    />
                  </div>
                </div>
              </div>

              {copyFeedback && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', marginBottom: '16px', fontSize: '13px' }}>
                  {copyFeedback}
                </div>
              )}

              {/* Method 1: Script Tag */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ color: '#fff', fontSize: '15px' }}>Option A: 1-Line Floating Footer Script (Recommended)</h4>
                  <button onClick={() => copyToClipboard(scriptSnippet, 'Script code')} className="btn btn-primary btn-sm">
                    Copy Script Code
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                  Paste this right before the closing <code>&lt;/body&gt;</code> tag of your website. It adds an animated floating microphone bubble in the corner.
                </p>
                <pre style={{ background: '#0e1322', padding: '16px', borderRadius: '10px', color: '#818cf8', fontSize: '13px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {scriptSnippet}
                </pre>
              </div>

              {/* Method 2: Iframe */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ color: '#fff', fontSize: '15px' }}>Option B: Dedicated Iframe Window</h4>
                  <button onClick={() => copyToClipboard(iframeSnippet, 'Iframe code')} className="btn btn-outline btn-sm">
                    Copy Iframe Code
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                  Embed the voice assistant directly within a dedicated section or modal on your web page.
                </p>
                <pre style={{ background: '#0e1322', padding: '16px', borderRadius: '10px', color: '#38bdf8', fontSize: '13px', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {iframeSnippet}
                </pre>
              </div>
            </div>

            {/* Live Demo Showcase Card */}
            <div className="card-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: '#fff', marginBottom: '4px' }}>Want to see how it works on a real agency website?</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>We set up a mock Digital Agency client website showcasing the live footer widget in action.</p>
              </div>
              <a href="/demo" target="_blank" className="btn btn-primary">
                Open Client Demo Website &rarr;
              </a>
            </div>
          </section>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <section className="tab-content-section active">
            <div className="card-panel" style={{ maxWidth: '800px' }}>
              <div className="panel-header">
                <div>
                  <h2>Email Dispatcher & AI Credentials</h2>
                  <p>Configure automated email notifications for leads and optionally attach Google Gemini API.</p>
                </div>
              </div>

              {settingsFeedback.message && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  background: settingsFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${settingsFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: settingsFeedback.type === 'success' ? '#10b981' : '#ef4444',
                  fontSize: '14px'
                }}>
                  {settingsFeedback.message}
                </div>
              )}

              <form onSubmit={handleSaveSettings}>
                {/* 🗄️ Database & Cloud Provider Status Card */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>🔥</span>
                      <strong style={{ color: '#fff', fontSize: '15px' }}>Primary Database: Cloud Firestore (Firebase)</strong>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: settings.dbStatus?.isFirebaseConfigured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: settings.dbStatus?.isFirebaseConfigured ? '#10b981' : '#f59e0b',
                      border: `1px solid ${settings.dbStatus?.isFirebaseConfigured ? '#10b981' : '#f59e0b'}`
                    }}>
                      {settings.dbStatus?.isFirebaseConfigured ? '✓ Firebase Live' : '📁 Local Storage (Fallback)'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                    {settings.dbStatus?.isFirebaseConfigured
                      ? 'Live on Google Cloud Firestore. Architecture abstracted for future AWS DynamoDB migration with zero code changes.'
                      : 'Firebase is set as primary. Add FIREBASE_PROJECT_ID in .env and run "npm run migrate:firebase" to upload local data. Local JSON active as graceful fallback.'}
                  </p>
                </div>

                <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  🤖 AI Reasoning Engine
                </h3>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Google Gemini API Key (Optional)</label>
                  <input
                    type="password"
                    placeholder="AIzaSy... (leave blank to use smart built-in rule dialogue engine)"
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                    className="form-control"
                  />
                  <small style={{ color: '#94a3b8', display: 'block', marginTop: '4px' }}>
                    If provided, the system utilizes Gemini 2.5 Flash for conversational dialogue. If blank, it seamlessly uses the built-in knowledge & qualification engine.
                  </small>
                </div>

                <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                  📧 SMTP Email Dispatcher (for Lead Notifications & Full Transcripts)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>SMTP Host</label>
                    <input
                      type="text"
                      placeholder="smtp.gmail.com"
                      value={settings.smtpHost || ''}
                      onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>SMTP Port</label>
                    <input
                      type="number"
                      placeholder="587"
                      value={settings.smtpPort || 587}
                      onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value, 10) })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>SMTP Username / Email</label>
                    <input
                      type="text"
                      placeholder="your-email@gmail.com"
                      value={settings.smtpUser || ''}
                      onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>SMTP Password / App Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={settings.smtpPass || ''}
                      onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label>Admin Notification Recipient Email</label>
                    <input
                      type="email"
                      placeholder="sales@yourcompany.com"
                      value={settings.notificationEmail || ''}
                      onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label>Sender Display Name</label>
                    <input
                      type="text"
                      placeholder="AI Voice Agent CRM"
                      value={settings.emailFromName || ''}
                      onChange={(e) => setSettings({ ...settings, emailFromName: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#cbd5e1' }}>
                    <input
                      type="checkbox"
                      checked={!!settings.sendCustomerCopy}
                      onChange={(e) => setSettings({ ...settings, sendCustomerCopy: e.target.checked })}
                    />
                    Also send a confirmation copy & transcript directly to the customer's email
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="submit" className="btn btn-primary">
                    Save CRM Settings
                  </button>
                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={testEmailLoading}
                    className="btn btn-outline"
                  >
                    {testEmailLoading ? 'Testing...' : 'Send Test Email'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
      </main>

      {/* MODAL: CREATE / EDIT AGENT */}
      {isAgentModalOpen && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{editingAgent ? `Edit Agent: ${editingAgent.name}` : 'Create New Voice Agent'}</h2>
              <button onClick={() => setIsAgentModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>

            <form onSubmit={handleSaveAgent}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label>Agent Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex - Agency Growth Consultant"
                    value={agentFormData.name}
                    onChange={(e) => setAgentFormData({ ...agentFormData, name: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Service Specialization *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Web Development & AI Voice Solutions"
                    value={agentFormData.serviceName}
                    onChange={(e) => setAgentFormData({ ...agentFormData, serviceName: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label>Avatar Image URL</label>
                  <input
                    type="url"
                    value={agentFormData.avatar}
                    onChange={(e) => setAgentFormData({ ...agentFormData, avatar: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>Theme Color</label>
                  <input
                    type="color"
                    value={agentFormData.primaryColor}
                    onChange={(e) => setAgentFormData({ ...agentFormData, primaryColor: e.target.value })}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                  />
                </div>
                <div className="form-group">
                  <label>Agent Alerts Email</label>
                  <input
                    type="email"
                    placeholder="agent@company.com"
                    value={agentFormData.notificationEmail}
                    onChange={(e) => setAgentFormData({ ...agentFormData, notificationEmail: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Spoken Welcome Greeting (Voice Audio)</label>
                <textarea
                  rows="2"
                  value={agentFormData.welcomeMessage}
                  onChange={(e) => setAgentFormData({ ...agentFormData, welcomeMessage: e.target.value })}
                  className="form-control"
                  placeholder="The first greeting spoken to website visitors when widget opens."
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Voice Persona & Tone</label>
                <input
                  type="text"
                  value={agentFormData.voicePitch}
                  onChange={(e) => setAgentFormData({ ...agentFormData, voicePitch: e.target.value })}
                  className="form-control"
                  placeholder="e.g. Warm, consultative sales tone, concise and direct."
                />
              </div>

              {/* Dynamic KB Items */}
              <div style={{ marginBottom: '18px', padding: '14px', background: '#0e1322', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ margin: 0, fontWeight: 700, color: '#fff' }}>📚 Custom Knowledge Base (Topics & Answers)</label>
                  <button type="button" onClick={addKbRow} className="btn btn-outline btn-sm">
                    + Add Topic
                  </button>
                </div>

                {agentFormData.knowledgeBase.map((kb, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Topic (e.g. Pricing)"
                      value={kb.topic}
                      onChange={(e) => updateKbRow(idx, 'topic', e.target.value)}
                      className="form-control"
                    />
                    <input
                      type="text"
                      placeholder="Content / Fact / Answer"
                      value={kb.content}
                      onChange={(e) => updateKbRow(idx, 'content', e.target.value)}
                      className="form-control"
                    />
                    <button type="button" onClick={() => removeKbRow(idx)} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }}>
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label>Lead Qualification Questions (One per line)</label>
                <textarea
                  rows="3"
                  value={agentFormData.qualificationQuestions}
                  onChange={(e) => setAgentFormData({ ...agentFormData, qualificationQuestions: e.target.value })}
                  className="form-control"
                  placeholder="What is your current requirement?\nWhat is your monthly budget?"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Closing Confirmation Question</label>
                <input
                  type="text"
                  value={agentFormData.closingQuestion}
                  onChange={(e) => setAgentFormData({ ...agentFormData, closingQuestion: e.target.value })}
                  className="form-control"
                  placeholder="Would you like to book a quick consultation? What is your full name and best phone number?"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsAgentModalOpen(false)} className="btn btn-outline">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAgent ? 'Update Agent' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT LEAD DETAIL & TRANSCRIPT */}
      {isLeadModalOpen && selectedLead && (
        <div className="modal-overlay active">
          <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>Lead Details & Conversation Transcript</h2>
              <button onClick={() => setIsLeadModalOpen(false)} className="modal-close-btn">&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Customer Name</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{selectedLead.customerName || 'N/A'}</div>
              </div>
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Phone / WhatsApp</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{selectedLead.customerPhone || 'N/A'}</div>
              </div>
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Email Address</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{selectedLead.customerEmail || 'N/A'}</div>
              </div>
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Target Budget</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{selectedLead.budget || 'N/A'}</div>
              </div>
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Preferred Time</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{selectedLead.preferredTime || 'Immediate'}</div>
              </div>
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8' }}>Service Requested</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{selectedLead.serviceName || 'Consultation'}</div>
              </div>
            </div>

            {selectedLead.notes && (
              <div style={{ background: '#0e1322', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}>Special Notes</div>
                <div style={{ fontSize: '14px', color: '#cbd5e1' }}>{selectedLead.notes}</div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>✨ AI Summary</div>
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981', borderRadius: '4px', color: '#6ee7b7', fontSize: '13px', lineHeight: 1.5 }}>
                {selectedLead.summary}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                💬 Full Audio Transcript ({(selectedLead.transcript || []).length} turns)
              </div>
              <div style={{ maxHeight: '250px', overflowY: 'auto', background: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '12px' }}>
                {(selectedLead.transcript || []).length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '13px' }}>No messages recorded.</p>
                ) : (
                  selectedLead.transcript.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        marginBottom: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: msg.role === 'agent' ? '#1e293b' : 'rgba(99, 102, 241, 0.25)',
                        marginLeft: msg.role === 'agent' ? '0' : '20px',
                        marginRight: msg.role === 'agent' ? '20px' : '0'
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 700, color: msg.role === 'agent' ? '#94a3b8' : '#818cf8', marginBottom: '2px', textTransform: 'uppercase' }}>
                        {msg.role === 'agent' ? (selectedLead.agentName || 'Agent') : (selectedLead.customerName || 'Customer')} ({msg.timestamp || 'Just now'})
                      </div>
                      <div style={{ fontSize: '13px', color: '#f8fafc' }}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => handleDeleteLead(selectedLead.id)} className="btn btn-danger btn-sm">
                Delete Lead Record
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => handleResendEmail(selectedLead.id)} className="btn btn-primary btn-sm">
                  Resend Notification Email
                </button>
                <button onClick={() => setIsLeadModalOpen(false)} className="btn btn-outline btn-sm">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
