import { Router } from 'express';
import {
  register,
  verifyOTP,
  resendOTP,
  login,
  getMe,
  updateProfile,
  forgotPassword,
  resetPasswordWithOtp,
} from '../controllers/authController.js';
import {
  uploadProfilePhoto,
  removeProfilePhoto,
  changePassword,
  changeEmailRequest,
  verifyEmailChangeOTP,
  get2FAStatus,
  setup2FA,
  verify2FA,
  disable2FA,
} from '../controllers/settingsController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// Auth & OTP
router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPasswordWithOtp);
router.get('/me', authenticateJWT, getMe);

// Profile
router.put('/profile', authenticateJWT, updateProfile);
router.post('/profile/photo', authenticateJWT, uploadProfilePhoto);
router.delete('/profile/photo', authenticateJWT, removeProfilePhoto);

// Security & Password / Email / 2FA
router.post('/change-password', authenticateJWT, changePassword);
router.post('/change-email', authenticateJWT, changeEmailRequest);
router.post('/verify-email-otp', authenticateJWT, verifyEmailChangeOTP);

router.get('/2fa/status', authenticateJWT, get2FAStatus);
router.post('/2fa/setup', authenticateJWT, setup2FA);
router.post('/2fa/verify', authenticateJWT, verify2FA);
router.post('/2fa/disable', authenticateJWT, disable2FA);

export default router;
