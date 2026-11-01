import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD || process.env.BREVO_API_KEY;

  if (user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    console.log(`[Email Service] Configured SMTP server: ${host}:${port} (${user})`);
  } else {
    // Development fallback using Nodemailer test account (Ethereal)
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email Service] No Brevo/SMTP credentials found in .env. Using Ethereal test account (${testAccount.user})`);
    } catch (err) {
      console.warn('[Email Service] Could not connect to Ethereal, falling back to log transport');
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
}

export interface SendOTPOptions {
  to: string;
  otp: string;
  name?: string;
  purpose?: 'verification' | 'password-reset' | 'change-email';
}

function getEmailContent({ to, otp, name, purpose = 'verification' }: SendOTPOptions) {
  if (purpose === 'password-reset') {
    return {
      subject: `${otp} is your AquaNova Password Reset Code`,
      title: 'Password Reset Request',
      subtitle: 'AquaNova Account Recovery',
      greeting: `Hello ${name || 'AquaNova User'},`,
      lead: `We received a request to reset the password for your AquaNova account (${to}). Please use the following 6-digit verification code to set your new password:`,
      warning: `⏱️ <strong>This reset code is valid for 10 minutes.</strong><br/>🔒 If you did not request a password reset, please ignore this email or secure your account.`,
      text: `Your AquaNova password reset code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request a password reset, please ignore this email.`,
    };
  }

  if (purpose === 'change-email') {
    return {
      subject: `${otp} is your AquaNova Email Verification Code`,
      title: 'Verify New Email Address',
      subtitle: 'AquaNova Account Security',
      greeting: `Hello ${name || 'AquaNova User'},`,
      lead: `Please use the following 6-digit verification code to confirm your email update:`,
      warning: `⏱️ <strong>This code is valid for 10 minutes.</strong><br/>🔒 For security reasons, do not share this code with anyone.`,
      text: `Your AquaNova email verification code is: ${otp}\n\nThis code will expire in 10 minutes.`,
    };
  }

  return {
    subject: `${otp} is your AquaNova Verification Code`,
    title: 'Account Email Verification',
    subtitle: 'Welcome to AquaNova',
    greeting: `Hello ${name || 'AquaNova User'},`,
    lead: `Thank you for registering with AquaNova. Please use the following 6-digit One-Time Password (OTP) to complete your email verification:`,
    warning: `⏱️ <strong>This OTP is valid for 10 minutes.</strong><br/>🔒 For security reasons, do not share this OTP with anyone.<br/>If you did not request this email, please ignore it or contact support.`,
    text: `Your AquaNova verification OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.\nIf you did not create an account, please ignore this email.`,
  };
}

/**
 * Send Transactional Email using Brevo REST API v3
 */
async function sendViaBrevoAPI(options: SendOTPOptions, apiKey: string): Promise<boolean> {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@aquanova.io';
  const fromName = process.env.EMAIL_FROM_NAME || 'AquaNova Smart Aquaculture';
  const content = getEmailContent(options);

  const payload = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: options.to, name: options.name || 'AquaNova User' }],
    subject: content.subject,
    textContent: content.text,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 22px; font-weight: 700;">AquaNova Smart Aquaculture</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">${content.subtitle}</p>
        </div>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0f172a;">${content.title}</h3>
          <p style="color: #334155; font-size: 14px; margin: 0 0 12px 0;">${content.greeting}</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">${content.lead}</p>
        </div>
        
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #0369a1; background-color: #f0f9ff; padding: 12px 32px; border-radius: 10px; border: 1px solid #bae6fd; display: inline-block;">
            ${options.otp}
          </span>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
          ${content.warning}
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          © 2026 AquaNova Smart Aquaculture Inc. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.warn(`⚠️ [Brevo API Notice] Status ${res.status}:`, data.message || data.code || 'API error');
      return false;
    }

    console.log('\n==================================================');
    console.log(`📧 [BREVO REAL-TIME EMAIL DELIVERED] (${options.purpose || 'verification'})`);
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${content.subject}`);
    console.log(`OTP Code: >>>  ${options.otp}  <<<`);
    console.log(`Expiry: 10 minutes`);
    console.log('==================================================\n');

    return true;
  } catch (err) {
    console.error('❌ [Brevo API Exception]', (err as Error).message);
    return false;
  }
}

export async function sendOtpEmail(options: SendOTPOptions): Promise<boolean> {
  const { to, otp, name, purpose = 'verification' } = options;

  // Dynamically reload .env if process.env.BREVO_API_KEY is missing
  if (!process.env.BREVO_API_KEY) {
    try {
      const dotenv = await import('dotenv');
      const path = await import('path');
      const { fileURLToPath } = await import('url');
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });
    } catch (e) {}
  }

  const brevoApiKey = process.env.BREVO_API_KEY;

  // 1. If BREVO_API_KEY is defined in .env, attempt Brevo REST API
  if (brevoApiKey && brevoApiKey.trim() !== '') {
    console.log(`[Email Service] Sending ${purpose} email via Brevo REST API to: ${to}`);
    const success = await sendViaBrevoAPI(options, brevoApiKey.trim());
    if (success) return true;
    // Do not silently switch to Ethereal/JSON transport when Brevo is configured:
    // those transports do not deliver to the user's real inbox.
    console.error('[Email Service] Brevo rejected the message; no real inbox delivery was confirmed.');
    return false;
  }

  // 2. Fallback to Nodemailer / SMTP / Ethereal
  try {
    const mailTransporter = await getTransporter();
    const from = process.env.EMAIL_FROM || '"AquaNova Smart Aquaculture" <noreply@aquanova.io>';
    const content = getEmailContent(options);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #0284c7; margin: 0; font-size: 22px; font-weight: 700;">AquaNova Smart Aquaculture</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">${content.subtitle}</p>
        </div>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0f172a;">${content.title}</h3>
          <p style="color: #334155; font-size: 14px; margin: 0 0 12px 0;">${content.greeting}</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin: 0;">${content.lead}</p>
        </div>
        
        <div style="text-align: center; margin: 28px 0;">
          <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #0369a1; background-color: #f0f9ff; padding: 12px 32px; border-radius: 10px; border: 1px solid #bae6fd; display: inline-block;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #64748b; font-size: 13px; line-height: 1.6;">
          ${content.warning}
        </p>

        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          © 2026 AquaNova Smart Aquaculture Inc. All rights reserved.
        </p>
      </div>
    `;

    const info = await mailTransporter.sendMail({
      from,
      to,
      subject: content.subject,
      text: content.text,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log('\n==================================================');
    console.log(`📧 [EMAIL DELIVERED VIA SMTP/ETHEREAL] (${purpose})`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${content.subject}`);
    console.log(`OTP Code: >>>  ${otp}  <<<`);
    console.log(`Expiry: 10 minutes`);
    if (previewUrl) {
      console.log(`Ethereal Inbox Web Preview: ${previewUrl}`);
    }
    console.log('==================================================\n');

    return true;
  } catch (error) {
    console.error('❌ [Email Service Error] Failed to send email:', error);
    // Still output OTP to console so development and testing never gets locked out!
    console.log('\n==================================================');
    console.log(`🔑 [EMERGENCY FALLBACK OTP CODE FOR DEV TESTING] (${purpose})`);
    console.log(`To: ${to}`);
    console.log(`OTP Code: >>>  ${otp}  <<<`);
    console.log(`Expiry: 10 minutes`);
    console.log('==================================================\n');
    return false;
  }
}
