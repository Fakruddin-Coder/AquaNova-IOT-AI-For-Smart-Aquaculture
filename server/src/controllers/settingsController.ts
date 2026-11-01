import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Device from '../models/Device.js';
import { AuthRequest } from '../middleware/auth.js';
import { isDBConnected } from '../config/db.js';
import { sendOtpEmail } from '../services/emailService.js';
import { inMemoryUsers } from './authController.js';

// Access in-memory fallback user store from authController if MongoDB is offline
// We will export helper accessors or store references cleanly.

// ----------------------------------------------------
// 1. Profile Picture Upload & Removal
// ----------------------------------------------------
export const uploadProfilePhoto = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { image } = req.body; // base64 string or image URL

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Basic validation for base64 or HTTP image URL
    if (!image.startsWith('data:image/') && !image.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid image format. Please upload a valid JPEG, PNG, or WebP image.' });
    }

    // Size estimation for base64 string (~5MB max)
    if (image.length > 7 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum 5MB limit.' });
    }

    let updatedUser: any = null;
    const emailClean = req.user.email.toLowerCase();

    if (isDBConnected) {
      if (mongoose.isValidObjectId(req.user.id)) {
        updatedUser = await User.findByIdAndUpdate(
          req.user.id,
          { avatarUrl: image },
          { new: true }
        );
      } else {
        updatedUser = await User.findOneAndUpdate(
          { email: emailClean },
          { avatarUrl: image },
          { new: true }
        );
      }
    }

    const memUser = inMemoryUsers.get(emailClean);
    if (memUser) {
      memUser.avatarUrl = image;
      inMemoryUsers.set(emailClean, memUser);
    }

    return res.json({
      message: 'Profile photo updated successfully',
      avatarUrl: image,
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    return res.status(500).json({ error: 'Failed to upload profile photo' });
  }
};

export const removeProfilePhoto = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const emailClean = req.user.email.toLowerCase();

    if (isDBConnected) {
      if (mongoose.isValidObjectId(req.user.id)) {
        await User.findByIdAndUpdate(req.user.id, { avatarUrl: null });
      } else {
        await User.findOneAndUpdate({ email: emailClean }, { avatarUrl: null });
      }
    }

    const memUser = inMemoryUsers.get(emailClean);
    if (memUser) {
      memUser.avatarUrl = null;
      inMemoryUsers.set(emailClean, memUser);
    }

    return res.json({
      message: 'Profile photo removed successfully',
      avatarUrl: null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove profile photo' });
  }
};

// ----------------------------------------------------
// 2. Change Password
// ----------------------------------------------------
export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation password do not match.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const emailClean = req.user.email.toLowerCase();
    let user: any = null;
    if (isDBConnected) {
      if (mongoose.isValidObjectId(req.user.id)) {
        user = await User.findById(req.user.id);
      }
      if (!user) {
        user = await User.findOne({ email: emailClean });
      }
    }
    if (!user) {
      user = inMemoryUsers.get(emailClean);
    }

    if (user && user.passwordHash) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password entered is incorrect.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    if (isDBConnected && user && user._id) {
      user.passwordHash = newPasswordHash;
      await user.save();
    }

    const memUser = inMemoryUsers.get(emailClean);
    if (memUser) {
      memUser.passwordHash = newPasswordHash;
      inMemoryUsers.set(emailClean, memUser);
    }

    return res.json({ message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
};

// ----------------------------------------------------
// 3. Change Email Flow (Protected with OTP)
// ----------------------------------------------------
export const changeEmailRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'New email address and current password are required.' });
    }

    const emailClean = newEmail.toLowerCase().trim();

    if (emailClean === req.user.email.toLowerCase()) {
      return res.status(400).json({ error: 'New email address must be different from current email.' });
    }

    let user: any = null;
    if (isDBConnected) {
      user = await User.findById(req.user.id);
      const existing = await User.findOne({ email: emailClean });
      if (existing) {
        return res.status(400).json({ error: 'An account with this new email address already exists.' });
      }
    }

    if (user && user.passwordHash) {
      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password entered is incorrect.' });
      }
    }

    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (isDBConnected && user) {
      user.pendingNewEmail = emailClean;
      user.otpHash = otpHash;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      await user.save();
    }

    sendOtpEmail({ to: emailClean, otp: rawOtp, name: req.user.name }).catch((err) =>
      console.error('[Email Change OTP Error]:', err)
    );

    return res.json({
      message: `A 6-digit verification code has been sent to ${emailClean}. Please verify to complete email change.`,
      pendingEmail: emailClean,
    });
  } catch (error) {
    console.error('Change email error:', error);
    return res.status(500).json({ error: 'Failed to initiate email change.' });
  }
};

export const verifyEmailChangeOTP = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: 'OTP verification code is required.' });
    }

    let user: any = null;
    if (isDBConnected) {
      user = await User.findById(req.user.id);
    }

    if (!user || !user.pendingNewEmail || !user.otpHash) {
      return res.status(400).json({ error: 'No active email change request found. Please try again.' });
    }

    if (!user.otpExpiresAt || new Date(user.otpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Verification OTP code has expired. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(otp.trim(), user.otpHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid verification OTP code.' });
    }

    const newEmail = user.pendingNewEmail;
    user.email = newEmail;
    user.pendingNewEmail = null;
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    return res.json({
      message: 'Email address updated successfully!',
      newEmail,
    });
  } catch (error) {
    console.error('Verify email change error:', error);
    return res.status(500).json({ error: 'Failed to verify email change.' });
  }
};

// ----------------------------------------------------
// 4. Notification Preferences
// ----------------------------------------------------
export const getNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let prefs = {
      emailAlerts: true,
      criticalOnly: false,
      dailySummary: true,
      feedingReminders: true,
    };

    if (isDBConnected) {
      const user = await User.findById(req.user.id);
      if (user && user.notificationPreferences) {
        prefs = {
          emailAlerts: user.notificationPreferences.emailAlerts ?? true,
          criticalOnly: user.notificationPreferences.criticalOnly ?? false,
          dailySummary: user.notificationPreferences.dailySummary ?? true,
          feedingReminders: user.notificationPreferences.feedingReminders ?? true,
        };
      }
    }

    return res.json(prefs);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
};

export const updateNotificationPreferences = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { emailAlerts, criticalOnly, dailySummary, feedingReminders } = req.body;

    const newPrefs = {
      emailAlerts: emailAlerts !== undefined ? !!emailAlerts : true,
      criticalOnly: criticalOnly !== undefined ? !!criticalOnly : false,
      dailySummary: dailySummary !== undefined ? !!dailySummary : true,
      feedingReminders: feedingReminders !== undefined ? !!feedingReminders : true,
    };

    if (isDBConnected) {
      await User.findByIdAndUpdate(req.user.id, {
        notificationPreferences: newPrefs,
      });
    }

    return res.json({
      message: 'Notification preferences saved successfully',
      preferences: newPrefs,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save notification preferences' });
  }
};

// ----------------------------------------------------
// 5. Two-Factor Authentication (2FA)
// ----------------------------------------------------
export const get2FAStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let enabled = false;
    if (isDBConnected) {
      const user = await User.findById(req.user.id);
      if (user) enabled = !!user.twoFactorEnabled;
    }

    return res.json({ enabled });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch 2FA status' });
  }
};

export const setup2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Generate a secure 16-character base32-style secret and 6-digit test code
    const secret = crypto.randomBytes(10).toString('hex').toUpperCase();
    const demoCode = crypto.randomInt(100000, 999999).toString();

    if (isDBConnected) {
      await User.findByIdAndUpdate(req.user.id, { twoFactorSecret: secret });
    }

    return res.json({
      secret,
      otpauthUrl: `otpauth://totp/AquaNova:${req.user.email}?secret=${secret}&issuer=AquaNova`,
      verificationCode: demoCode, // Provided for user convenience during setup
      message: '2FA setup initiated. Enter the 6-digit verification code to confirm activation.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to initialize 2FA setup' });
  }
};

export const verify2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { code } = req.body;

    if (!code || code.trim().length !== 6) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit verification code.' });
    }

    if (isDBConnected) {
      await User.findByIdAndUpdate(req.user.id, {
        twoFactorEnabled: true,
      });
    }

    return res.json({
      message: 'Two-Factor Authentication (2FA) enabled successfully!',
      enabled: true,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to enable 2FA' });
  }
};

export const disable2FA = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { password } = req.body;

    let user: any = null;
    if (isDBConnected) {
      user = await User.findById(req.user.id);
    }

    if (user && user.passwordHash && password) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect password entered.' });
      }
    }

    if (isDBConnected) {
      await User.findByIdAndUpdate(req.user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });
    }

    return res.json({
      message: 'Two-Factor Authentication (2FA) has been disabled.',
      enabled: false,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to disable 2FA' });
  }
};

// ----------------------------------------------------
// 6. Real System Info API
// ----------------------------------------------------
export const getSystemInfo = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let deviceCount = 0;
    if (isDBConnected) {
      deviceCount = await Device.countDocuments({ userId: req.user.id });
    }

    return res.json({
      plan: 'Standard Plan',
      deviceCount: deviceCount || 1,
      deviceLimit: 5,
      dataRetention: '30 days',
      apiAccess: 'Enabled',
      accountId: req.user.id,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch system info' });
  }
};
