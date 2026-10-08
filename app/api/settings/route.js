import { NextResponse } from 'next/server';
import { SETTINGS_FILE, readJson, writeJson } from '@/lib/db';

export async function GET() {
  const fileSettings = readJson(SETTINGS_FILE, {});
  const host = fileSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = fileSettings.smtpPort || parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = fileSettings.smtpSecure !== undefined ? fileSettings.smtpSecure : (process.env.SMTP_SECURE === 'true');
  const user = fileSettings.smtpUser || process.env.SMTP_USER || '';
  const pass = fileSettings.smtpPass || process.env.SMTP_PASS || '';
  const notifEmail = fileSettings.notificationEmail || process.env.NOTIFICATION_EMAIL || '';
  const geminiKey = fileSettings.geminiApiKey || process.env.GEMINI_API_KEY || '';

  const safeSettings = {
    ...fileSettings,
    smtpHost: host,
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: user,
    smtpPass: pass ? '••••••••' : '',
    notificationEmail: notifEmail,
    geminiApiKey: geminiKey ? `${geminiKey.slice(0, 6)}...` : '',
    isSmtpConfigured: !!(user && pass),
    isGeminiConfigured: !!geminiKey
  };
  return NextResponse.json({ success: true, settings: safeSettings });
}

export async function POST(request) {
  try {
    const currentSettings = readJson(SETTINGS_FILE, {});
    const newSettings = await request.json();

    if (newSettings.smtpPass === '••••••••') {
      newSettings.smtpPass = currentSettings.smtpPass;
    }
    if (newSettings.geminiApiKey && newSettings.geminiApiKey.includes('...')) {
      newSettings.geminiApiKey = currentSettings.geminiApiKey;
    }

    const merged = { ...currentSettings, ...newSettings };
    writeJson(SETTINGS_FILE, merged);

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
