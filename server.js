const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for external website embeds & iframes
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Data file paths
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const AGENTS_FILE = path.join(DATA_DIR, 'agents.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Helper to read JSON
function readJson(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

// Helper to write JSON
function writeJson(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Nodemailer Transporter Helper
function getEmailTransporter(settings) {
  const host = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(settings.smtpPort || process.env.SMTP_PORT || '587', 10);
  const secure = settings.smtpSecure || process.env.SMTP_SECURE === 'true' || false;
  const user = settings.smtpUser || process.env.SMTP_USER || '';
  const pass = settings.smtpPass || process.env.SMTP_PASS || '';

  if (!user || !pass) {
    // If SMTP not fully configured, return null for mock / preview mode
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  });
}

// Generate Rich HTML Email Template
function generateLeadEmailHtml(lead, agent) {
  const transcriptHtml = (lead.transcript || []).map(item => {
    const isAgent = item.role === 'agent';
    return `
      <div style="margin-bottom: 12px; padding: 10px 14px; border-radius: 8px; background-color: ${isAgent ? '#f3f4f6' : '#e0e7ff'};">
        <div style="font-size: 11px; font-weight: 700; color: ${isAgent ? '#4b5563' : '#4338ca'}; text-transform: uppercase; margin-bottom: 4px;">
          ${isAgent ? (agent ? agent.name : 'AI Voice Agent') : 'Customer'} (${item.timestamp || 'Just now'})
        </div>
        <div style="font-size: 14px; line-height: 1.5; color: #1f2937;">
          ${item.text}
        </div>
      </div>
    `;
  }).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
      .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
      .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 24px; text-align: center; }
      .header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; }
      .header p { margin: 0; font-size: 14px; opacity: 0.9; }
      .content { padding: 24px; }
      .badge { display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 20px; background: #ecfdf5; color: #059669; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 18px 0; }
      .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
      .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
      .card-val { font-size: 14px; font-weight: 600; color: #0f172a; word-break: break-word; }
      .section-title { font-size: 16px; font-weight: 700; margin: 24px 0 12px; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
      .summary-box { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 14px; border-radius: 4px; margin-bottom: 20px; font-size: 14px; line-height: 1.6; color: #166534; }
      .transcript-container { max-height: 450px; overflow-y: auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
      .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
      @media (max-width: 550px) { .grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎙️ New Voice Agent Lead & Full Transcript</h1>
        <p>Service: <strong>${lead.serviceName || 'Custom Service'}</strong> &bull; Agent: <strong>${lead.agentName || 'AI Agent'}</strong></p>
      </div>

      <div class="content">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="badge">Status: ${lead.status || 'Qualified'}</span>
          <span style="font-size: 12px; color: #64748b;">${new Date().toLocaleString()}</span>
        </div>

        <h3 class="section-title">📋 Customer & Requirement Details</h3>
        <div class="grid">
          <div class="card">
            <div class="card-title">Full Name</div>
            <div class="card-val">${lead.customerName || 'Not specified'}</div>
          </div>
          <div class="card">
            <div class="card-title">Phone Number</div>
            <div class="card-val">${lead.customerPhone || 'Not specified'}</div>
          </div>
          <div class="card">
            <div class="card-title">Email Address</div>
            <div class="card-val">${lead.customerEmail || 'Not specified'}</div>
          </div>
          <div class="card">
            <div class="card-title">Target Budget</div>
            <div class="card-val">${lead.budget || 'Not specified'}</div>
          </div>
          <div class="card">
            <div class="card-title">Preferred Date / Time</div>
            <div class="card-val">${lead.preferredTime || 'Immediate / Flexible'}</div>
          </div>
          <div class="card">
            <div class="card-title">Service Requested</div>
            <div class="card-val">${lead.serviceName || 'Consultation'}</div>
          </div>
        </div>

        ${lead.notes ? `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title">Special Notes / Requirements</div>
          <div class="card-val" style="font-weight: 400; color: #334155;">${lead.notes}</div>
        </div>
        ` : ''}

        <h3 class="section-title">✨ AI Executive Summary</h3>
        <div class="summary-box">
          ${lead.summary || 'Customer engaged with the AI Voice agent on the website, explored service details, answered qualification questions, and confirmed their contact submission.'}
        </div>

        <h3 class="section-title">💬 Full Audio Conversation Transcript</h3>
        <div class="transcript-container">
          ${transcriptHtml || '<p style="color:#94a3b8; font-style: italic;">No conversation messages recorded.</p>'}
        </div>
      </div>

      <div class="footer">
        Automated Notification by <strong>AI Voice Agent CRM Engine</strong> &bull; Embedded Footer Widget
      </div>
    </div>
  </body>
  </html>
  `;
}

// ----------------- ROUTES ----------------- //

// 1. Get all agents
app.get('/api/agents', (req, res) => {
  const agents = readJson(AGENTS_FILE, []);
  res.json({ success: true, agents });
});

// 2. Get single agent by ID
app.get('/api/agents/:id', (req, res) => {
  const agents = readJson(AGENTS_FILE, []);
  const agent = agents.find(a => a.id === req.params.id);
  if (!agent) {
    return res.status(404).json({ success: false, error: 'Agent not found' });
  }
  res.json({ success: true, agent });
});

// 3. Create or update agent
app.post('/api/agents', (req, res) => {
  const agents = readJson(AGENTS_FILE, []);
  const agentData = req.body;

  if (!agentData.id) {
    agentData.id = 'agent_' + Date.now();
  }

  const existingIndex = agents.findIndex(a => a.id === agentData.id);
  if (existingIndex >= 0) {
    agents[existingIndex] = { ...agents[existingIndex], ...agentData };
  } else {
    agents.push(agentData);
  }

  writeJson(AGENTS_FILE, agents);
  res.json({ success: true, agent: agentData });
});

// 4. Delete agent
app.delete('/api/agents/:id', (req, res) => {
  let agents = readJson(AGENTS_FILE, []);
  agents = agents.filter(a => a.id !== req.params.id);
  writeJson(AGENTS_FILE, agents);
  res.json({ success: true, message: 'Agent deleted' });
});

// 5. Get leads
app.get('/api/leads', (req, res) => {
  const leads = readJson(LEADS_FILE, []);
  res.json({ success: true, leads });
});

// 6. Get single lead
app.get('/api/leads/:id', (req, res) => {
  const leads = readJson(LEADS_FILE, []);
  const lead = leads.find(l => l.id === req.params.id);
  if (!lead) {
    return res.status(404).json({ success: false, error: 'Lead not found' });
  }
  res.json({ success: true, lead });
});

// 7. Update lead status
app.patch('/api/leads/:id', (req, res) => {
  const leads = readJson(LEADS_FILE, []);
  const leadIndex = leads.findIndex(l => l.id === req.params.id);
  if (leadIndex === -1) {
    return res.status(404).json({ success: false, error: 'Lead not found' });
  }
  leads[leadIndex] = { ...leads[leadIndex], ...req.body };
  writeJson(LEADS_FILE, leads);
  res.json({ success: true, lead: leads[leadIndex] });
});

// 8. Delete lead
app.delete('/api/leads/:id', (req, res) => {
  let leads = readJson(LEADS_FILE, []);
  leads = leads.filter(l => l.id !== req.params.id);
  writeJson(LEADS_FILE, leads);
  res.json({ success: true, message: 'Lead deleted' });
});

// 9. Conversational AI Chat Endpoint (Knowledge-based reasoning)
app.post('/api/chat', async (req, res) => {
  try {
    const { agentId, message, conversationHistory = [] } = req.body;
    const agents = readJson(AGENTS_FILE, []);
    const settings = readJson(SETTINGS_FILE, {});
    const agent = agents.find(a => a.id === agentId) || agents[0];

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    // Build custom knowledge base prompt
    const kbText = (agent.knowledgeBase || [])
      .map(k => `[Topic: ${k.topic}]\n${k.content}`)
      .join('\n\n');

    const qualificationQuestions = (agent.qualificationQuestions || []).join('\n- ');
    const objections = (agent.objectionHandling || [])
      .map(o => `Objection: "${o.objection}" -> Counter-Response: "${o.counter}"`)
      .join('\n');

    const systemPrompt = `
You are "${agent.name}", a professional, friendly, high-converting voice sales representative.
Service You Are Selling: ${agent.serviceName}
Your Persona and Voice Tone: ${agent.voicePitch || 'Helpful, consultative, concise, natural speaking voice.'}

### STRICT VOICE CONVERSATION GUIDELINES:
1. You are speaking through audio (Text-to-Speech). Keep your answers punchy, natural, conversational, and direct (1 to 3 short sentences per turn). Avoid robotic lists or long bullet points.
2. Answer the user's questions strictly using your KNOWLEDGE BASE below. If something isn't in your knowledge base, answer courteously and guide them towards booking a tailored consultation.
3. Your primary sales goal is to qualify the prospect, answer objections gracefully, and collect/confirm their booking details:
   - Full Name
   - Phone Number
   - Email Address
   - Budget or Timeline
4. When the user provides contact details or confirms they want the service, warmly thank them and confirm that their request has been logged and the full conversation transcript and details are being sent to their email.

### CUSTOM KNOWLEDGE BASE:
${kbText || 'High quality professional services tailored to customer goals.'}

### KEY QUALIFICATION QUESTIONS TO ASK NATURALLY:
- ${qualificationQuestions || 'What is your current requirement and budget?'}

### OBJECTION HANDLING RULES:
${objections || 'Address concerns respectfully and focus on ROI.'}

### CLOSING CONFIRMATION:
${agent.confirmationFlow ? agent.confirmationFlow.closingQuestion : 'Would you like to book a quick consultation? What is your name and phone number?'}

Respond directly with your spoken response. Do not include markdown bold or internal monologue. Keep it ready to be spoken aloud.
`;

    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    let aiResponseText = '';

    // If Gemini API Key is configured, use Google GenAI
    if (apiKey) {
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        
        // Prepare contents
        const contents = [
          { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION:\n${systemPrompt}` }] },
          { role: 'model', parts: [{ text: `Understood! I am ${agent.name}. I will speak concisely and follow my knowledge base.` }] }
        ];

        // Append past conversation
        conversationHistory.forEach(item => {
          contents.push({
            role: item.role === 'agent' ? 'model' : 'user',
            parts: [{ text: item.text }]
          });
        });

        // Append current message
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents
        });

        if (response && response.text) {
          aiResponseText = response.text.trim();
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, using intelligent rule-based knowledge fallback:', geminiErr.message);
      }
    }

    // High-fidelity fallback dialogue manager (zero downtime even without API key!)
    if (!aiResponseText) {
      const lower = (message || '').toLowerCase();

      // Check for price / cost
      if (lower.includes('price') || lower.includes('cost') || lower.includes('package') || lower.includes('rate') || lower.includes('how much')) {
        const priceKb = (agent.knowledgeBase || []).find(k => k.topic.toLowerCase().includes('price') || k.content.toLowerCase().includes('$') || k.content.toLowerCase().includes('package'));
        if (priceKb) {
          aiResponseText = `${priceKb.content} Does that align with your budget?`;
        } else {
          aiResponseText = `Our pricing starts flexibly based on your specific requirements. Would you like a custom estimate?`;
        }
      }
      // Check for objections (expensive, cheaper)
      else if (lower.includes('expensive') || lower.includes('high') || lower.includes('discount') || lower.includes('cheaper')) {
        const obj = (agent.objectionHandling || [])[0];
        aiResponseText = obj ? obj.counter : `We offer flexible payment terms and proven ROI. What budget did you have in mind?`;
      }
      // Check for contact details provided
      else if (lower.includes('@') || lower.match(/\b\d{7,14}\b/) || lower.includes('my name is') || lower.includes('call me')) {
        aiResponseText = agent.confirmationFlow && agent.confirmationFlow.successMessage 
          ? agent.confirmationFlow.successMessage 
          : `Thank you! I have recorded your details and sent our team and your email the full conversation summary. We look forward to speaking with you!`;
      }
      // Check for service inquiry
      else if (lower.includes('service') || lower.includes('what do you do') || lower.includes('help') || lower.includes('offer')) {
        const serviceKb = (agent.knowledgeBase || []).find(k => k.topic.toLowerCase().includes('service'));
        aiResponseText = serviceKb 
          ? `${serviceKb.content} What specific goal are you looking to achieve?`
          : `We specialize in ${agent.serviceName}. May I ask what specific outcome you are targeting?`;
      }
      // General qualification flow
      else {
        // Pick an unasked qualification question or knowledge item
        const nextQ = (agent.qualificationQuestions || [])[0] || 'Could you share what you are looking to get done?';
        aiResponseText = `Understood! Regarding ${agent.serviceName}: ${nextQ}`;
      }
    }

    // Check if user has provided lead info in this exchange
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const phoneRegex = /(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d]{3}[-.\s]?[\d]{4}/;
    const detectedEmail = (message.match(emailRegex) || [])[0] || null;
    const detectedPhone = (message.match(phoneRegex) || [])[0] || null;

    res.json({
      success: true,
      response: aiResponseText,
      detectedInfo: {
        email: detectedEmail,
        phone: detectedPhone
      }
    });

  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Submit Lead & Dispatch Email (Full Convo + Form details)
app.post('/api/leads', async (req, res) => {
  try {
    const {
      agentId,
      customerName,
      customerEmail,
      customerPhone,
      budget,
      preferredTime,
      notes,
      transcript = [],
      summary
    } = req.body;

    const agents = readJson(AGENTS_FILE, []);
    const settings = readJson(SETTINGS_FILE, {});
    const leads = readJson(LEADS_FILE, []);

    const agent = agents.find(a => a.id === agentId) || {
      name: 'AI Sales Assistant',
      serviceName: 'Consultation Services',
      notificationEmail: settings.notificationEmail
    };

    // Auto-generate summary if missing
    let finalSummary = summary;
    if (!finalSummary && transcript.length > 0) {
      finalSummary = `Customer ${customerName || 'Inquirer'} engaged with ${agent.name} for ${agent.serviceName}. Exchanged ${transcript.length} voice messages and submitted their contact information for follow up.`;
    }

    const newLead = {
      id: 'lead_' + Date.now(),
      agentId: agent.id || agentId,
      agentName: agent.name,
      serviceName: agent.serviceName,
      customerName: customerName || 'Website Visitor',
      customerEmail: customerEmail || 'N/A',
      customerPhone: customerPhone || 'N/A',
      budget: budget || 'To be discussed',
      preferredTime: preferredTime || 'Flexible',
      notes: notes || '',
      status: 'Qualified',
      summary: finalSummary || 'New voice inquiry received.',
      transcript: transcript,
      emailSent: false,
      emailSentTo: '',
      createdAt: new Date().toISOString()
    };

    // Recipient list: Admin Notification Email + Agent Specific Email + optionally Customer Copy
    const recipients = new Set();
    if (settings.notificationEmail) recipients.add(settings.notificationEmail);
    if (agent.notificationEmail) recipients.add(agent.notificationEmail);
    if (process.env.NOTIFICATION_EMAIL) recipients.add(process.env.NOTIFICATION_EMAIL);
    if (settings.sendCustomerCopy && customerEmail && customerEmail.includes('@')) {
      recipients.add(customerEmail);
    }

    const toAddresses = Array.from(recipients).filter(Boolean).join(', ');

    // Attempt email delivery
    let emailStatus = 'skipped_no_config';
    let emailPreviewUrl = null;

    try {
      const transporter = getEmailTransporter(settings);

      if (transporter && toAddresses) {
        const mailOptions = {
          from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${settings.smtpUser || 'noreply@crm-voice.com'}>`,
          to: toAddresses,
          subject: `🎙️ New Lead: ${customerName || 'Website Visitor'} - ${agent.serviceName}`,
          html: generateLeadEmailHtml(newLead, agent)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Lead notification email sent successfully:', info.messageId);
        newLead.emailSent = true;
        newLead.emailSentTo = toAddresses;
        emailStatus = 'sent';
      } else {
        // If SMTP credentials are not yet entered, generate a test preview account with Ethereal so user can see the email immediately!
        try {
          const testAccount = await nodemailer.createTestAccount();
          const testTransporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass
            }
          });

          const testInfo = await testTransporter.sendMail({
            from: `"AI Voice Agent CRM" <${testAccount.user}>`,
            to: toAddresses || 'demo@clientcrm.com',
            subject: `🎙️ [DEMO] New Lead: ${customerName || 'Website Visitor'} - ${agent.serviceName}`,
            html: generateLeadEmailHtml(newLead, agent)
          });

          emailPreviewUrl = nodemailer.getTestMessageUrl(testInfo);
          newLead.emailSent = true;
          newLead.emailSentTo = `${toAddresses || 'demo@clientcrm.com'} (Ethereal Preview)`;
          newLead.emailPreviewUrl = emailPreviewUrl;
          emailStatus = 'sent_preview';
          console.log('Demo email preview available at:', emailPreviewUrl);
        } catch (etherealErr) {
          console.log('Local email logged (no SMTP server configured yet).');
          newLead.emailSent = false;
          newLead.emailSentTo = toAddresses || 'Not configured in settings';
          emailStatus = 'logged_locally';
        }
      }
    } catch (mailErr) {
      console.error('Failed to send lead email:', mailErr.message);
      newLead.emailSent = false;
      newLead.emailSentTo = mailErr.message;
      emailStatus = 'failed: ' + mailErr.message;
    }

    leads.unshift(newLead);
    writeJson(LEADS_FILE, leads);

    res.json({
      success: true,
      lead: newLead,
      emailStatus,
      emailPreviewUrl
    });

  } catch (err) {
    console.error('Error submitting lead:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Resend Email for existing lead
app.post('/api/leads/:id/resend-email', async (req, res) => {
  try {
    const leads = readJson(LEADS_FILE, []);
    const agents = readJson(AGENTS_FILE, []);
    const settings = readJson(SETTINGS_FILE, {});

    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const agent = agents.find(a => a.id === lead.agentId);
    const toEmail = req.body.recipient || settings.notificationEmail || agent?.notificationEmail;

    if (!toEmail) {
      return res.status(400).json({ success: false, error: 'No recipient email specified' });
    }

    const transporter = getEmailTransporter(settings);
    if (!transporter) {
      return res.status(400).json({ success: false, error: 'SMTP settings not configured. Please configure in CRM Settings.' });
    }

    await transporter.sendMail({
      from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${settings.smtpUser}>`,
      to: toEmail,
      subject: `[Resent] 🎙️ Lead Transcript: ${lead.customerName} - ${lead.serviceName}`,
      html: generateLeadEmailHtml(lead, agent)
    });

    res.json({ success: true, message: `Email resent to ${toEmail}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 12. Settings Endpoints
app.get('/api/settings', (req, res) => {
  const settings = readJson(SETTINGS_FILE, {});
  // Mask password for safety
  const safeSettings = {
    ...settings,
    smtpPass: settings.smtpPass ? '••••••••' : '',
    geminiApiKey: settings.geminiApiKey ? `${settings.geminiApiKey.slice(0, 6)}...` : ''
  };
  res.json({ success: true, settings: safeSettings });
});

app.post('/api/settings', (req, res) => {
  const currentSettings = readJson(SETTINGS_FILE, {});
  const newSettings = req.body;

  // Don't overwrite password if masked string passed back
  if (newSettings.smtpPass === '••••••••') {
    newSettings.smtpPass = currentSettings.smtpPass;
  }
  if (newSettings.geminiApiKey && newSettings.geminiApiKey.includes('...')) {
    newSettings.geminiApiKey = currentSettings.geminiApiKey;
  }

  const merged = { ...currentSettings, ...newSettings };
  writeJson(SETTINGS_FILE, merged);
  res.json({ success: true, message: 'Settings saved successfully' });
});

// 13. Test SMTP Endpoint
app.post('/api/send-test-email', async (req, res) => {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const targetEmail = req.body.email || settings.notificationEmail;

    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Target email is required' });
    }

    const transporter = getEmailTransporter(settings);
    if (!transporter) {
      return res.status(400).json({ success: false, error: 'SMTP user and password are required. Please configure them in Settings.' });
    }

    const info = await transporter.sendMail({
      from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${settings.smtpUser}>`,
      to: targetEmail,
      subject: '✅ Voice Agent CRM: SMTP Connection Test Successful',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5;">🎉 SMTP Test Successful!</h2>
          <p>Your Voice Agent CRM email dispatcher is connected and ready to send leads, qualification forms, and complete audio conversation transcripts.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="font-size: 12px; color: #64748b;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `
    });

    res.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('Test email failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 14. Render Widget for Iframe
app.get('/widget/:agentId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'widget.html'));
});

// 15. Render Embed Script
app.get('/embed.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'embed.js'));
});

// 16. Demo Client Website
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'demo.html'));
});

// 17. Main CRM Dashboard Fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🎙️  AI Voice Agent CRM Server Running!`);
  console.log(`🚀  Dashboard: http://localhost:${PORT}`);
  console.log(`🌐  Widget Preview: http://localhost:${PORT}/widget/agent_digital_agency`);
  console.log(`📄  Demo Client Page: http://localhost:${PORT}/demo`);
  console.log(`===============================================`);
});
