import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sendOtpEmail } from './services/emailService.js';

async function test() {
  const recipient = process.env.EMAIL_FROM || 'fakhruddinkhan7253@gmail.com';
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  console.log('--- Testing Brevo Real-Time Inbox Email Delivery ---');
  console.log('Brevo API Key Present:', !!process.env.BREVO_API_KEY);
  console.log('Sending OTP:', otp, 'to recipient:', recipient);

  const success = await sendOtpEmail({
    to: recipient,
    otp,
    name: 'AquaNova User',
  });

  if (success) {
    console.log(`\n✅ REAL-TIME EMAIL DELIVERED TO ${recipient}! Check your inbox now!`);
  } else {
    console.log(`\n❌ Failed to deliver email.`);
  }
}

test();
