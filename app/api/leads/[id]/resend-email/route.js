import { NextResponse } from 'next/server';
import { getLeadById, getAgentById, getSettings } from '@/lib/db';
import { getEmailTransporter, generateLeadEmailHtml } from '@/lib/email';

export async function POST(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const lead = await getLeadById(id);
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    const agent = await getAgentById(lead.agentId);
    const settings = await getSettings();

    const toEmail = body.recipient || settings.notificationEmail || agent?.notificationEmail || process.env.NOTIFICATION_EMAIL;

    if (!toEmail) {
      return NextResponse.json({ success: false, error: 'No recipient email specified' }, { status: 400 });
    }

    const transporter = getEmailTransporter(settings);
    if (!transporter) {
      return NextResponse.json({
        success: false,
        error: 'SMTP settings not configured. Please configure in CRM Settings or .env.'
      }, { status: 400 });
    }

    const fromEmail = settings.smtpUser || process.env.SMTP_USER;
    await transporter.sendMail({
      from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${fromEmail}>`,
      to: toEmail,
      subject: `[Resent] 🎙️ Lead Transcript: ${lead.customerName} - ${lead.serviceName}`,
      html: generateLeadEmailHtml(lead, agent)
    });

    return NextResponse.json({ success: true, message: `Email resent to ${toEmail}` });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
