import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Waves, Mail, Lock, ArrowRight, AlertCircle, User, CheckCircle2, Eye, EyeOff, ShieldAlert, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 p-12 lg:flex">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-20 top-20 h-96 w-96 rounded-full bg-cyan-400/20 blur-[100px]" />
          <div className="absolute -left-20 bottom-20 h-96 w-96 rounded-full bg-blue-400/20 blur-[100px]" />
        </div>
        <Link to="/" className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Waves className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">AquaNova</span>
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold text-white">Smart Aquaculture, Powered by AI</h2>
          <p className="mt-4 max-w-md text-blue-100">
            Monitor water quality, predict issues before they happen, and let AI watch your fish — all from one dashboard.
          </p>
          <div className="mt-8 flex gap-8">
            <div>
              <p className="text-3xl font-bold text-white">24/7</p>
              <p className="text-sm text-blue-200">Monitoring</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">6</p>
              <p className="text-sm text-blue-200">Sensors</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">94%</p>
              <p className="text-sm text-blue-200">AI Accuracy</p>
            </div>
          </div>
        </div>
        <p className="relative text-sm text-blue-200">© 2026 AquaNova</p>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">AquaNova</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder = 'Password',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
        <Lock className="h-5 w-5" />
      </div>
      <input
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-11 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
        title={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Input({
  icon,
  type = 'text',
  placeholder,
  value,
  onChange,
}: {
  icon: ReactNode;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

export function LoginPage() {
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [roleMode, setRoleMode] = useState<'customer' | 'admin'>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const finalEmail = email.trim();
    const finalPassword = password;

    const res = await signIn(finalEmail, finalPassword);
    setLoading(false);
    
    if (res.requiresVerification) {
      navigate(`/verify-otp?email=${encodeURIComponent(res.email || finalEmail)}`);
    } else if (res.error) {
      setError(res.error);
    } else {
      if (roleMode === 'customer' && (res.user?.role === 'admin' || finalEmail.toLowerCase() === 'fakhruddinkhan7253@gmail.com')) {
        await signOut();
        setError('This is an administrator account. Select Admin Panel to sign in.');
        return;
      }
      const isAdmin =
        roleMode === 'admin' ||
        res.user?.role === 'admin' ||
        res.user?.user_metadata?.role === 'admin' ||
        finalEmail.toLowerCase() === 'fakhruddinkhan7253@gmail.com';

      if (isAdmin) {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your AquaNova dashboard or Admin panel">
      {/* Role Selection Tabs */}
      <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 border border-slate-200">
        <button
          type="button"
          onClick={() => setRoleMode('customer')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
            roleMode === 'customer'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" /> Customer Portal
        </button>
        <button
          type="button"
          onClick={() => {
            setRoleMode('admin');
            if (!email) {
              setEmail('fakhruddinkhan7253@gmail.com');
            }
          }}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition-all ${
            roleMode === 'admin'
              ? 'bg-slate-900 text-cyan-300 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-cyan-400" /> Admin Panel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {roleMode === 'admin' && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3 text-xs text-blue-800">
            <p className="font-semibold mb-0.5">Admin Security Portal</p>
            <p className="text-blue-700/90">Sign in with the assigned administrator account (<code className="font-mono bg-blue-100/80 px-1 py-0.5 rounded">fakhruddinkhan7253@gmail.com</code>).</p>
          </div>
        )}

        <Input
          icon={<Mail className="h-5 w-5" />}
          type="email"
          placeholder={roleMode === 'admin' ? 'Administrator email' : 'Email address'}
          value={email}
          onChange={setEmail}
        />
        <PasswordInput
          placeholder={roleMode === 'admin' ? 'Admin Password' : 'Password'}
          value={password}
          onChange={setPassword}
        />
        
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-700">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className={`w-full ${roleMode === 'admin' ? 'bg-slate-900 hover:bg-slate-800 text-white' : ''}`} disabled={loading}>
          {loading ? 'Authenticating...' : roleMode === 'admin' ? 'Sign In to Admin Panel' : 'Sign In'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don't have a customer account?{' '}
        <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-700">
          Sign Up
        </Link>
      </p>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Public signup always creates a customer account
    const res = await signUp(email, password, fullName);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else if (res.requiresVerification) {
      navigate(`/verify-otp?email=${encodeURIComponent(res.email || email)}`);
    } else {
      navigate('/kit');
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Public sign up creates a Customer account — for Admin access, sign in as Admin">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Input icon={<User className="h-5 w-5" />} placeholder="Full name" value={fullName} onChange={setFullName} />
        <Input icon={<Mail className="h-5 w-5" />} type="email" placeholder="Email address" value={email} onChange={setEmail} />
        <PasswordInput placeholder="Password (min 6 characters)" value={password} onChange={setPassword} />
        
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />
          <span>Role Assigned: <strong>Customer</strong>. Admin privileges cannot be self-selected.</span>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { resetPassword, resetPasswordWithOtp } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (step !== 'verify' || otpSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setOtpSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, otpSecondsLeft]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setInterval(() => setResendSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSecondsLeft]);

  // Step 1: Request Password Reset Code
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    if (!email.trim()) {
      setError('Please enter your account email address.');
      return;
    }

    setLoading(true);
    const res = await resetPassword(email.trim());
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setInfoMessage(`We've sent a 6-digit verification code to ${email.trim()}.`);
      setStep('verify');
      setOtpSecondsLeft(600);
      setResendSecondsLeft(30);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setError(null);
    setResending(true);
    const res = await resetPassword(email.trim());
    setResending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setInfoMessage('A fresh 6-digit verification code has been dispatched.');
      setOtpSecondsLeft(600);
      setResendSecondsLeft(30);
    }
  };

  // Step 2: Verify Code and Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otp.trim() || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    const res = await resetPasswordWithOtp(email.trim(), otp.trim(), newPassword);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      setStep('success');
    }
  };

  return (
    <AuthLayout
      title={
        step === 'request'
          ? 'Reset password'
          : step === 'verify'
          ? 'Enter verification code'
          : 'Password updated!'
      }
      subtitle={
        step === 'request'
          ? "Enter your account email and we'll send a 6-digit reset code"
          : step === 'verify'
          ? `Check ${email} for your 6-digit security code`
          : 'You can now sign in with your new password'
      }
    >
      {step === 'request' && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          <Input
            icon={<Mail className="h-5 w-5" />}
            type="email"
            placeholder="Account email address"
            value={email}
            onChange={setEmail}
          />
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Sending code...' : 'Send Reset Code'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-xs text-blue-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
              {infoMessage}
            </div>
          )}

          <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${otpSecondsLeft ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-700'}`}>
            <span>{otpSecondsLeft ? 'Code expires in' : 'Code expired'}</span>
            <strong>{otpSecondsLeft ? `${String(Math.floor(otpSecondsLeft / 60)).padStart(2, '0')}:${String(otpSecondsLeft % 60).padStart(2, '0')}` : 'Request a new code'}</strong>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">6-Digit Code</label>
            <Input
              icon={<ShieldCheck className="h-5 w-5 text-blue-600" />}
              type="text"
              placeholder="e.g. 123456"
              value={otp}
              onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">New Password</label>
            <PasswordInput
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={setNewPassword}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Confirm Password</label>
            <PasswordInput
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Updating password...' : 'Update Password & Sign In'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>

          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setError(null);
              }}
              className="text-slate-500 hover:text-slate-700 underline"
            >
              Change email
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending || resendSecondsLeft > 0}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              {resending ? 'Resending...' : resendSecondsLeft > 0 ? `Resend in ${resendSecondsLeft}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 'success' && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-emerald-950">Password Successfully Changed</h3>
            <p className="mt-1 text-xs text-emerald-700">
              Your new password has been verified and saved to your account.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            onClick={() => navigate('/login')}
          >
            Sign In with New Password
          </Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Remembered your password?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
