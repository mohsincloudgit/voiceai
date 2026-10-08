import { NextResponse } from 'next/server';
import { getSettings, saveSettings, getDatabaseStatus } from '@/lib/db';

export async function GET() {
  const currentSettings = await getSettings();
  const host = currentSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = currentSettings.smtpPort || parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = currentSettings.smtpSecure !== undefined ? currentSettings.smtpSecure : (process.env.SMTP_SECURE === 'true');
  const user = currentSettings.smtpUser || process.env.SMTP_USER || '';
  const pass = currentSettings.smtpPass || process.env.SMTP_PASS || '';
  const notifEmail = currentSettings.notificationEmail || process.env.NOTIFICATION_EMAIL || '';
  const geminiKey = currentSettings.geminiApiKey || process.env.GEMINI_API_KEY || '';

  const dbStatus = getDatabaseStatus();

  const safeSettings = {
    ...currentSettings,
    smtpHost: host,
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: user,
    smtpPass: pass ? '••••••••' : '',
    notificationEmail: notifEmail,
    geminiApiKey: geminiKey ? `${geminiKey.slice(0, 6)}...` : '',
    isSmtpConfigured: !!(user && pass),
    isGeminiConfigured: !!geminiKey,
    dbStatus
  };
  return NextResponse.json({ success: true, settings: safeSettings });
}

export async function POST(request) {
  try {
    const currentSettings = await getSettings();
    const newSettings = await request.json();

    if (newSettings.smtpPass === '••••••••') {
      newSettings.smtpPass = currentSettings.smtpPass || process.env.SMTP_PASS || '';
    }
    if (newSettings.geminiApiKey && newSettings.geminiApiKey.includes('...')) {
      newSettings.geminiApiKey = currentSettings.geminiApiKey || process.env.GEMINI_API_KEY || '';
    }

    const merged = { ...currentSettings, ...newSettings };
    const saved = await saveSettings(merged);

    return NextResponse.json({ success: true, message: 'Settings saved successfully', settings: saved });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
