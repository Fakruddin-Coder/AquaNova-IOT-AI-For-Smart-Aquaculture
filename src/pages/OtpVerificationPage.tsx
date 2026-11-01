import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Waves, Mail, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';

export function OtpVerificationPage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';
  const { verifyOTP, resendOTP } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(6).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>('Verification code sent to your email address!');
  const [cooldown, setCooldown] = useState(60);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 60-second timer count down
  useEffect(() => {
    let timer: any = null;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleChangeDigit = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste of 6 digits
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      if (digits.length > 0) {
        const newDigits = [...otpDigits];
        digits.forEach((d, i) => {
          if (index + i < 6) newDigits[index + i] = d;
        });
        setOtpDigits(newDigits);
        const nextIndex = Math.min(index + digits.length, 5);
        inputRefs.current[nextIndex]?.focus();
        return;
      }
    }

    const cleanVal = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = cleanVal;
    setOtpDigits(newDigits);

    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError('Please enter all 6 digits of the OTP code.');
      return;
    }

    setLoading(true);
    const { error } = await verifyOTP(email, fullOtp);
    setLoading(false);

    if (error) {
      setError(error);
    } else {
      setSuccess('Account verified successfully! Continue to purchase your AquaNova Kit.');
      setTimeout(() => {
        navigate('/kit');
      }, 1200);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setSuccess(null);
    setResending(true);

    const { error, cooldownRemaining } = await resendOTP(email);
    setResending(false);

    if (error) {
      setError(error);
      if (cooldownRemaining) setCooldown(cooldownRemaining);
    } else {
      setSuccess('A new 6-digit OTP code has been sent to your email.');
      setCooldown(60);
      setOtpDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel */}
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
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-200 backdrop-blur border border-cyan-400/30 mb-4">
            <ShieldCheck className="h-4 w-4" /> Two-Step Verification
          </div>
          <h2 className="text-3xl font-bold text-white">Protecting Your Aquaculture Infrastructure</h2>
          <p className="mt-4 max-w-md text-blue-100">
            Email verification ensures secure access to your tank sensors, automated feeder controls, and AI predictions.
          </p>
        </div>
        <p className="relative text-sm text-blue-200">© 2026 AquaNova</p>
      </div>

      {/* Right OTP Verification Panel */}
      <div className="flex w-full flex-col justify-center bg-white px-6 py-12 lg:w-1/2">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">AquaNova</span>
          </Link>

          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Mail className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Verify your email</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            We sent a 6-digit code to{' '}
            <strong className="font-semibold text-slate-900">{email || 'your email address'}</strong>
          </p>

          <form onSubmit={handleVerify} className="mt-8 space-y-6">
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-100 animate-scale-in">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-100 animate-scale-in">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            {/* 6 Digit Input Group */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Enter 6-Digit OTP Code
              </label>
              <div className="flex justify-between gap-2 sm:gap-3">
                {otpDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleChangeDigit(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="h-14 w-12 rounded-xl border border-slate-200 bg-slate-50 text-center text-xl font-bold text-slate-900 outline-none transition-all focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                ))}
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full text-base" disabled={loading}>
              {loading ? 'Verifying Code...' : 'Verify & Continue'}
              {!loading && <ArrowRight className="h-5 w-5" />}
            </Button>
          </form>

          {/* Resend OTP Section */}
          <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className={`flex items-center gap-2 text-sm font-semibold transition-colors ${
                cooldown > 0 || resending
                  ? 'cursor-not-allowed text-slate-400'
                  : 'text-blue-600 hover:text-blue-700'
              }`}
            >
              <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
              {resending
                ? 'Sending...'
                : cooldown > 0
                ? `Resend OTP in ${cooldown}s`
                : 'Resend OTP Code'}
            </button>

            <Link
              to="/signup"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Signup
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
