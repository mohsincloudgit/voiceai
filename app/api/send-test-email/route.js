import { NextResponse } from 'next/server';
import { SETTINGS_FILE, readJson } from '@/lib/db';
import { getEmailTransporter } from '@/lib/email';

export async function POST(request) {
  try {
    const settings = readJson(SETTINGS_FILE, {});
    const body = await request.json().catch(() => ({}));
    const targetEmail = body.email || settings.notificationEmail;

    if (!targetEmail) {
      return NextResponse.json({ success: false, error: 'Target email is required' }, { status: 400 });
    }

    const transporter = getEmailTransporter(settings);
    if (!transporter) {
      return NextResponse.json({
        success: false,
        error: 'SMTP user and password are required. Please configure them in Settings.'
      }, { status: 400 });
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

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err) {
    console.error('Test email failed:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
