import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getAgents, getLeads, saveLead, getSettings } from '@/lib/db';
import { getEmailTransporter, generateLeadEmailHtml } from '@/lib/email';

export async function GET() {
  try {
    const leads = await getLeads();
    return NextResponse.json({ success: true, leads });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
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
    } = body;

    const agents = await getAgents();
    const settings = await getSettings();

    const agent = agents.find(a => a.id === agentId) || {
      name: 'AI Sales Assistant',
      serviceName: 'Consultation Services',
      notificationEmail: settings.notificationEmail
    };

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

    const recipients = new Set();
    if (settings.notificationEmail) recipients.add(settings.notificationEmail);
    if (agent.notificationEmail) recipients.add(agent.notificationEmail);
    if (process.env.NOTIFICATION_EMAIL) recipients.add(process.env.NOTIFICATION_EMAIL);
    if (settings.sendCustomerCopy && customerEmail && customerEmail.includes('@')) {
      recipients.add(customerEmail);
    }

    const toAddresses = Array.from(recipients).filter(Boolean).join(', ');

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

    const savedLead = await saveLead(newLead);

    return NextResponse.json({
      success: true,
      lead: savedLead,
      emailStatus,
      emailPreviewUrl
    });
  } catch (err) {
    console.error('Error submitting lead:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
