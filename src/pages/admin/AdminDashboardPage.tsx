import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Cpu,
  CreditCard,
  Box,
  Search,
  Filter,
  Download,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  DollarSign,
  ArrowRight,
  LogOut,
  Activity,
  Copy,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Waves,
  Sparkles,
  User as UserIcon,
  Camera,
  Trash2,
  Lock,
  Mail,
  Shield,
  Smartphone,
  QrCode,
  KeyRound
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import { api, getToken } from '@/services/api';

type AdminTab = 'overview' | 'orders' | 'customers' | 'devices' | 'payments' | 'tanks' | 'profile';

export default function AdminDashboardPage() {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [refreshNotification, setRefreshNotification] = useState<string | null>(null);

  // Live Data State from Backend
  const [overviewData, setOverviewData] = useState<{
    metrics: {
      totalOrders: number;
      totalRevenuePaise: number;
      totalRevenueFormatted: string;
      activeDevicesCount: number;
      totalCustomersCount: number;
      verificationFlagsCount: number;
    };
    recentOrders: any[];
    systemStatus: string;
  } | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [tanks, setTanks] = useState<any[]>([]);

  // Selected Detail Drawer Item State
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Admin Profile State
  const [adminName, setAdminName] = useState(user?.name || 'Admin Fakhruddin');
  const [adminPhone, setAdminPhone] = useState(user?.phone || '');
  const [adminAvatar, setAdminAvatar] = useState<string | null>(user?.avatar_url || null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security / Password State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resetCodeSent, setResetCodeSent] = useState(false);

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [loading2FA, setLoading2FA] = useState(true);
  const [show2FASetupModal, setShow2FASetupModal] = useState(false);
  const [show2FADisableModal, setShow2FADisableModal] = useState(false);
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{ secret: string; otpauthUrl: string; verificationCode: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);
  const [disablePassword, setDisablePassword] = useState('');

  // Sync user changes to local profile state
  useEffect(() => {
    if (user) {
      if (user.name) setAdminName(user.name);
      if (user.phone) setAdminPhone(user.phone);
      if (user.avatar_url !== undefined) setAdminAvatar(user.avatar_url);
    }
  }, [user]);

  // Load 2FA status
  useEffect(() => {
    async function check2FA() {
      try {
        const res: any = await api.get2FAStatus();
        if (res && typeof res.twoFactorEnabled === 'boolean') {
          setTwoFactorEnabled(res.twoFactorEnabled);
        }
      } catch (e) {} finally {
        setLoading2FA(false);
      }
    }
    check2FA();
  }, []);

  // Verify Admin Role
  const isAdmin =
    user?.role === 'admin' ||
    user?.user_metadata?.role === 'admin' ||
    user?.email?.toLowerCase() === 'fakhruddinkhan7253@gmail.com';

  // Fetch Admin Data from Express Backend API with Functional Refresh Support
  const fetchAdminData = async () => {
    setIsLoading(true);
    setIsRefreshing(true);
    try {
      const token = getToken();
      const headers: Record<string, string> = {
        'x-user-role': 'admin',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const [ovRes, ordRes, custRes, devRes, payRes, tnkRes] = await Promise.all([
        fetch('/api/admin/overview', { headers }).then((r) => r.json()).catch(() => null),
        fetch('/api/admin/orders', { headers }).then((r) => r.json()).catch(() => []),
        fetch('/api/admin/customers', { headers }).then((r) => r.json()).catch(() => []),
        fetch('/api/admin/devices', { headers }).then((r) => r.json()).catch(() => []),
        fetch('/api/admin/payments', { headers }).then((r) => r.json()).catch(() => []),
        fetch('/api/admin/tanks', { headers }).then((r) => r.json()).catch(() => [])
      ]);

      if (ovRes) setOverviewData(ovRes);
      if (Array.isArray(ordRes)) setOrders(ordRes);
      if (Array.isArray(custRes)) setCustomers(custRes);
      if (Array.isArray(devRes)) setDevices(devRes);
      if (Array.isArray(payRes)) setPayments(payRes);
      if (Array.isArray(tnkRes)) setTanks(tnkRes);

      const updatedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastRefreshedAt(updatedTime);
      setRefreshNotification('Data synchronized successfully!');
      setTimeout(() => setRefreshNotification(null), 2500);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setRefreshNotification('Sync warning: check backend server');
      setTimeout(() => setRefreshNotification(null), 3000);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();

    // Auto-refresh every 15 seconds for near real-time KPI sync
    const pollInterval = setInterval(() => {
      // Silent refresh — don't show loading spinner for background polls
      const silentRefresh = async () => {
        try {
          const token = getToken();
          const headers: Record<string, string> = {
            'x-user-role': 'admin',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          };

          const [ovRes, ordRes, custRes, devRes, payRes, tnkRes] = await Promise.all([
            fetch('/api/admin/overview', { headers }).then((r) => r.json()).catch(() => null),
            fetch('/api/admin/orders', { headers }).then((r) => r.json()).catch(() => []),
            fetch('/api/admin/customers', { headers }).then((r) => r.json()).catch(() => []),
            fetch('/api/admin/devices', { headers }).then((r) => r.json()).catch(() => []),
            fetch('/api/admin/payments', { headers }).then((r) => r.json()).catch(() => []),
            fetch('/api/admin/tanks', { headers }).then((r) => r.json()).catch(() => [])
          ]);

          if (ovRes) setOverviewData(ovRes);
          if (Array.isArray(ordRes)) setOrders(ordRes);
          if (Array.isArray(custRes)) setCustomers(custRes);
          if (Array.isArray(devRes)) setDevices(devRes);
          if (Array.isArray(payRes)) setPayments(payRes);
          if (Array.isArray(tnkRes)) setTanks(tnkRes);

          setLastRefreshedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (err) {
          // Silent fail for background polls
        }
      };
      silentRefresh();
    }, 15000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleDeviceStatusChange = async (deviceId: string, newStatus: string) => {
    try {
      await fetch('/api/admin/devices/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
        body: JSON.stringify({ device_id: deviceId, new_status: newStatus })
      });
      fetchAdminData();
    } catch (e) {}
  };

  const deleteAdminRecord = async (kind: 'orders' | 'customers' | 'devices' | 'payments', id: string, label: string) => {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    const token = getToken();
    const response = await fetch(`/api/admin/${kind}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-user-role': 'admin', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setRefreshNotification(data.error || 'Delete failed');
      return;
    }
    await fetchAdminData();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const exportCsv = (filename: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...rows.map((row) => columns.map((key) => cell(row[key])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Profile Photo Handlers
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProfileError('Please select a valid JPEG, PNG, or WebP image.');
      return;
    }
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
          setAdminAvatar(res.avatarUrl || base64Image);
          await refreshProfile();
          setProfileSuccess('Admin profile photo updated successfully!');
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
        setAdminAvatar(null);
        await refreshProfile();
        setProfileSuccess('Admin profile photo removed.');
        setTimeout(() => setProfileSuccess(null), 3000);
      }
    } catch (err) {
      setProfileError('Failed to remove profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    setSavingProfile(true);

    try {
      const res: any = await api.updateProfile({
        name: adminName.trim(),
        phone: adminPhone.trim(),
      });
      if (res?.error) {
        setProfileError(res.error);
      } else {
        setProfileSuccess('Admin profile updated successfully!');
        await refreshProfile();
        setTimeout(() => setProfileSuccess(null), 3000);
      }
    } catch (err) {
      setProfileError('Failed to update admin profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Password Change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.currentPassword) {
      setPasswordError('Please enter your current admin password.');
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
        setPasswordSuccess(res?.message || 'Admin password changed successfully!');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setPasswordSuccess(null), 3000);
      }
    } catch (err) {
      setPasswordError('Failed to change password. Please verify current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // Quick Reset Password Link via Email
  const handleQuickResetEmail = async () => {
    try {
      await api.forgotPassword({ email: user?.email || 'fakhruddinkhan7253@gmail.com' });
      setResetCodeSent(true);
      setTimeout(() => setResetCodeSent(false), 6000);
    } catch (err) {}
  };

  // 2FA Setup
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
        setTwoFactorError(data?.error || 'Failed to initialize 2FA.');
      }
    } catch (err) {
      setTwoFactorError('Error connecting to 2FA service.');
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    if (!twoFactorCode || twoFactorCode.trim().length !== 6) {
      setTwoFactorError('Please enter a valid 6-digit code.');
      return;
    }
    setTwoFactorSaving(true);
    try {
      const res: any = await api.verify2FA(twoFactorCode.trim());
      if (res?.error) {
        setTwoFactorError(res.error);
      } else {
        setTwoFactorSuccess('Two-Factor Authentication Enabled for Administrator!');
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

  const exportCurrentTab = () => {
    const datasets: Record<AdminTab, Record<string, unknown>[]> = {
      overview: orders,
      orders,
      customers,
      devices,
      payments,
      tanks,
      profile: [],
    };
    exportCsv(`aquanova-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`, datasets[activeTab] || orders);
  };

  // If not admin, render Access Denied 403 Page
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
        <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
          <div className="h-16 w-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">Access Restricted (403)</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            You do not have permission to access the internal AquaNova Operations Admin Panel. This surface requires an Admin role.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold">
            Return to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight text-slate-900">AquaNova</span>
                <span className="px-3 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] tracking-wider uppercase border border-blue-200/80 shadow-sm">
                  ADMIN PORTAL
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Operations, Hardware & Customer Kit Intelligence</p>
            </div>
          </Link>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {refreshNotification && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 shadow-sm animate-fade-in">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{refreshNotification}</span>
            </div>
          )}

          {/* Functional Refresh Button */}
          <button
            onClick={fetchAdminData}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-2 text-xs font-bold border border-slate-200 shadow-sm active:scale-95 disabled:opacity-75"
            title={`Refresh telemetry & orders (Last updated: ${lastRefreshedAt})`}
          >
            <RefreshCw className={`h-4 w-4 text-blue-600 ${isRefreshing ? 'animate-spin text-cyan-600' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={exportCurrentTab}
            className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm shadow-blue-500/20 active:scale-95"
            title="Export current section as CSV"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>

          {/* Admin Profile Header Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2.5 rounded-2xl p-1.5 pr-3 transition-all text-left group ${
                activeTab === 'profile'
                  ? 'bg-blue-50 border border-blue-200 shadow-sm'
                  : 'hover:bg-slate-100 border border-transparent'
              }`}
              title="Open Admin Profile & Security"
            >
              <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden border border-white">
                {adminAvatar ? (
                  <img src={adminAvatar} alt="Admin" className="h-full w-full object-cover" />
                ) : (
                  <span>{(adminName || user?.name || 'AD').slice(0, 2).toUpperCase()}</span>
                )}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-extrabold text-slate-900 tracking-tight leading-tight group-hover:text-blue-600 transition-colors">
                  {user?.email || 'fakhruddinkhan7253@gmail.com'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider">SUPER ADMINISTRATOR</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                  <span className="text-[10px] text-slate-400 font-medium">{lastRefreshedAt}</span>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                signOut();
                navigate('/login');
              }}
              className="p-2.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-100"
              title="Sign Out of Admin Portal"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white/80 backdrop-blur border-r border-slate-200/80 p-5 flex flex-col justify-between hidden md:flex shadow-sm">
          <nav className="space-y-2">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">System Sections</p>

            <SidebarItem
              icon={<LayoutDashboard className="h-4 w-4" />}
              label="Overview"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />

            <SidebarItem
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Orders Directory"
              count={orders.length}
              active={activeTab === 'orders'}
              onClick={() => setActiveTab('orders')}
            />

            <SidebarItem
              icon={<Users className="h-4 w-4" />}
              label="Customers"
              count={customers.length}
              active={activeTab === 'customers'}
              onClick={() => setActiveTab('customers')}
            />

            <SidebarItem
              icon={<Cpu className="h-4 w-4" />}
              label="AquaNova Device IDs"
              count={devices.length}
              active={activeTab === 'devices'}
              onClick={() => setActiveTab('devices')}
            />

            <SidebarItem
              icon={<CreditCard className="h-4 w-4" />}
              label="Payments Audit"
              count={payments.length}
              active={activeTab === 'payments'}
              onClick={() => setActiveTab('payments')}
            />

            <SidebarItem
              icon={<Box className="h-4 w-4" />}
              label="Tanks & Setup"
              count={tanks.length}
              active={activeTab === 'tanks'}
              onClick={() => setActiveTab('tanks')}
            />

            <SidebarItem
              icon={<UserIcon className="h-4 w-4" />}
              label="Admin Profile & Security"
              active={activeTab === 'profile'}
              onClick={() => setActiveTab('profile')}
            />
          </nav>

          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 rounded-3xl p-4 text-xs space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Gateway Sync:</span>
              <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-semibold">Auto-Provision:</span>
              <span className="text-blue-700 font-bold font-mono">ENABLED</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
          {/* Mobile Tab Selector */}
          <div className="md:hidden mb-6 flex overflow-x-auto gap-2 pb-2">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'orders', label: 'Orders' },
              { id: 'customers', label: 'Customers' },
              { id: 'devices', label: 'Devices' },
              { id: 'payments', label: 'Payments' },
              { id: 'tanks', label: 'Tanks' },
              { id: 'profile', label: 'Admin Profile' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Stat Cards */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Total Revenue"
                  value={overviewData?.metrics?.totalRevenueFormatted || '₹99,996'}
                  subtext="Gross Kit Purchases"
                  icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
                  bgColor="bg-emerald-50"
                  borderColor="border-emerald-100"
                />

                <MetricCard
                  title="Kit Orders Placed"
                  value={overviewData?.metrics?.totalOrders || orders.length}
                  subtext="Orders processed"
                  icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
                  bgColor="bg-blue-50"
                  borderColor="border-blue-100"
                />

                <MetricCard
                  title="Active AquaNova Devices"
                  value={overviewData?.metrics?.activeDevicesCount || devices.length}
                  subtext="Connected & streaming"
                  icon={<Cpu className="h-5 w-5 text-cyan-600" />}
                  bgColor="bg-cyan-50"
                  borderColor="border-cyan-100"
                />

                <MetricCard
                  title="Registered Customers"
                  value={Math.max(overviewData?.metrics?.totalCustomersCount || 0, customers.length)}
                  subtext="Unique farm accounts"
                  icon={<Users className="h-5 w-5 text-indigo-600" />}
                  bgColor="bg-indigo-50"
                  borderColor="border-indigo-100"
                />
              </div>

              {/* Recent Orders Section */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Recent Hardware Kit Orders</h3>
                    <p className="text-xs text-slate-500 font-medium">Live stream of incoming kit orders & payment status</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    View All Orders <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider bg-slate-50/70">
                        <th className="py-3 px-3">Order ID</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Tank & Type</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Device Code</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 5).map((ord) => (
                        <tr key={ord.order_id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3.5 px-3 font-mono font-extrabold text-blue-600">{ord.order_id}</td>
                          <td className="py-3.5 px-3">
                            <p className="font-bold text-slate-900">{ord.customer_name}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{ord.customer_email}</p>
                          </td>
                          <td className="py-3.5 px-3 text-slate-700">
                            <p className="font-bold text-slate-900">{ord.tank_name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{ord.tank_type}</p>
                          </td>
                          <td className="py-3.5 px-3 font-extrabold text-emerald-600">
                            ₹{((ord.amount || 2499900) / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-3 font-mono text-cyan-700 font-extrabold">
                            {ord.assigned_device_code || 'AQN-PENDING'}
                          </td>
                          <td className="py-3.5 px-3">
                            <StatusBadge status={ord.status} />
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              onClick={() => setSelectedOrder(ord)}
                              className="px-3.5 py-1 bg-slate-100 hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 text-slate-700 hover:text-white rounded-xl transition-all font-bold text-xs border border-slate-200 shadow-sm"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kit Orders Directory</h2>
                  <p className="text-xs text-slate-500 font-medium">Manage customer purchases, delivery addresses & Razorpay verification</p>
                </div>
                <button
                  onClick={() => exportCsv('aquanova-orders.csv', orders)}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center gap-2 shadow-sm"
                >
                  <Download className="h-4 w-4 text-blue-600" /> Export Orders Data
                </button>
              </div>

              {/* Filters & Search */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4 flex flex-col sm:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="relative w-full sm:w-80">
                  <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search customer, email, order ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 focus:bg-white font-medium"
                  />
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 px-3.5 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Paid & Verified</option>
                    <option value="created">Pending Payment</option>
                    <option value="verification_failed">Verification Failed</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Order ID</th>
                        <th className="py-3.5 px-4">Customer Details</th>
                        <th className="py-3.5 px-4">Tank Specs</th>
                        <th className="py-3.5 px-4">Shipping City</th>
                        <th className="py-3.5 px-4">Amount</th>
                        <th className="py-3.5 px-4">Device ID</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders
                        .filter((o) => {
                          const matchesQuery =
                            !searchQuery ||
                            o.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.customer_email?.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
                          return matchesQuery && matchesStatus;
                        })
                        .map((ord) => (
                          <tr key={ord.order_id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-4 px-4 font-mono text-blue-600 font-extrabold">{ord.order_id}</td>
                            <td className="py-4 px-4">
                              <p className="font-bold text-slate-900">{ord.customer_name}</p>
                              <p className="text-[11px] text-slate-500 font-medium">{ord.customer_email}</p>
                              <p className="text-[10px] text-slate-400">{ord.customer_phone}</p>
                            </td>
                            <td className="py-4 px-4 text-slate-700">
                              <p className="font-bold text-slate-900">{ord.tank_name}</p>
                              <p className="text-[10px] text-slate-500 font-medium">{ord.tank_type} ({ord.tank_size})</p>
                            </td>
                            <td className="py-4 px-4 text-slate-700 font-semibold">
                              {ord.city}, {ord.state}
                            </td>
                            <td className="py-4 px-4 font-extrabold text-emerald-600">
                              ₹{((ord.amount || 2499900) / 100).toLocaleString('en-IN')}
                            </td>
                            <td className="py-4 px-4 font-mono text-cyan-700 font-extrabold">
                              {ord.assigned_device_code || 'AQN-PENDING'}
                            </td>
                            <td className="py-4 px-4">
                              <StatusBadge status={ord.status} />
                            </td>
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => setSelectedOrder(ord)}
                                className="px-3.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-600 hover:text-white rounded-xl transition-all font-bold text-xs flex items-center gap-1 ml-auto shadow-sm"
                              >
                                View Details <ChevronRight className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => deleteAdminRecord('orders', ord.order_id, `order ${ord.order_id}`)} className="ml-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold text-xs">Delete</button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Registered Farm Customers</h2>
                  <p className="text-xs text-slate-500 font-medium">Customer accounts, device ownership & order history</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Customer Name</th>
                        <th className="py-3.5 px-4">Contact Info</th>
                        <th className="py-3.5 px-4">Total Orders</th>
                        <th className="py-3.5 px-4">Total Spent</th>
                        <th className="py-3.5 px-4">Assigned Devices</th>
                        <th className="py-3.5 px-4">Registered Tanks</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map((cust) => (
                        <tr key={cust.customer_email} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-4 px-4 font-extrabold text-slate-900">{cust.customer_name}</td>
                          <td className="py-4 px-4">
                            <p className="text-blue-600 font-bold">{cust.customer_email}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{cust.customer_phone}</p>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-800">{cust.orders_count} Kit(s)</td>
                          <td className="py-4 px-4 font-extrabold text-emerald-600">
                            ₹{((cust.total_spent || 0) / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="py-4 px-4">
                            {cust.devices?.map((d: string) => (
                              <span key={d} className="inline-block px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 font-mono text-[11px] font-bold border border-cyan-200 mr-1">
                                {d}
                              </span>
                            ))}
                          </td>
                          <td className="py-4 px-4 text-slate-700 font-semibold">
                            {cust.tanks?.join(', ')}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => setSelectedCustomer(cust)}
                              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-bold text-xs border border-slate-200"
                            >
                              View Customer
                            </button>
                            <button onClick={() => deleteAdminRecord('customers', cust.customer_email, `customer ${cust.customer_email}`)} className="ml-2 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold text-xs">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DEVICES */}
          {activeTab === 'devices' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">AquaNova Hardware Devices</h2>
                  <p className="text-xs text-slate-500 font-medium">All issued ESP32 Device IDs, connection state & hardware maintenance</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Device ID</th>
                        <th className="py-3.5 px-4">Linked Customer</th>
                        <th className="py-3.5 px-4">Tank Name</th>
                        <th className="py-3.5 px-4">Firmware</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Hardware Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {devices.map((dev) => (
                        <tr key={dev.device_id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-4 px-4 font-mono font-extrabold text-blue-600 text-sm">
                            {dev.device_id}
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-bold text-slate-900">{dev.customer_name}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{dev.customer_email}</p>
                          </td>
                          <td className="py-4 px-4 text-slate-700 font-semibold">
                            {dev.tank_name} ({dev.tank_type})
                          </td>
                          <td className="py-4 px-4 font-mono text-slate-500 font-medium">v{dev.firmware || '1.2.4'}</td>
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold ${
                                dev.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : dev.status === 'replaced'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${dev.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                              {dev.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {dev.status !== 'replaced' ? (
                                <button
                                  onClick={() => handleDeviceStatusChange(dev.device_id, 'replaced')}
                                  className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-[11px] font-bold"
                                >
                                  Mark Replaced
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDeviceStatusChange(dev.device_id, 'active')}
                                  className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-[11px] font-bold"
                                >
                                  Re-Activate
                                </button>
                              )}
                              <button onClick={() => deleteAdminRecord('devices', dev.device_id, `device ${dev.device_id}`)} className="px-3 py-1 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-[11px] font-bold">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PAYMENTS */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Payment Audit Log</h2>
                  <p className="text-xs text-slate-500 font-medium">Razorpay transactions, HMAC signatures & verification flags</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Payment Reference</th>
                        <th className="py-3.5 px-4">Razorpay Order ID</th>
                        <th className="py-3.5 px-4">Customer</th>
                        <th className="py-3.5 px-4">Amount</th>
                        <th className="py-3.5 px-4">Signature Check</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((pay) => (
                        <tr key={pay.payment_id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-4 px-4 font-mono text-slate-800 font-bold">{pay.payment_id}</td>
                          <td className="py-4 px-4 font-mono text-blue-600 font-bold">{pay.order_id}</td>
                          <td className="py-4 px-4">
                            <p className="font-bold text-slate-900">{pay.customer_name}</p>
                            <p className="text-[11px] text-slate-500 font-medium">{pay.customer_email}</p>
                          </td>
                          <td className="py-4 px-4 font-extrabold text-emerald-600">
                            ₹{(pay.amount / 100).toLocaleString('en-IN')}
                          </td>
                          <td className="py-4 px-4">
                            {pay.signature_verified ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5" /> HMAC Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-700 text-xs font-bold bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                <AlertTriangle className="h-3.5 w-3.5" /> Flagged
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <StatusBadge status={pay.status} />
                          </td>
                          <td className="py-4 px-4 text-right"><button onClick={() => deleteAdminRecord('payments', pay.order_id, `payment ${pay.payment_id}`)} className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-xl font-bold text-xs">Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: TANKS */}
          {activeTab === 'tanks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Registered Farm Tanks</h2>
                  <p className="text-xs text-slate-500 font-medium">Reference directory of active aquaculture tanks across customers</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                        <th className="py-3.5 px-4">Tank Name</th>
                        <th className="py-3.5 px-4">Type</th>
                        <th className="py-3.5 px-4">Capacity</th>
                        <th className="py-3.5 px-4">Location</th>
                        <th className="py-3.5 px-4">Owner Email</th>
                        <th className="py-3.5 px-4">Linked Device</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tanks.map((tnk, i) => (
                        <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-4 px-4 font-extrabold text-slate-900">{tnk.tank_name}</td>
                          <td className="py-4 px-4">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                              {tnk.tank_type}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-slate-700 font-semibold">{tnk.tank_size}</td>
                          <td className="py-4 px-4 text-slate-500 font-medium">{tnk.location}</td>
                          <td className="py-4 px-4 text-blue-600 font-bold">{tnk.customer_email}</td>
                          <td className="py-4 px-4 font-mono text-cyan-700 font-extrabold">{tnk.device_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ADMIN PROFILE & SECURITY */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-fade-in">
              {/* Header Title Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <UserIcon className="h-6 w-6 text-blue-600" /> Administrator Profile & Security
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Manage administrative identity, authentication credentials, profile avatar, and system privileges.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Super Admin Access
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> Verified Session
                  </span>
                </div>
              </div>

              {/* Top Hero Card with Avatar & Quick Stats */}
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
                <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
                <div className="absolute left-1/3 bottom-0 -mb-12 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Avatar Upload Container */}
                  <div className="relative group shrink-0">
                    <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-blue-500 to-cyan-400 p-1 shadow-2xl shadow-blue-500/30">
                      <div className="h-full w-full rounded-[22px] bg-slate-900 overflow-hidden flex items-center justify-center relative">
                        {adminAvatar ? (
                          <img src={adminAvatar} alt="Admin" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-3xl font-extrabold text-cyan-300">
                            {(adminName || user?.name || 'AD').slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        {uploadingPhoto && (
                          <div className="absolute inset-0 bg-slate-950/75 flex items-center justify-center backdrop-blur-sm">
                            <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Camera upload overlay trigger */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-white text-slate-900 shadow-lg hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-200 active:scale-95"
                      title="Upload New Profile Photo"
                    >
                      <Camera className="h-4 w-4" />
                    </button>

                    {adminAvatar && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={uploadingPhoto}
                        className="absolute -top-2 -right-2 p-2 rounded-xl bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all active:scale-95"
                        title="Remove Profile Photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </div>

                  {/* Profile Meta Information */}
                  <div className="text-center sm:text-left flex-1">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2">
                      <h3 className="text-2xl font-black tracking-tight text-white">{adminName || 'Admin Fakhruddin'}</h3>
                      <span className="px-3 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 font-extrabold text-[10px] tracking-wider uppercase border border-cyan-400/30">
                        SUPER ADMIN
                      </span>
                    </div>

                    <p className="text-sm text-blue-200 font-medium flex items-center justify-center sm:justify-start gap-2 mb-4">
                      <Mail className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>{user?.email || 'fakhruddinkhan7253@gmail.com'}</span>
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div>
                        <p className="text-blue-300/80 font-medium">Contact Phone</p>
                        <p className="font-bold text-white mt-0.5">{adminPhone || user?.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-blue-300/80 font-medium">Two-Factor Auth</p>
                        <p className={`font-bold mt-0.5 ${twoFactorEnabled ? 'text-emerald-400' : 'text-amber-300'}`}>
                          {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-300/80 font-medium">Platform Access</p>
                        <p className="font-bold text-cyan-300 mt-0.5">Unrestricted</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Column 1: Personal & Account Details */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-blue-600" /> Administrator Details
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Update administrator name and contact details.</p>
                  </div>

                  {profileSuccess && (
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      {profileSuccess}
                    </div>
                  )}

                  {profileError && (
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 text-red-800 text-xs font-semibold border border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                      {profileError}
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Full Name
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="e.g. Fakhruddin Khan"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Phone Number
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <input
                          type="text"
                          value={adminPhone}
                          onChange={(e) => setAdminPhone(e.target.value)}
                          placeholder="+91 9988776655"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Account Email Address
                      </label>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                          <Mail className="h-4 w-4" />
                        </div>
                        <input
                          type="email"
                          value={user?.email || 'fakhruddinkhan7253@gmail.com'}
                          disabled
                          className="w-full rounded-2xl border border-slate-200 bg-slate-100/70 py-2.5 pl-10 pr-4 text-sm text-slate-500 cursor-not-allowed font-medium"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Verified
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Assigned System Role
                      </label>
                      <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-xs font-extrabold text-blue-950">Super Administrator</p>
                            <p className="text-[10px] text-blue-700">Full operations, kit provisioning, and server control</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-extrabold text-blue-700 bg-white px-2 py-0.5 rounded-lg border border-blue-200">
                          ROOT
                        </span>
                      </div>
                    </div>

                    <Button type="submit" disabled={savingProfile} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5">
                      {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                    </Button>
                  </form>
                </div>

                {/* Column 2: Security, Password & 2FA */}
                <div className="space-y-6">
                  {/* Change Password Card */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
                    <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                          <Lock className="h-5 w-5 text-blue-600" /> Change Administrator Password
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Ensure strong password security for the Super Admin account.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold flex items-center gap-1 p-1 rounded-lg"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        <span>{showPassword ? 'Hide' : 'Show'}</span>
                      </button>
                    </div>

                    {passwordSuccess && (
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        {passwordSuccess}
                      </div>
                    )}

                    {passwordError && (
                      <div className="flex items-center gap-2 p-3 rounded-2xl bg-red-50 text-red-800 text-xs font-semibold border border-red-200">
                        <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                        {passwordError}
                      </div>
                    )}

                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Current Password
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                            <KeyRound className="h-4 w-4" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            placeholder="Enter current password"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            New Password
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            placeholder="Min 6 characters"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Confirm Password
                          </label>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            placeholder="Re-enter new password"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                        <Button type="submit" disabled={passwordSaving} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5">
                          {passwordSaving ? 'Updating Password...' : 'Update Password'}
                        </Button>

                        <button
                          type="button"
                          onClick={handleQuickResetEmail}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2"
                        >
                          {resetCodeSent ? '✓ Reset code dispatched to email' : 'Forgot password?'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Two-Factor Authentication Card */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                          <Shield className="h-5 w-5 text-blue-600" /> Two-Factor Authentication (2FA)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">Protect high-level hardware operations with TOTP verification.</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${twoFactorEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {twoFactorEnabled ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-slate-600 max-w-sm">
                        {twoFactorEnabled
                          ? '2FA is protecting your Administrator access. Authentication code required on sensitive administrative changes.'
                          : 'Add an extra layer of protection to safeguard hardware commands and device provisioning.'}
                      </p>
                      {twoFactorEnabled ? (
                        <Button
                          onClick={() => setShow2FADisableModal(true)}
                          className="shrink-0 ml-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold"
                        >
                          Disable 2FA
                        </Button>
                      ) : (
                        <Button
                          onClick={handleOpen2FASetup}
                          className="shrink-0 ml-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold"
                        >
                          Configure 2FA
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* System & Infrastructure Audit Card */}
                  <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-cyan-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400">System Gateway & Connectivity</h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">Last Synced: {lastRefreshedAt}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                        <p className="text-slate-400 font-medium">MQTT Broker WS</p>
                        <p className="font-mono font-bold text-cyan-300 mt-1">ws://localhost:9001</p>
                      </div>
                      <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/60">
                        <p className="text-slate-400 font-medium">API Server</p>
                        <p className="font-mono font-bold text-emerald-400 mt-1">http://localhost:5000</p>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center">
                      <p className="text-[11px] text-slate-400">Super Administrator Privileges Active</p>
                      <button
                        type="button"
                        onClick={fetchAdminData}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1.5"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Force Telemetry Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SINGLE-PAGE ORDER DETAIL DRAWER */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full overflow-y-auto p-6 text-slate-900 space-y-6 shadow-2xl font-sans">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Order Specification</span>
                <h3 className="text-xl font-extrabold font-mono text-slate-900">{selectedOrder.order_id}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1.5">
                <h4 className="text-xs font-extrabold uppercase text-blue-600 tracking-wider">Customer PII Information</h4>
                <p className="text-sm font-extrabold text-slate-900">{selectedOrder.customer_name}</p>
                <p className="text-xs text-slate-600 font-medium">Email: {selectedOrder.customer_email}</p>
                <p className="text-xs text-slate-600 font-medium">Phone: {selectedOrder.customer_phone}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1.5">
                <h4 className="text-xs font-extrabold uppercase text-blue-600 tracking-wider">Farm & Tank Setup</h4>
                <p className="text-sm font-extrabold text-slate-900">{selectedOrder.tank_name}</p>
                <p className="text-xs text-slate-600 font-medium">Type: {selectedOrder.tank_type}</p>
                <p className="text-xs text-slate-600 font-medium">Capacity: {selectedOrder.tank_size}</p>
                <p className="text-xs text-slate-600 font-medium">Location: {selectedOrder.tank_location || 'Not specified'}</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1.5">
                <h4 className="text-xs font-extrabold uppercase text-blue-600 tracking-wider">Shipping Delivery Address</h4>
                <p className="text-xs text-slate-700 font-medium leading-relaxed">
                  {selectedOrder.shipping_address}, {selectedOrder.city}, {selectedOrder.state} - {selectedOrder.pin_code}, {selectedOrder.country}
                </p>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 space-y-2 font-mono text-xs">
                <h4 className="text-xs font-bold uppercase text-cyan-400 font-sans tracking-wider">Payment & Device Audit</h4>
                <p className="text-slate-300">
                  Assigned Device ID: <span className="text-cyan-300 font-bold">{selectedOrder.assigned_device_code || 'AQN-PENDING'}</span>
                </p>
                <p className="text-slate-300">
                  Razorpay Payment ID: <span className="text-emerald-400">{selectedOrder.razorpay_payment_id || 'N/A'}</span>
                </p>
                <p className="text-slate-300">
                  Amount: <span className="text-emerald-400 font-bold">₹{((selectedOrder.amount || 2499900) / 100).toLocaleString('en-IN')}</span>
                </p>
              </div>
            </div>

            <Button onClick={() => setSelectedOrder(null)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold">
              Close Detail Drawer
            </Button>
          </div>
        </div>
      )}

      {/* SINGLE-PAGE CUSTOMER DETAIL DRAWER */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full overflow-y-auto p-6 text-slate-900 space-y-6 shadow-2xl font-sans">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Customer Profile View</span>
                <h3 className="text-xl font-extrabold text-slate-900">{selectedCustomer.customer_name}</h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-1.5">
                <p className="text-xs text-slate-600">Email: <span className="text-blue-600 font-extrabold">{selectedCustomer.customer_email}</span></p>
                <p className="text-xs text-slate-600">Phone: <span className="text-slate-800 font-semibold">{selectedCustomer.customer_phone}</span></p>
                <p className="text-xs text-slate-600">Total Kits Purchased: <span className="text-emerald-600 font-extrabold">{selectedCustomer.orders_count}</span></p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <h4 className="text-xs font-bold uppercase text-blue-600 mb-2">Owned AquaNova Device IDs</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.devices?.map((d: string) => (
                    <span key={d} className="px-3 py-1 bg-cyan-50 text-cyan-800 font-mono text-xs rounded-xl border border-cyan-200 font-bold">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={() => setSelectedCustomer(null)} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold">
              Close Profile
            </Button>
          </div>
        </div>
      )}

      {/* 2FA SETUP MODAL */}
      {show2FASetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Setup Admin 2FA</h3>
              </div>
              <button
                onClick={() => setShow2FASetupModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
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
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <KeyRound className="h-4 w-4 text-blue-600" />
                    <span>Secret Key (Authenticator App)</span>
                  </div>
                  <p className="font-mono text-sm font-bold text-blue-700 tracking-wider select-all bg-blue-50 p-2.5 rounded-xl text-center border border-blue-100">
                    {twoFactorSetupData.secret}
                  </p>
                  {twoFactorSetupData.verificationCode && (
                    <p className="text-[11px] text-slate-500 text-center font-medium">
                      Current Test Code: <span className="font-bold text-slate-800 font-mono">{twoFactorSetupData.verificationCode}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Enter 6-Digit Authenticator Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-center text-lg font-mono font-bold tracking-widest outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShow2FASetupModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  {twoFactorSaving ? 'Enabling...' : 'Enable 2FA'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2FA DISABLE MODAL */}
      {show2FADisableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="text-base font-bold text-slate-900">Disable Two-Factor Authentication</h3>
              </div>
              <button
                onClick={() => setShow2FADisableModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDisable2FA} className="mt-4 space-y-4">
              {twoFactorError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                  {twoFactorError}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to disable 2-Factor Authentication? High-privilege administrative actions will no longer prompt for secondary verification.
              </p>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Confirm Current Password (Optional)</label>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShow2FADisableModal(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={twoFactorSaving}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  {twoFactorSaving ? 'Disabling...' : 'Confirm Disable 2FA'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
        active
          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-500/25'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span>{label}</span>
      </div>
      {count !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function MetricCard({
  title,
  value,
  subtext,
  icon,
  bgColor,
  borderColor
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
}) {
  return (
    <div className={`bg-white border ${borderColor} rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 tracking-tight">{title}</span>
        <div className={`h-10 w-10 rounded-2xl ${bgColor} flex items-center justify-center border ${borderColor}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1 font-semibold">{subtext}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid' || status === 'captured') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Paid & Verified
      </span>
    );
  }

  if (status === 'verification_failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 animate-pulse">
        <AlertTriangle className="h-3 w-3 text-red-600" /> Signature Failed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="h-3 w-3 text-amber-600" /> Pending Payment
    </span>
  );
}
