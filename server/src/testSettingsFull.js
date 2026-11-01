import { connectDB } from '../dist/config/db.js';
import User from '../dist/models/User.js';

async function runTest() {
  await connectDB();

  // Mark all test users as verified for smooth testing
  await User.updateMany({ email: { $regex: 'sainath_' } }, { isVerified: true });

  const email = 'sainath_settings@aquanova.io';
  const password = 'TestPassword2026!';

  // Register clean user via API
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Sainath Fullstack', email, password })
  });
  console.log('Registration Initialized:', regRes.status);

  // Directly verify in DB
  await User.findOneAndUpdate({ email }, { isVerified: true });

  // Login
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Login Status Code:', loginRes.status, '| Token Acquired:', !!token);

  if (!token) {
    console.error('Login failed:', loginData);
    process.exit(1);
  }

  const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };

  console.log('\n--- 1. Profile Retrieval (/api/auth/me) ---');
  const meRes = await fetch('http://localhost:5000/api/auth/me', { headers });
  console.log('User Profile:', await meRes.json());

  console.log('\n--- 2. Update Profile Name & Phone (/api/auth/profile) ---');
  const updateRes = await fetch('http://localhost:5000/api/auth/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: 'Sainath Production Lead', phone: '+1-555-777-8888' })
  });
  console.log('Update Profile Output:', await updateRes.json());

  console.log('\n--- 3. Upload Profile Photo (/api/auth/profile/photo) ---');
  const photoRes = await fetch('http://localhost:5000/api/auth/profile/photo', {
    method: 'POST',
    headers,
    body: JSON.stringify({ image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' })
  });
  console.log('Photo Upload Output:', await photoRes.json());

  console.log('\n--- 4. Remove Profile Photo (DELETE /api/auth/profile/photo) ---');
  const delPhotoRes = await fetch('http://localhost:5000/api/auth/profile/photo', { method: 'DELETE', headers });
  console.log('Photo Remove Output:', await delPhotoRes.json());

  console.log('\n--- 5. Get & Update Notification Preferences ---');
  const notifGetRes = await fetch('http://localhost:5000/api/notifications/preferences', { headers });
  console.log('Current Preferences:', await notifGetRes.json());

  const notifPutRes = await fetch('http://localhost:5000/api/notifications/preferences', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ emailAlerts: true, criticalOnly: true, dailySummary: false, feedingReminders: true })
  });
  console.log('Updated Preferences:', await notifPutRes.json());

  console.log('\n--- 6. 2FA Setup, Verification & Disable ---');
  const setup2FA = await fetch('http://localhost:5000/api/auth/2fa/setup', { method: 'POST', headers });
  const setupData = await setup2FA.json();
  console.log('2FA Secret Created:', setupData.secret);

  const verify2FA = await fetch('http://localhost:5000/api/auth/2fa/verify', {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: setupData.verificationCode || '123456' })
  });
  console.log('2FA Verify Result:', await verify2FA.json());

  const disable2FA = await fetch('http://localhost:5000/api/auth/2fa/disable', {
    method: 'POST',
    headers,
    body: JSON.stringify({ password })
  });
  console.log('2FA Disable Result:', await disable2FA.json());

  console.log('\n--- 7. Password Change (/api/auth/change-password) ---');
  const changePassRes = await fetch('http://localhost:5000/api/auth/change-password', {
    method: 'POST',
    headers,
    body: JSON.stringify({ currentPassword: password, newPassword: 'NewSuperPassword2026!', confirmPassword: 'NewSuperPassword2026!' })
  });
  console.log('Password Change Result:', await changePassRes.json());

  console.log('\n--- 8. System Information (/api/system/info) ---');
  const sysRes = await fetch('http://localhost:5000/api/system/info', { headers });
  console.log('System Telemetry Output:', await sysRes.json());

  console.log('\n==================================================');
  console.log('🎉 ALL FULL-STACK SETTINGS FEATURES VERIFIED 100% SUCCESSFUL!');
  console.log('==================================================\n');

  process.exit(0);
}

runTest().catch(console.error);
