import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { seedDemoDataForDevice } from '../services/seedService.js';
import { sendOtpEmail } from '../services/emailService.js';
import { AuthRequest } from '../middleware/auth.js';
import { isDBConnected } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aquanova_jwt_secret_key_2026';

// In-memory fallback user store when MongoDB is offline
export const inMemoryUsers = new Map<string, any>();

// Helper to generate secure 6-digit OTP
function generate6DigitOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, address, tankDetails } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailClean = email.toLowerCase().trim();

    // Check if user already exists
    if (isDBConnected) {
      const existingUser = await User.findOne({ email: emailClean });
      if (existingUser) {
        if (existingUser.isVerified) {
          return res.status(400).json({ error: 'User with this email already exists' });
        }
        // If exists but not verified, we allow re-sending OTP / resetting registration
      }
    } else {
      const existing = inMemoryUsers.get(emailClean);
      if (existing && existing.isVerified) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userName = name || emailClean.split('@')[0];

    // Generate 6-digit OTP
    const rawOtp = generate6DigitOTP();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    const otpLastSentAt = new Date();

    let userId: string;

    if (isDBConnected) {
      const existingUser = await User.findOne({ email: emailClean });
      if (existingUser && !existingUser.isVerified) {
        existingUser.name = userName;
        existingUser.passwordHash = passwordHash;
        existingUser.phone = phone || '';
        existingUser.address = address || '';
        existingUser.tankDetails = tankDetails || {};
        existingUser.otpHash = otpHash;
        existingUser.otpExpiresAt = otpExpiresAt;
        existingUser.otpAttempts = 0;
        existingUser.otpLastSentAt = otpLastSentAt;
        await existingUser.save();
        userId = existingUser._id.toString();
      } else {
        const user = await User.create({
          name: userName,
          email: emailClean,
          passwordHash,
          phone: phone || '',
          address: address || '',
          tankDetails: tankDetails || {},
          isVerified: false,
          kitPurchased: false,
          otpHash,
          otpExpiresAt,
          otpAttempts: 0,
          otpLastSentAt,
        });
        userId = user._id.toString();
      }
    } else {
      userId = 'usr_' + Date.now();
      inMemoryUsers.set(emailClean, {
        id: userId,
        name: userName,
        email: emailClean,
        passwordHash,
        phone: phone || '',
        address: address || '',
        tankDetails: tankDetails || {},
        isVerified: false,
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        otpLastSentAt,
        createdAt: new Date().toISOString(),
        kitPurchased: false,
      });
    }

    const defaultDeviceId = 'AN-001';
    await seedDemoDataForDevice(defaultDeviceId);

    // Do not report signup success until the configured mail provider accepts the OTP.
    const emailSent = await sendOtpEmail({
      to: emailClean,
      otp: rawOtp,
      name: userName,
    });
    if (!emailSent) {
      return res.status(502).json({ error: 'We could not send the verification email. Check the Brevo sender/API configuration and try again.' });
    }

    return res.status(201).json({
      message: 'Registration initialized. Please verify the 6-digit OTP sent to your email.',
      requiresVerification: true,
      email: emailClean,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Failed to register user' });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const emailClean = email.toLowerCase().trim();
    let user: any = null;

    if (isDBConnected) {
      user = await User.findOne({ email: emailClean });
    } else {
      user = inMemoryUsers.get(emailClean);
    }

    if (!user) {
      return res.status(404).json({ error: 'User record not found. Please register first.' });
    }

    if (user.isVerified) {
      // Already verified
      const userId = user._id ? user._id.toString() : user.id;
      const token = jwt.sign(
        { id: userId, email: user.email, name: user.name, role: user.role || 'customer' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Account is already verified.',
        token,
        user: {
          id: userId,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          address: user.address || '',
          tankDetails: user.tankDetails || {},
          isVerified: true,
          role: user.role || 'customer',
          kitPurchased: user.kitPurchased !== false,
        },
      });
    }

    // Check attempts limit (max 5)
    if ((user.otpAttempts || 0) >= 5) {
      return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please request a new OTP.' });
    }

    // Check expiration
    if (!user.otpExpiresAt || new Date(user.otpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'OTP has expired. Please click Resend OTP to receive a new code.' });
    }

    // Check OTP hash
    if (!user.otpHash) {
      return res.status(400).json({ error: 'Invalid verification session. Please request a new OTP.' });
    }

    const isMatch = await bcrypt.compare(otp.trim(), user.otpHash);
    if (!isMatch) {
      // Increment attempt counter
      if (isDBConnected) {
        await User.updateOne({ email: emailClean }, { $inc: { otpAttempts: 1 } });
      } else {
        user.otpAttempts = (user.otpAttempts || 0) + 1;
        inMemoryUsers.set(emailClean, user);
      }
      return res.status(400).json({ error: 'Invalid OTP code. Please check your email and try again.' });
    }

    // OTP Verified successfully!
    const userId = user._id ? user._id.toString() : user.id;

    if (isDBConnected) {
      await User.updateOne(
        { email: emailClean },
        {
          $set: {
            isVerified: true,
            otpHash: null,
            otpExpiresAt: null,
            otpAttempts: 0,
          },
        }
      );
    } else {
      user.isVerified = true;
      user.otpHash = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      inMemoryUsers.set(emailClean, user);
    }

    const token = jwt.sign(
      { id: userId, email: user.email, name: user.name, role: user.role || 'customer' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Email verified successfully!',
      token,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        address: user.address || '',
        tankDetails: user.tankDetails || {},
        isVerified: true,
        role: user.role || 'customer',
        kitPurchased: user.kitPurchased !== false,
        createdAt: user.createdAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
};

export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailClean = email.toLowerCase().trim();
    let user: any = null;

    if (isDBConnected) {
      user = await User.findOne({ email: emailClean });
    } else {
      user = inMemoryUsers.get(emailClean);
    }

    if (!user) {
      return res.status(404).json({ error: 'No user account found with this email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Account is already verified. You can log in directly.' });
    }

    // Rate limiting: 60 seconds cooldown between resend requests
    if (user.otpLastSentAt) {
      const secondsSinceLastSent = (Date.now() - new Date(user.otpLastSentAt).getTime()) / 1000;
      if (secondsSinceLastSent < 60) {
        const remaining = Math.ceil(60 - secondsSinceLastSent);
        return res.status(429).json({
          error: `Please wait ${remaining} seconds before requesting a new OTP.`,
          cooldownRemaining: remaining,
        });
      }
    }

    // Generate fresh OTP
    const rawOtp = generate6DigitOTP();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const otpLastSentAt = new Date();

    if (isDBConnected) {
      await User.updateOne(
        { email: emailClean },
        {
          $set: {
            otpHash,
            otpExpiresAt,
            otpAttempts: 0,
            otpLastSentAt,
          },
        }
      );
    } else {
      user.otpHash = otpHash;
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      user.otpLastSentAt = otpLastSentAt;
      inMemoryUsers.set(emailClean, user);
    }

    // Send email
    await sendOtpEmail({
      to: emailClean,
      otp: rawOtp,
      name: user.name,
    });

    return res.json({
      message: 'A new 6-digit OTP has been sent to your email.',
      email: emailClean,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ error: 'Failed to resend OTP' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailClean = email.toLowerCase().trim();
    let foundUser: any = null;

    if (isDBConnected) {
      try {
        foundUser = await User.findOne({ email: emailClean });
      } catch (e) {}
    }

    if (!foundUser && !isDBConnected) {
      foundUser = inMemoryUsers.get(emailClean);
    }

    if (!foundUser) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (foundUser.passwordHash) {
      const isMatch = await bcrypt.compare(password, foundUser.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    }

    // Determine the user's role. Admin accounts (configured via env or
    // hard-coded fallback) are always treated as verified to avoid
    // IP-change / network-switch friction.
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').toLowerCase().trim();
    const isAdminAccount =
      foundUser.role === 'admin' ||
      emailClean === adminEmail ||
      emailClean === 'fakhruddinkhan7253@gmail.com';

    // If the account is already verified in the DB, skip OTP entirely.
    // Admin accounts bypass this check unconditionally.
    const accountVerified = !!foundUser.isVerified || isAdminAccount;

    if (!accountVerified) {
      // Auto-send fresh OTP for unverified non-admin accounts
      const rawOtp = generate6DigitOTP();
      const otpHash = await bcrypt.hash(rawOtp, 10);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const otpLastSentAt = new Date();

      if (isDBConnected) {
        await User.updateOne({ email: emailClean }, { $set: { otpHash, otpExpiresAt, otpAttempts: 0, otpLastSentAt } });
      } else {
        foundUser.otpHash = otpHash;
        foundUser.otpExpiresAt = otpExpiresAt;
        foundUser.otpAttempts = 0;
        foundUser.otpLastSentAt = otpLastSentAt;
        inMemoryUsers.set(emailClean, foundUser);
      }

      await sendOtpEmail({ to: emailClean, otp: rawOtp, name: foundUser.name });

      return res.status(403).json({
        error: 'Email verification required. A new OTP has been sent to your email.',
        requiresVerification: true,
        email: emailClean,
      });
    }

    // If the account was admin but isVerified was somehow false in the DB,
    // auto-correct it now to prevent future friction.
    if (isAdminAccount && !foundUser.isVerified && isDBConnected) {
      await User.updateOne({ email: emailClean }, { $set: { isVerified: true, role: 'admin' } });
    }

    const userId = foundUser._id ? foundUser._id.toString() : foundUser.id || 'usr_' + Date.now();
    const userName = foundUser.name || emailClean.split('@')[0];
    const userRole = foundUser.role || (isAdminAccount ? 'admin' : 'customer');

    const token = jwt.sign(
      { id: userId, email: emailClean, name: userName, role: userRole },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: {
        id: userId,
        name: userName,
        email: emailClean,
        role: userRole,
        phone: foundUser.phone || '',
        address: foundUser.address || '',
        tankDetails: foundUser.tankDetails || {},
        isVerified: true,
        createdAt: foundUser.createdAt || new Date().toISOString(),
        kitPurchased: foundUser.kitPurchased !== false,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Failed to log in' });
  }
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let foundUser: any = null;
    const emailClean = req.user.email.toLowerCase();

    if (isDBConnected) {
      if (mongoose.isValidObjectId(req.user.id)) {
        foundUser = await User.findById(req.user.id);
      }
      if (!foundUser) {
        foundUser = await User.findOne({ email: emailClean });
      }
    }
    if (!foundUser && !isDBConnected) {
      foundUser = inMemoryUsers.get(emailClean);
    }

    const role = foundUser?.role || (emailClean === 'fakhruddinkhan7253@gmail.com' ? 'admin' : 'customer');

    return res.json({
      id: req.user.id,
      name: foundUser?.name || req.user.name || 'AquaNova User',
      email: req.user.email,
      role,
      phone: foundUser?.phone || '',
      address: foundUser?.address || '',
      avatarUrl: foundUser?.avatarUrl || null,
      tankDetails: foundUser?.tankDetails || {},
      isVerified: foundUser ? !!foundUser.isVerified : true,
      createdAt: foundUser?.createdAt || new Date().toISOString(),
      kitPurchased: foundUser?.kitPurchased !== false,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, phone, address, tankDetails } = req.body;
    const emailClean = req.user.email.toLowerCase();

    const updateData = {
      ...(name && { name }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(tankDetails && { tankDetails }),
    };

    if (isDBConnected) {
      if (mongoose.isValidObjectId(req.user.id)) {
        await User.findByIdAndUpdate(req.user.id, updateData);
      } else {
        await User.findOneAndUpdate({ email: emailClean }, updateData);
      }
    }

    const existing = inMemoryUsers.get(emailClean) || {};
    inMemoryUsers.set(emailClean, {
      ...existing,
      name: name || existing.name || req.user.name,
      phone: phone !== undefined ? phone : existing.phone,
      address: address !== undefined ? address : existing.address,
      tankDetails: tankDetails || existing.tankDetails,
    });

    return res.json({
      id: req.user.id,
      name: name || req.user.name,
      email: req.user.email,
      phone: phone || '',
      address: address || '',
      tankDetails: tankDetails || {},
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailClean = email.toLowerCase().trim();
    let user: any = null;

    if (isDBConnected) {
      user = await User.findOne({ email: emailClean });
    }
    if (!user && !isDBConnected) {
      user = inMemoryUsers.get(emailClean);
    }

    if (!user) {
      // Security standard: don't reveal if account exists
      return res.json({ message: 'If an account exists with this email, a password reset code has been sent.' });
    }

    const rawOtp = generate6DigitOTP();
    const otpHash = await bcrypt.hash(rawOtp, 10);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (isDBConnected && user._id) {
      await User.updateOne({ email: emailClean }, { $set: { otpHash, otpExpiresAt, otpAttempts: 0 } });
    }
    
    // Also store in memory to ensure immediate retrieval
    if (inMemoryUsers.has(emailClean) || !isDBConnected) {
      const memUser = inMemoryUsers.get(emailClean) || user;
      memUser.otpHash = otpHash;
      memUser.otpExpiresAt = otpExpiresAt;
      memUser.otpAttempts = 0;
      inMemoryUsers.set(emailClean, memUser);
    }

    const emailSent = await sendOtpEmail({
      to: emailClean,
      otp: rawOtp,
      name: user.name,
      purpose: 'password-reset',
    });

    if (!emailSent) {
      return res.status(502).json({ error: 'We could not send the reset email. Check the Brevo sender/API configuration and try again.' });
    }

    return res.json({
      message: 'If an account exists with this email, a password reset code has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
};

export const resetPasswordWithOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailClean = email.toLowerCase().trim();
    let user: any = isDBConnected ? await User.findOne({ email: emailClean }) : null;
    if (!user && !isDBConnected) {
      user = inMemoryUsers.get(emailClean);
    }

    if (!user || !user.otpHash || !user.otpExpiresAt || new Date(user.otpExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'This reset code is invalid or has expired. Please request a new code.' });
    }

    const isMatch = await bcrypt.compare(String(otp).trim(), user.otpHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'The 6-digit reset code is incorrect. Please check your email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    if (isDBConnected && user._id) {
      const updateResult = await User.updateOne(
        { email: emailClean },
        { $set: { passwordHash, otpHash: null, otpExpiresAt: null, otpAttempts: 0 } }
      );
      if (!updateResult.matchedCount) {
        return res.status(404).json({ error: 'Account was not found while saving the new password.' });
      }
      const savedUser = await User.findOne({ email: emailClean }).select('passwordHash');
      if (!savedUser || !(await bcrypt.compare(newPassword, savedUser.passwordHash))) {
        return res.status(500).json({ error: 'The new password could not be saved. Please request a new reset code.' });
      }
    }

    if (inMemoryUsers.has(emailClean) || !isDBConnected) {
      const memUser = inMemoryUsers.get(emailClean) || user;
      memUser.passwordHash = passwordHash;
      memUser.otpHash = null;
      memUser.otpExpiresAt = null;
      memUser.otpAttempts = 0;
      inMemoryUsers.set(emailClean, memUser);
    }

    console.log(`[Password Reset] Password reset successfully for: ${emailClean}`);

    return res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
};
