import { useState, useEffect, useRef } from 'react';
import {
  Settings,
  User as UserIcon,
  Bell,
  Shield,
  Save,
  Check,
  Camera,
  Trash2,
  Lock,
  Mail,
  Smartphone,
  AlertTriangle,
  QrCode,
  X,
  Key,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardBody, Button, Spinner } from '@/components/ui';
import { PageHeader } from '@/pages/AppLayout';
import { api } from '@/services/api';

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();

  // Profile Form State
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification Preferences State
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    criticalOnly: false,
    dailySummary: true,
    feedingReminders: true,
  });
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Security / 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading2FA, setLoading2FA] = useState(true);

  // System Info State
  const [systemInfo, setSystemInfo] = useState<{
    plan: string;
    deviceCount: number;
    deviceLimit: number;
    dataRetention: string;
    apiAccess: string;
    accountId: string;
  } | null>(null);

  // Modals State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [show2FADisableModal, setShow2FADisableModal] = useState(false);

  // Password Modal Form
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Email Change Modal Form
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '', otp: '' });
  const [emailStep, setEmailStep] = useState<'request' | 'verify'>('request');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // 2FA Setup Form
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{ secret: string; otpauthUrl: string; verificationCode: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);

  // Disable 2FA Form
  const [disablePassword, setDisablePassword] = useState('');

  // ----------------------------------------------------
  // Load initial backend data
  // ----------------------------------------------------
  useEffect(() => {
    if (user) {
      setFullName(user.name ?? '');
      setPhone(user.phone ?? '');
      setAvatarUrl(user.avatar_url ?? null);
    }
  }, [user]);

  useEffect(() => {
    async function loadData() {
      try {
        // Load notification preferences
        const prefs = await api.getNotificationPreferences();
        if (prefs && !('error' in prefs)) {
          setNotifications(prefs);
        }
      } catch (err) {
        console.warn('Could not load notification preferences:', err);
      } finally {
        setLoadingNotifications(false);
      }

      try {
        // Load 2FA status
        const status = await api.get2FAStatus();
        if (status && typeof status.enabled === 'boolean') {
          setTwoFactorEnabled(status.enabled);
        }
      } catch (err) {
        console.warn('Could not load 2FA status:', err);
      } finally {
        setLoading2FA(false);
      }

      try {
        // Load System Info
        const info = await api.getSystemInfo();
        if (info && !('error' in info)) {
          setSystemInfo(info);
        }
      } catch (err) {
        console.warn('Could not load system info:', err);
      }
    }

    loadData();
  }, []);

  // ----------------------------------------------------
  // 1. Profile Handlers
  // ----------------------------------------------------
  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileSuccess(null);

    // Validate Phone Number
    if (phone && !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(phone.trim())) {
      setProfileError('Please enter a valid phone number format.');
      return;
    }

    setSavingProfile(true);

    try {
      const res: any = await api.updateProfile({
        name: fullName.trim(),
        phone: phone.trim(),
      });

      if (res?.error) {
        setProfileError(res.error);
      } else {
        setProfileSuccess('Profile updated successfully!');
        await refreshProfile();
        setTimeout(() => setProfileSuccess(null), 3000);
      }
    } catch (err) {
      setProfileError('Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProfileError(null);

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileError('Please select a valid JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image size must be less than 5MB.');
      return;
    }

    setUploadingPhoto(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result as string;
      try {
        const res: any = await api.uploadProfilePhoto(base64Image);
        if (res?.error) {
          setProfileError(res.error);
        } else {
          setAvatarUrl(res.avatarUrl || base64Image);
          await refreshProfile();
          setProfileSuccess('Profile photo uploaded successfully!');
          setTimeout(() => setProfileSuccess(null), 3000);
        }
      } catch (err) {
        setProfileError('Failed to upload profile photo.');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    setProfileError(null);
    setUploadingPhoto(true);

    try {
      const res: any = await api.removeProfilePhoto();
      if (res?.error) {
        setProfileError(res.error);
      } else {
        setAvatarUrl(null);
        await refreshProfile();
        setProfileSuccess('Profile photo removed.');
        setTimeout(() => setProfileSuccess(null), 3000);
      }
    } catch (err) {
      setProfileError('Failed to remove profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ----------------------------------------------------
  // 2. Notification Toggle Handler with Auto-Revert
  // ----------------------------------------------------
  const handleToggleNotification = async (key: keyof typeof notifications) => {
    const previousState = { ...notifications };
    const newValue = !notifications[key];

    // Optimistic UI update
    setNotifications((prev) => ({ ...prev, [key]: newValue }));
    setTogglingKey(key);

    try {
      const updatedPrefs = { ...notifications, [key]: newValue };
      const res: any = await api.updateNotificationPreferences(updatedPrefs);

      if (res?.error) {
        // Revert on failure
        setNotifications(previousState);
        alert(`Failed to update notification setting: ${res.error}`);
      }
    } catch (err) {
      // Revert on network exception
      setNotifications(previousState);
      alert('Network error updating notification preference.');
    } finally {
      setTogglingKey(null);
    }
  };

  // ----------------------------------------------------
  // 3. Password Change Handler
  // ----------------------------------------------------
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res: any = await api.changePassword(passwordForm);
      if (res?.error) {
        setPasswordError(res.error);
      } else {
        setPasswordSuccess(res?.message || 'Password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess(null);
        }, 2000);
      }
    } catch (err) {
      setPasswordError('Failed to change password. Please check your credentials.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // ----------------------------------------------------
  // 4. Change Email Handler
  // ----------------------------------------------------
  const handleEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!emailForm.newEmail || !emailForm.currentPassword) {
      setEmailError('Please enter both your new email and current password.');
      return;
    }

    setEmailSaving(true);
    try {
      const res: any = await api.changeEmailRequest({
        newEmail: emailForm.newEmail,
        currentPassword: emailForm.currentPassword,
      });

      if (res?.error) {
        setEmailError(res.error);
      } else {
        setEmailSuccess(res?.message || 'Verification OTP sent to new email.');
        setEmailStep('verify');
      }
    } catch (err) {
      setEmailError('Failed to send verification email.');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    if (!emailForm.otp || emailForm.otp.trim().length !== 6) {
      setEmailError('Please enter the 6-digit verification code.');
      return;
    }

    setEmailSaving(true);
    try {
      const res: any = await api.verifyEmailChangeOTP({ otp: emailForm.otp });
      if (res?.error) {
        setEmailError(res.error);
      } else {
        setEmailSuccess('Email address updated successfully!');
        await refreshProfile();
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStep('request');
          setEmailForm({ newEmail: '', currentPassword: '', otp: '' });
          setEmailSuccess(null);
        }, 2000);
      }
    } catch (err) {
      setEmailError('Failed to verify OTP code.');
    } finally {
      setEmailSaving(false);
    }
  };

  // ----------------------------------------------------
  // 5. Two-Factor Authentication (2FA) Handlers
  // ----------------------------------------------------
  const handleOpen2FASetup = async () => {
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    setTwoFactorCode('');
    setShow2FASetupModal(true);

    try {
      const data: any = await api.setup2FA();
      if (data && !data.error) {
        setTwoFactorSetupData(data);
      } else {
        setTwoFactorError(data?.error || 'Failed to initialize 2FA setup.');
      }
    } catch (err) {
      setTwoFactorError('Error initializing 2FA.');
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorSuccess(null);

    if (!twoFactorCode || twoFactorCode.trim().length !== 6) {
      setTwoFactorError('Please enter a valid 6-digit verification code.');
      return;
    }

    setTwoFactorSaving(true);
    try {
      const res: any = await api.verify2FA(twoFactorCode.trim());
      if (res?.error) {
        setTwoFactorError(res.error);
      } else {
        setTwoFactorSuccess('Two-Factor Authentication Enabled Successfully!');
        setTwoFactorEnabled(true);
        setTimeout(() => {
          setShow2FASetupModal(false);
          setTwoFactorSuccess(null);
        }, 2000);
      }
    } catch (err) {
      setTwoFactorError('Failed to verify 2FA code.');
    } finally {
      setTwoFactorSaving(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorSaving(true);

    try {
      const res: any = await api.disable2FA(disablePassword);
      if (res?.error) {
        setTwoFactorError(res.error);
      } else {
        setTwoFactorEnabled(false);
        setShow2FADisableModal(false);
        setDisablePassword('');
      }
    } catch (err) {
      setTwoFactorError('Failed to disable 2FA.');
    } finally {
      setTwoFactorSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const userInitials = (fullName || user.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      <PageHeader title="Account Settings" subtitle="Manage your profile, security, and notifications" />

      {/* Hidden File Input for Avatar */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoSelect}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ==================================================== */}
        {/* 1. PROFILE CARD */}
        {/* ==================================================== */}
        <Card className="shadow-sm">
          <CardHeader title="Profile Settings" subtitle="Update your photo, name, and phone" icon={<UserIcon className="h-5 w-5 text-blue-600" />} />
          <CardBody className="space-y-5">
            {/* Feedback Banners */}
            {profileError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}
            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
                <Check className="h-4 w-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {/* Profile Avatar UI */}
            <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div className="relative group shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile Avatar"
                    className="h-20 w-20 rounded-full object-cover border-2 border-white shadow-md"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-bold text-white shadow-md">
                    {userInitials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-transform active:scale-95"
                  title="Upload Photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <p className="text-base font-semibold text-slate-900">{fullName || 'AquaNova User'}</p>
                <p className="text-xs text-slate-500 mb-3">{user.email}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="text-xs"
                  >
                    {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      disabled={uploadingPhoto}
                      className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Phone Number</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <Smartphone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email Address (Protected)</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 pl-10 text-sm font-medium text-slate-600 cursor-not-allowed"
                  />
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEmailError(null);
                    setEmailSuccess(null);
                    setEmailStep('request');
                    setShowEmailModal(true);
                  }}
                  className="shrink-0 text-xs"
                >
                  Change Email
                </Button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Account created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1.5" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* ==================================================== */}
        {/* 2. NOTIFICATIONS CARD (Database-Backed) */}
        {/* ==================================================== */}
        <Card className="shadow-sm">
          <CardHeader title="Notifications" subtitle="Database-synced alert preferences" icon={<Bell className="h-5 w-5 text-blue-600" />} />
          <CardBody className="space-y-4">
            {loadingNotifications ? (
              <div className="flex py-10 justify-center">
                <Spinner className="h-6 w-6 text-blue-600" />
              </div>
            ) : (
              [
                { key: 'emailAlerts', label: 'Email Alerts', desc: 'Receive real-time OTP and anomaly alerts via email.' },
                { key: 'criticalOnly', label: 'Critical Only', desc: 'Only alert when water parameters breach critical safety limits.' },
                { key: 'dailySummary', label: 'Daily Digest', desc: 'Receive a daily 24-hour summary of water metrics and feedings.' },
                { key: 'feedingReminders', label: 'Feeding Reminders', desc: 'Automated reminders 15 minutes before scheduled feedings.' },
              ].map((item) => {
                const isEnabled = notifications[item.key as keyof typeof notifications];
                const isToggling = togglingKey === item.key;

                return (
                  <div key={item.key} className="flex items-start justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex-1 pr-4">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleNotification(item.key as keyof typeof notifications)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isEnabled ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      {isToggling ? (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Spinner className="h-3 w-3 text-white" />
                        </span>
                      ) : (
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        {/* ==================================================== */}
        {/* 3. SECURITY CARD (Password & 2FA) */}
        {/* ==================================================== */}
        <Card className="shadow-sm">
          <CardHeader title="Security & Authentication" subtitle="Password management and 2-Factor protection" icon={<Shield className="h-5 w-5 text-blue-600" />} />
          <CardBody className="space-y-4">
            {/* Password Section */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div>
                <p className="text-sm font-semibold text-slate-900">Account Password</p>
                <p className="text-xs text-slate-500 mt-0.5">Secure your account with a strong password</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPasswordError(null);
                  setPasswordSuccess(null);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setShowPasswordModal(true);
                }}
              >
                <Lock className="h-3.5 w-3.5 mr-1" /> Change Password
              </Button>
            </div>

            {/* 2FA is intentionally disabled for this product flow. */}
            {false && <>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="pr-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">Two-Factor Authentication (2FA)</p>
                  {loading2FA ? (
                    <Spinner className="h-3.5 w-3.5 text-blue-600" />
                  ) : twoFactorEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      <ShieldCheck className="h-3 w-3" /> ENABLED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      <ShieldAlert className="h-3 w-3" /> DISABLED
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Adds an extra verification step during account sign-in.
                </p>
              </div>

              {twoFactorEnabled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShow2FADisableModal(true)}
                  className="text-xs text-red-600 hover:bg-red-50 shrink-0"
                >
                  Disable 2FA
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpen2FASetup}
                  className="text-xs shrink-0"
                >
                  <QrCode className="h-3.5 w-3.5 mr-1" /> Enable 2FA
                </Button>
              )}
            </div>
            </>}
          </CardBody>
        </Card>

        {/* ==================================================== */}
        {/* 4. SYSTEM CARD (Real Backend Values) */}
        {/* ==================================================== */}
        <Card className="shadow-sm">
          <CardHeader title="System Information" subtitle="Live account & infrastructure telemetry" icon={<Settings className="h-5 w-5 text-blue-600" />} />
          <CardBody className="space-y-3">
            <div className="flex justify-between items-center text-sm py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Subscription Plan</span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {systemInfo?.plan || 'Standard Plan'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Registered Devices</span>
              <span className="font-semibold text-slate-900">
                {systemInfo ? `${systemInfo.deviceCount} / ${systemInfo.deviceLimit}` : '1 / 5'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Data Retention</span>
              <span className="font-semibold text-slate-900">{systemInfo?.dataRetention || '30 days'}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">API Access</span>
              <span className="font-semibold text-emerald-600">{systemInfo?.apiAccess || 'Enabled'}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-1">
              <span className="text-slate-500 font-medium">Account ID</span>
              <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {user.id}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ==================================================== */}
      {/* MODAL: CHANGE PASSWORD */}
      {/* ==================================================== */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
              {passwordError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
                  {passwordSuccess}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Current Password</label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShowPasswordModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? <Spinner className="h-4 w-4" /> : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: CHANGE EMAIL */}
      {/* ==================================================== */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  {emailStep === 'request' ? 'Change Email Address' : 'Verify Email Code'}
                </h3>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {emailStep === 'request' ? (
              <form onSubmit={handleEmailRequest} className="mt-4 space-y-4">
                {emailError && (
                  <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                    {emailError}
                  </div>
                )}
                {emailSuccess && (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
                    {emailSuccess}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">New Email Address</label>
                  <input
                    type="email"
                    required
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                    placeholder="newemail@example.com"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Current Password</label>
                  <input
                    type="password"
                    required
                    value={emailForm.currentPassword}
                    onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button type="button" variant="ghost" onClick={() => setShowEmailModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={emailSaving}>
                    {emailSaving ? <Spinner className="h-4 w-4" /> : 'Send Verification OTP'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleEmailVerify} className="mt-4 space-y-4">
                {emailError && (
                  <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                    {emailError}
                  </div>
                )}
                {emailSuccess && (
                  <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
                    {emailSuccess}
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  We sent a 6-digit OTP code to <strong>{emailForm.newEmail}</strong>. Please enter it below to confirm:
                </p>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={emailForm.otp}
                    onChange={(e) => setEmailForm({ ...emailForm, otp: e.target.value })}
                    placeholder="123456"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-center text-lg font-mono font-bold tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEmailStep('request')}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    ← Change Email
                  </button>
                  <Button type="submit" disabled={emailSaving}>
                    {emailSaving ? <Spinner className="h-4 w-4" /> : 'Confirm & Update Email'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: 2FA SETUP */}
      {/* ==================================================== */}
      {false && show2FASetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Setup 2-Factor Authentication</h3>
              </div>
              <button onClick={() => setShow2FASetupModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleVerify2FA} className="mt-4 space-y-4">
              {twoFactorError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {twoFactorError}
                </div>
              )}
              {twoFactorSuccess && (
                <div className="rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700 border border-emerald-200">
                  {twoFactorSuccess}
                </div>
              )}

              {twoFactorSetupData && (
                <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                  <p className="text-xs font-medium text-slate-600">
                    Secret Key (Authenticator App):
                  </p>
                  <p className="font-mono text-sm font-bold text-blue-700 tracking-wider select-all bg-blue-50 p-2 rounded text-center">
                    {twoFactorSetupData!.secret}
                  </p>
                  {twoFactorSetupData!.verificationCode && (
                    <p className="text-[11px] text-slate-500 text-center">
                      Demo Code: <span className="font-bold text-slate-800">{twoFactorSetupData!.verificationCode}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Enter 6-Digit Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-center text-lg font-mono font-bold tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShow2FASetupModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={twoFactorSaving}>
                  {twoFactorSaving ? <Spinner className="h-4 w-4" /> : 'Enable 2FA'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: 2FA DISABLE */}
      {/* ==================================================== */}
      {false && show2FADisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-900">Disable 2-Factor Authentication</h3>
              </div>
              <button onClick={() => setShow2FADisableModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDisable2FA} className="mt-4 space-y-4">
              {twoFactorError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {twoFactorError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                Are you sure you want to disable 2-Factor Authentication? Your account will no longer require a 2FA verification code.
              </p>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Confirm Current Password (Optional)</label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setShow2FADisableModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="danger" disabled={twoFactorSaving}>
                  {twoFactorSaving ? <Spinner className="h-4 w-4" /> : 'Confirm Disable 2FA'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
