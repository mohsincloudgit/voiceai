// CRM Dashboard Logic
let allAgents = [];
let allLeads = [];
let currentSelectedLead = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDashboardData();
  setupSettingsForm();
  setupSearchAndFilters();
});

// Navigation Tab Switcher
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabName);
  });

  // Update sections
  document.querySelectorAll('.tab-content-section').forEach(section => {
    section.classList.toggle('active', section.id === `tab-${tabName}`);
  });

  // Update Header text
  const heading = document.getElementById('pageHeading');
  const subheading = document.getElementById('pageSubheading');

  if (tabName === 'overview') {
    heading.textContent = 'Overview Dashboard';
    subheading.textContent = 'Voice agent performance, incoming inquiries, and conversion stats.';
  } else if (tabName === 'agents') {
    heading.textContent = 'Voice Agents & Knowledge Base Studio';
    subheading.textContent = 'Create custom agents tailored to each service with bespoke qualification rules.';
  } else if (tabName === 'leads') {
    heading.textContent = 'Captured Leads & Full Transcripts';
    subheading.textContent = 'Inspect full customer voice conversations and auto-dispatched emails.';
  } else if (tabName === 'embed') {
    heading.textContent = 'Website Footer & Iframe Embed Generator';
    subheading.textContent = 'Get 1-click embed code to add the voice agent to any client website footer.';
    updateEmbedSnippets();
  } else if (tabName === 'settings') {
    heading.textContent = 'Email Dispatcher & AI Settings';
    subheading.textContent = 'Configure SMTP credentials and Google Gemini intelligence.';
    loadSettings();
  }
}

// Fetch All Initial Data
async function loadDashboardData() {
  await Promise.all([loadAgents(), loadLeads()]);
  updateMetrics();
  initEmbedAgentSelect();
}

// ----------------- AGENTS & KNOWLEDGE BASE ----------------- //
async function loadAgents() {
  try {
    const res = await fetch('/api/agents');
    const data = await res.json();
    if (data.success) {
      allAgents = data.agents || [];
      renderAgentsList();
      document.getElementById('sidebarAgentCount').textContent = allAgents.length;
      document.getElementById('statTotalAgents').textContent = allAgents.length;
    }
  } catch (err) {
    console.error('Failed to load agents:', err);
  }
}

function renderAgentsList() {
  const container = document.getElementById('agentsListContainer');
  if (!container) return;

  container.innerHTML = allAgents.map(agent => {
    const kbCount = (agent.knowledgeBase || []).length;
    const qCount = (agent.qualificationQuestions || []).length;

    return `
      <div class="agent-card">
        <div class="agent-card-header">
          <img src="${agent.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}" class="agent-card-avatar" style="border-color:${agent.primaryColor || '#6366f1'};">
          <div class="agent-card-meta">
            <h3>${agent.name}</h3>
            <span class="agent-service-badge">${agent.serviceName}</span>
          </div>
        </div>

        <div class="agent-card-body">
          <p style="margin-bottom:8px; font-style:italic;">"${agent.welcomeMessage || 'How can I assist you today?'}"</p>
          <div class="agent-kb-stats">
            <span>📚 ${kbCount} Knowledge Topics</span>
            <span>🎯 ${qCount} Questions</span>
          </div>
        </div>

        <div class="agent-card-actions">
          <button class="btn btn-primary btn-sm" onclick="editAgent('${agent.id}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            Edit KB & Agent
          </button>
          <a href="/widget/${agent.id}" target="_blank" class="btn btn-outline btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            Test Voice
          </a>
          <button class="btn btn-danger btn-sm" onclick="deleteAgent('${agent.id}')" title="Delete">
            &times;
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Agent Modal Logic
function openAgentModal(agent = null) {
  const modal = document.getElementById('agentModal');
  const title = document.getElementById('agentModalTitle');
  const kbContainer = document.getElementById('kbItemsContainer');
  kbContainer.innerHTML = '';

  if (agent) {
    title.textContent = `Edit Agent: ${agent.name}`;
    document.getElementById('editAgentId').value = agent.id;
    document.getElementById('editAgentName').value = agent.name || '';
    document.getElementById('editAgentService').value = agent.serviceName || '';
    document.getElementById('editAgentAvatar').value = agent.avatar || '';
    document.getElementById('editAgentColor').value = agent.primaryColor || '#6366f1';
    document.getElementById('editAgentEmail').value = agent.notificationEmail || '';
    document.getElementById('editAgentWelcome').value = agent.welcomeMessage || '';
    document.getElementById('editAgentPitch').value = agent.voicePitch || '';
    document.getElementById('editAgentQuestions').value = (agent.qualificationQuestions || []).join('\n');
    document.getElementById('editAgentClosing').value = agent.confirmationFlow?.closingQuestion || '';

    // Populate KB rows
    (agent.knowledgeBase || []).forEach(item => {
      addKbItem(item.topic, item.content);
    });
  } else {
    title.textContent = 'Create New Voice Agent & Knowledge Base';
    document.getElementById('editAgentId').value = '';
    document.getElementById('agentEditorForm').reset();
    document.getElementById('editAgentColor').value = '#6366f1';
    // Add 2 initial empty KB items
    addKbItem('Services & Scope', '');
    addKbItem('Pricing & Packages', '');
  }

  modal.classList.add('open');
}

function closeAgentModal() {
  document.getElementById('agentModal').classList.remove('open');
}

function editAgent(id) {
  const agent = allAgents.find(a => a.id === id);
  if (agent) openAgentModal(agent);
}

async function deleteAgent(id) {
  if (!confirm('Are you sure you want to delete this voice agent?')) return;
  try {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await loadAgents();
      initEmbedAgentSelect();
    }
  } catch (err) {
    alert('Failed to delete agent: ' + err.message);
  }
}

// Add Knowledge Item Row in Modal
function addKbItem(topic = '', content = '') {
  const container = document.getElementById('kbItemsContainer');
  const row = document.createElement('div');
  row.className = 'kb-item-row';
  row.style.cssText = 'background: rgba(14, 19, 34, 0.8); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 6px;';
  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <input type="text" class="form-control kb-topic" placeholder="Topic / Question (e.g. Turnaround Time, Pricing)" value="${topic}" style="flex:1; font-weight:600; margin-right:8px;">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.kb-item-row').remove()" style="padding:4px 8px;">&times;</button>
    </div>
    <textarea class="form-control kb-content" rows="2" placeholder="Knowledge content or answer the agent will use in its sales pitch...">${content}</textarea>
  `;
  container.appendChild(row);
}

// Save Agent & Knowledge Base
async function submitAgentForm() {
  const name = document.getElementById('editAgentName').value.trim();
  const service = document.getElementById('editAgentService').value.trim();
  const welcome = document.getElementById('editAgentWelcome').value.trim();

  if (!name || !service || !welcome) {
    alert('Please fill out Agent Name, Service, and Welcome Greeting.');
    return;
  }

  // Collect Knowledge Base Items
  const kbRows = document.querySelectorAll('.kb-item-row');
  const knowledgeBase = [];
  kbRows.forEach(row => {
    const topic = row.querySelector('.kb-topic').value.trim();
    const content = row.querySelector('.kb-content').value.trim();
    if (topic && content) {
      knowledgeBase.push({ topic, content });
    }
  });

  // Collect Qualification Questions
  const questionsRaw = document.getElementById('editAgentQuestions').value.trim();
  const qualificationQuestions = questionsRaw.split('\n').map(q => q.trim()).filter(Boolean);

  const closingMsg = document.getElementById('editAgentClosing').value.trim();

  const agentPayload = {
    id: document.getElementById('editAgentId').value || undefined,
    name,
    serviceName: service,
    avatar: document.getElementById('editAgentAvatar').value.trim() || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    primaryColor: document.getElementById('editAgentColor').value,
    notificationEmail: document.getElementById('editAgentEmail').value.trim(),
    welcomeMessage: welcome,
    voicePitch: document.getElementById('editAgentPitch').value.trim(),
    knowledgeBase,
    qualificationQuestions,
    confirmationFlow: {
      closingQuestion: closingMsg || "I can lock in your booking! Could I get your name, phone, and email to confirm?",
      successMessage: "Thank you! Your inquiry has been confirmed and the full conversation transcript has been emailed to you."
    }
  };

  try {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentPayload)
    });

    const data = await res.json();
    if (data.success) {
      closeAgentModal();
      await loadAgents();
      initEmbedAgentSelect();
    } else {
      alert('Error saving agent: ' + data.error);
    }
  } catch (err) {
    alert('Failed to save agent: ' + err.message);
  }
}

// ----------------- LEADS & TRANSCRIPTS ----------------- //
async function loadLeads() {
  try {
    const res = await fetch('/api/leads');
    const data = await res.json();
    if (data.success) {
      allLeads = data.leads || [];
      renderLeadsTable();
      renderOverviewLeads();
      document.getElementById('sidebarLeadCount').textContent = allLeads.length;
      document.getElementById('statTotalLeads').textContent = allLeads.length;
    }
  } catch (err) {
    console.error('Failed to load leads:', err);
  }
}

function renderOverviewLeads() {
  const tbody = document.getElementById('overviewLeadsTableBody');
  if (!tbody) return;

  const topLeads = allLeads.slice(0, 5);
  if (topLeads.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">No leads recorded yet. Try speaking to an agent via the widget!</td></tr>`;
    return;
  }

  tbody.innerHTML = topLeads.map(lead => `
    <tr>
      <td><strong>${lead.customerName || 'Website Visitor'}</strong></td>
      <td><span class="badge badge-purple">${lead.serviceName || 'Consultation'}</span></td>
      <td>${lead.customerPhone || lead.customerEmail || 'N/A'}</td>
      <td>${lead.budget || 'Flexible'}</td>
      <td>
        <span class="badge ${lead.emailSent ? 'badge-green' : 'badge-orange'}">
          ${lead.emailSent ? '✓ Emailed' : 'Local Log'}
        </span>
      </td>
      <td style="font-size:12px; color:#94a3b8;">${new Date(lead.createdAt).toLocaleDateString()}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="viewLeadDetail('${lead.id}')">View Transcript</button>
      </td>
    </tr>
  `).join('');
}

function renderLeadsTable(filteredLeads = null) {
  const tbody = document.getElementById('fullLeadsTableBody');
  if (!tbody) return;

  const list = filteredLeads || allLeads;
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:30px;">No leads matching search criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(lead => `
    <tr>
      <td>
        <strong>${lead.customerName || 'Anonymous Visitor'}</strong>
        <div style="font-size:11px; color:#94a3b8;">${lead.customerEmail || ''}</div>
      </td>
      <td>
        <div>${lead.serviceName || 'Consultation'}</div>
        <div style="font-size:11px; color:#818cf8;">Agent: ${lead.agentName || 'AI'}</div>
      </td>
      <td>${lead.customerPhone || 'N/A'}</td>
      <td>${lead.budget || 'N/A'}</td>
      <td>
        <select onchange="updateLeadStatus('${lead.id}', this.value)" class="form-control" style="padding:4px 8px; font-size:11.5px; width:auto;">
          <option value="Qualified" ${lead.status === 'Qualified' ? 'selected' : ''}>Qualified</option>
          <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option value="Closed" ${lead.status === 'Closed' ? 'selected' : ''}>Closed</option>
        </select>
      </td>
      <td>
        <span class="badge ${lead.emailSent ? 'badge-green' : 'badge-orange'}">
          ${lead.emailSent ? '✓ Dispatched' : 'Queued'}
        </span>
      </td>
      <td style="font-size:12px; color:#94a3b8;">${new Date(lead.createdAt).toLocaleDateString()}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="viewLeadDetail('${lead.id}')">View Details</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLead('${lead.id}')">&times;</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function setupSearchAndFilters() {
  const searchInput = document.getElementById('leadsSearchInput');
  const statusFilter = document.getElementById('leadStatusFilter');

  function applyFilter() {
    const q = (searchInput?.value || '').toLowerCase();
    const st = statusFilter?.value || 'ALL';

    const filtered = allLeads.filter(lead => {
      const matchQ = (lead.customerName || '').toLowerCase().includes(q) ||
                     (lead.customerEmail || '').toLowerCase().includes(q) ||
                     (lead.serviceName || '').toLowerCase().includes(q) ||
                     (lead.customerPhone || '').toLowerCase().includes(q);
      const matchSt = st === 'ALL' || lead.status === st;
      return matchQ && matchSt;
    });

    renderLeadsTable(filtered);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilter);
  if (statusFilter) statusFilter.addEventListener('change', applyFilter);
}

async function updateLeadStatus(id, newStatus) {
  try {
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (err) {
    console.error('Status update failed:', err);
  }
}

async function deleteLead(id) {
  if (!confirm('Are you sure you want to delete this lead?')) return;
  try {
    await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    await loadLeads();
    updateMetrics();
  } catch (err) {
    alert('Failed to delete lead: ' + err.message);
  }
}

// Lead Detail & Full Transcript Modal
function viewLeadDetail(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;
  currentSelectedLead = lead;

  const modal = document.getElementById('leadDetailModal');
  const body = document.getElementById('leadModalBody');

  const transcriptBubbles = (lead.transcript || []).map(item => `
    <div class="crm-bubble ${item.role}">
      <div class="crm-bubble-header">${item.role === 'agent' ? lead.agentName : (lead.customerName || 'Customer')} (${item.timestamp || 'Voice'})</div>
      <div>${item.text}</div>
    </div>
  `).join('');

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px;">
      <div style="background:rgba(0,0,0,0.25); padding:12px; border-radius:8px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:600;">CUSTOMER NAME</div>
        <div style="font-size:15px; font-weight:700; color:#fff;">${lead.customerName || 'Not given'}</div>
      </div>
      <div style="background:rgba(0,0,0,0.25); padding:12px; border-radius:8px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:600;">CONTACT EMAIL & PHONE</div>
        <div style="font-size:13px; font-weight:600; color:#38bdf8;">${lead.customerEmail || 'No email'} &bull; ${lead.customerPhone || 'No phone'}</div>
      </div>
      <div style="background:rgba(0,0,0,0.25); padding:12px; border-radius:8px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:600;">SERVICE & BUDGET</div>
        <div style="font-size:13px; font-weight:600; color:#fff;">${lead.serviceName || 'General'} (${lead.budget || 'Flexible'})</div>
      </div>
      <div style="background:rgba(0,0,0,0.25); padding:12px; border-radius:8px;">
        <div style="font-size:11px; color:#94a3b8; font-weight:600;">PREFERRED APPOINTMENT / TIME</div>
        <div style="font-size:13px; font-weight:600; color:#34d399;">${lead.preferredTime || 'Immediate'}</div>
      </div>
    </div>

    ${lead.notes ? `
    <div style="background:rgba(0,0,0,0.2); padding:10px 14px; border-radius:8px; margin-bottom:16px; font-size:13px; color:#e2e8f0;">
      <strong>Customer Notes:</strong> ${lead.notes}
    </div>
    ` : ''}

    <div style="background:rgba(16, 185, 129, 0.1); border-left:3px solid #10b981; padding:12px 14px; border-radius:4px; margin-bottom:16px;">
      <div style="font-size:11px; font-weight:700; color:#34d399; text-transform:uppercase;">AI Executive Summary</div>
      <div style="font-size:13.5px; color:#e2e8f0; margin-top:4px;">${lead.summary || 'Lead generated via website footer voice assistant.'}</div>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <h4 style="font-size:14px; font-weight:700; color:#fff;">🎙️ Full Audio Conversation Transcript (${(lead.transcript || []).length} turns)</h4>
      <span style="font-size:11px; color:#94a3b8;">Email Dispatch: ${lead.emailSent ? `Sent to ${lead.emailSentTo}` : 'Saved Locally'}</span>
    </div>

    <div class="transcript-bubble-box">
      ${transcriptBubbles || '<p style="color:#94a3b8; font-style:italic;">No recorded speech turns.</p>'}
    </div>
  `;

  modal.classList.add('open');
}

function closeLeadModal() {
  document.getElementById('leadDetailModal').classList.remove('open');
  currentSelectedLead = null;
}

// Resend Email button
document.getElementById('resendLeadEmailBtn').addEventListener('click', async () => {
  if (!currentSelectedLead) return;
  const btn = document.getElementById('resendLeadEmailBtn');
  btn.disabled = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch(`/api/leads/${currentSelectedLead.id}/resend-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success) {
      alert('Notification email successfully resent!');
    } else {
      alert('Could not resend email: ' + (data.error || 'Check SMTP settings.'));
    }
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Resend Notification Email';
  }
});

// ----------------- EMBED CODE GENERATOR ----------------- //
function initEmbedAgentSelect() {
  const select = document.getElementById('embedAgentSelect');
  if (!select) return;

  select.innerHTML = allAgents.map(a => `
    <option value="${a.id}">${a.name} (${a.serviceName})</option>
  `).join('');

  select.addEventListener('change', updateEmbedSnippets);
  updateEmbedSnippets();
}

function updateEmbedSnippets() {
  const select = document.getElementById('embedAgentSelect');
  const agentId = select?.value || allAgents[0]?.id || 'agent_digital_agency';
  const origin = window.location.origin;

  // 1. Pure Iframe Snippet
  const iframeSnippet = `<!-- AI Voice Agent Iframe Embed (Paste in website footer or body) -->
<iframe
  src="${origin}/widget/${agentId}"
  style="position:fixed;bottom:20px;right:20px;width:390px;height:610px;border:none;border-radius:22px;box-shadow:0 16px 50px rgba(0,0,0,0.5);z-index:999999;"
  allow="microphone; speech-recognition; autoplay"
  title="AI Voice Sales Agent"
></iframe>`;

  // 2. Smart Floating Button Script
  const scriptSnippet = `<!-- AI Voice Agent Smart Floating Widget (Paste before </body> in footer) -->
<script src="${origin}/embed.js" data-agent-id="${agentId}" async></script>`;

  // 3. Direct URL
  const directUrl = `${origin}/widget/${agentId}`;

  document.getElementById('iframeCodeText').textContent = iframeSnippet;
  document.getElementById('scriptCodeText').textContent = scriptSnippet;
  document.getElementById('directUrlText').textContent = directUrl;

  // Update live preview iframe
  const previewIframe = document.getElementById('livePreviewIframe');
  if (previewIframe) previewIframe.src = `/widget/${agentId}`;

  const newTabBtn = document.getElementById('openWidgetInNewTab');
  if (newTabBtn) newTabBtn.href = directUrl;
}

function copySnippet(elementId) {
  const text = document.getElementById(elementId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('Embed code copied to clipboard! Paste it into your website footer.');
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

// ----------------- SETTINGS & SMTP ----------------- //
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      if (s.smtpHost) document.getElementById('smtpHost').value = s.smtpHost;
      if (s.smtpPort) document.getElementById('smtpPort').value = s.smtpPort;
      if (s.smtpUser) document.getElementById('smtpUser').value = s.smtpUser;
      if (s.smtpPass) document.getElementById('smtpPass').value = s.smtpPass;
      if (s.notificationEmail) document.getElementById('notificationEmail').value = s.notificationEmail;
      if (s.emailFromName) document.getElementById('emailFromName').value = s.emailFromName;
      if (s.geminiApiKey) document.getElementById('geminiApiKey').value = s.geminiApiKey;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function setupSettingsForm() {
  const form = document.getElementById('settingsForm');
  const feedback = document.getElementById('settingsFeedback');
  const testBtn = document.getElementById('testSmtpBtn');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        smtpHost: document.getElementById('smtpHost').value.trim(),
        smtpPort: parseInt(document.getElementById('smtpPort').value.trim(), 10),
        smtpUser: document.getElementById('smtpUser').value.trim(),
        smtpPass: document.getElementById('smtpPass').value.trim(),
        notificationEmail: document.getElementById('notificationEmail').value.trim(),
        emailFromName: document.getElementById('emailFromName').value.trim(),
        geminiApiKey: document.getElementById('geminiApiKey').value.trim()
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          feedback.innerHTML = `<span style="color:#34d399;">✓ Settings saved successfully!</span>`;
          setTimeout(() => { feedback.innerHTML = ''; }, 3000);
        }
      } catch (err) {
        feedback.innerHTML = `<span style="color:#f87171;">Failed to save settings: ${err.message}</span>`;
      }
    });
  }

  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const email = document.getElementById('notificationEmail').value.trim();
      if (!email) {
        alert('Please enter an Admin Notification Recipient Email first.');
        return;
      }

      testBtn.disabled = true;
      testBtn.textContent = 'Sending test...';
      feedback.innerHTML = `<span style="color:#38bdf8;">Connecting to SMTP server and dispatching test email...</span>`;

      try {
        const res = await fetch('/api/send-test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          feedback.innerHTML = `<span style="color:#34d399;">🎉 Success! Test email delivered to ${email}. Message ID: ${data.messageId}</span>`;
        } else {
          feedback.innerHTML = `<span style="color:#f87171;">SMTP Test Failed: ${data.error}</span>`;
        }
      } catch (err) {
        feedback.innerHTML = `<span style="color:#f87171;">Connection error: ${err.message}</span>`;
      } finally {
        testBtn.disabled = false;
        testBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Send Test Email`;
      }
    });
  }
}

function updateMetrics() {
  const emailsSent = allLeads.filter(l => l.emailSent).length;
  document.getElementById('statEmailsSent').textContent = emailsSent;

  if (allLeads.length > 0) {
    const qualified = allLeads.filter(l => l.status === 'Qualified').length;
    const rate = Math.round((qualified / allLeads.length) * 100);
    document.getElementById('statConversion').textContent = `${rate}%`;
  }
}

// Global modal triggers
document.getElementById('openNewAgentModalBtn')?.addEventListener('click', () => openAgentModal());
