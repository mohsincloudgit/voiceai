import { NextResponse } from 'next/server';
import { AGENTS_FILE, LEADS_FILE, SETTINGS_FILE, readJson } from '@/lib/db';
import { getEmailTransporter, generateLeadEmailHtml } from '@/lib/email';

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const leads = readJson(LEADS_FILE, []);
    const agents = readJson(AGENTS_FILE, []);
    const settings = readJson(SETTINGS_FILE, {});

    const lead = leads.find(l => l.id === id);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const agent = agents.find(a => a.id === lead.agentId);
    const toEmail = body.recipient || settings.notificationEmail || agent?.notificationEmail;

    if (!toEmail) {
      return NextResponse.json({ success: false, error: 'No recipient email specified' }, { status: 400 });
    }

    const transporter = getEmailTransporter(settings);
    if (!transporter) {
      return NextResponse.json({
        success: false,
        error: 'SMTP settings not configured. Please configure in CRM Settings.'
      }, { status: 400 });
    }

    await transporter.sendMail({
      from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${settings.smtpUser}>`,
      to: toEmail,
      subject: `[Resent] 🎙️ Lead Transcript: ${lead.customerName} - ${lead.serviceName}`,
      html: generateLeadEmailHtml(lead, agent)
    });

    return NextResponse.json({ success: true, message: `Email resent to ${toEmail}` });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
