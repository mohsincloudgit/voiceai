import nodemailer from 'nodemailer';

export function getEmailTransporter(settings = {}) {
  const host = settings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(settings.smtpPort || process.env.SMTP_PORT || '587', 10);
  const secure = settings.smtpSecure !== undefined ? Boolean(settings.smtpSecure) : (process.env.SMTP_SECURE === 'true');
  const user = settings.smtpUser || process.env.SMTP_USER || '';
  const rawPass = settings.smtpPass || process.env.SMTP_PASS || '';
  const pass = rawPass.replace(/\s+/g, '');

  if (!user || !pass) {
    return null;
  }

  const isGmail = host.toLowerCase().includes('gmail.com');
  const transportOptions = {
    host,
    port,
    secure: port === 465 ? true : secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }
  };

  if (isGmail && (port === 587 || port === 465)) {
    transportOptions.service = 'gmail';
  }

  return nodemailer.createTransport(transportOptions);
}

export function generateLeadEmailHtml(lead, agent) {
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
