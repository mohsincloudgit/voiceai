import { NextResponse } from 'next/server';
import { getSettings, saveSettings, getDatabaseStatus } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request) {
  const user = getUserFromRequest(request);
  const dbStatus = getDatabaseStatus();

  // Only Super Admin can view SMTP & API credentials
  if (!user || user.role !== 'superadmin') {
    return NextResponse.json({
      success: true,
      settings: {
        dbStatus,
        isSmtpConfigured: false,
        isGeminiConfigured: false
      }
    });
  }

  const currentSettings = await getSettings();
  const host = currentSettings.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = currentSettings.smtpPort || parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = currentSettings.smtpSecure !== undefined ? currentSettings.smtpSecure : (process.env.SMTP_SECURE === 'true');
  const smtpUser = currentSettings.smtpUser || process.env.SMTP_USER || '';
  const smtpPass = currentSettings.smtpPass || process.env.SMTP_PASS || '';
  const notifEmail = currentSettings.notificationEmail || process.env.NOTIFICATION_EMAIL || '';
  const geminiKey = currentSettings.geminiApiKey || process.env.GEMINI_API_KEY || '';

  const safeSettings = {
    ...currentSettings,
    smtpHost: host,
    smtpPort: port,
    smtpSecure: secure,
    smtpUser: smtpUser,
    smtpPass: smtpPass ? '••••••••' : '',
    notificationEmail: notifEmail,
    geminiApiKey: geminiKey ? `${geminiKey.slice(0, 6)}...` : '',
    isSmtpConfigured: !!(smtpUser && smtpPass),
    isGeminiConfigured: !!geminiKey,
    dbStatus
  };
  return NextResponse.json({ success: true, settings: safeSettings });
}

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    // Strictly ONLY Super Admin can update settings
    if (!user || user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Permission denied: Only Super Main Admin can update system settings' },
        { status: 403 }
      );
    }

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
