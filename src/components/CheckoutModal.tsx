import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Copy,
  Check,
  Loader2,
  Box,
  MapPin,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRedirect?: () => void;
}

interface FormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  tankName: string;
  tankType: string;
  tankLocation: string;
  tankSize: string;
  tankUnit: string;
  shippingAddress: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  tankName?: string;
  tankType?: string;
  tankSize?: string;
  shippingAddress?: string;
  city?: string;
  state?: string;
  pinCode?: string;
}

const TANK_TYPES = ['Freshwater', 'Brackish', 'Shrimp Pond', 'RAS', 'Biofloc'];

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const navigate = useNavigate();
  const { signIn, refreshProfile } = useAuth();

  const [step, setStep] = useState<'form' | 'summary' | 'processing' | 'failed' | 'success'>('form');

  // Form State
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    tankName: '',
    tankType: 'Freshwater',
    tankLocation: '',
    tankSize: '1000',
    tankUnit: 'Liters',
    shippingAddress: '',
    city: '',
    state: '',
    pinCode: '',
    country: 'India'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FormErrors>({});

  // Pricing & Payment state
  const [pricing, setPricing] = useState<{ amount: number; currency: string; displayPrice: string; usdFormatted: string }>({
    amount: 2499900,
    currency: 'INR',
    displayPrice: '₹24,999',
    usdFormatted: '$299'
  });

  const [activeOrderData, setActiveOrderData] = useState<{ order_id: string; amount: number; currency: string; key_id: string } | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Success Confirmation State
  const [confirmationData, setConfirmationData] = useState<{
    orderId: string;
    amount: number;
    currency: string;
    deviceId: string;
    customerEmail: string;
  } | null>(null);

  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Fetch Pricing on Mount
  useEffect(() => {
    fetch('/api/config/pricing')
      .then((res) => res.json())
      .then((data) => {
        if (data.displayPrice) setPricing(data);
      })
      .catch(() => {});
  }, []);

  // Dynamically load Razorpay SDK script
  useEffect(() => {
    if (!document.getElementById('razorpay-checkout-script')) {
      const script = document.createElement('script');
      script.id = 'razorpay-checkout-script';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Field validation function
  const validateField = (name: keyof FormData, value: string): string | undefined => {
    switch (name) {
      case 'fullName':
        if (!value.trim() || value.trim().length < 2) return 'Full name is required (min 2 characters).';
        break;
      case 'email':
        if (!value.trim()) return 'Email address is required.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email address.';
        break;
      case 'phone':
        if (!value.trim()) return 'Phone number is required.';
        if (!/^([6-9]\d{9}|\+?[1-9]\d{7,14})$/.test(value.replace(/\s+/g, '')))
          return 'Enter a valid 10-digit Indian phone number.';
        break;
      case 'password':
        if (!value || value.length < 6) return 'Account password must be at least 6 characters.';
        break;
      case 'tankName':
        if (!value.trim() || value.trim().length < 2) return 'Tank / Farm name is required.';
        break;
      case 'tankSize':
        if (!value.trim() || isNaN(Number(value)) || Number(value) <= 0) return 'Tank size must be a positive number.';
        break;
      case 'shippingAddress':
        if (!value.trim() || value.trim().length < 5) return 'Complete shipping address is required.';
        break;
      case 'city':
        if (!value.trim() || value.trim().length < 2) return 'City is required.';
        break;
      case 'state':
        if (!value.trim() || value.trim().length < 2) return 'State is required.';
        break;
      case 'pinCode':
        if (!value.trim()) return 'PIN code is required.';
        if (!/^\d{6}$/.test(value.trim())) return 'PIN code must be a 6-digit number.';
        break;
      default:
        break;
    }
    return undefined;
  };

  const validateAll = () => {
    const newErrors: FormErrors = {};
    (Object.keys(formData) as Array<keyof FormData>).forEach((field) => {
      const err = validateField(field, formData[field]);
      if (err) newErrors[field as keyof FormErrors] = err;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const err = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: err }));
    }
  };

  const handleBlur = (field: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const isFormValid = Object.keys(formData).every(
    (field) => !validateField(field as keyof FormData, formData[field as keyof FormData])
  );

  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateAll()) {
      setStep('summary');
    }
  };

  // Create Order on Backend & Prepare Razorpay
  const handleInitiatePayment = async (isSandboxSimulation = false) => {
    setIsLoadingOrder(true);
    setPaymentError(null);

    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.fullName,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          password: formData.password,
          tankName: formData.tankName,
          tankType: formData.tankType,
          tankLocation: formData.tankLocation,
          tankSize: formData.tankSize,
          tankUnit: formData.tankUnit,
          shippingAddress: formData.shippingAddress,
          city: formData.city,
          state: formData.state,
          pinCode: formData.pinCode,
          country: formData.country
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Razorpay Order.');
      }

      setActiveOrderData(data);
      setIsLoadingOrder(false);

      if (isSandboxSimulation) {
        simulatePayment(data.order_id);
      } else {
        openRazorpayCheckout(data);
      }
    } catch (err: any) {
      console.error('Order creation error:', err);
      setIsLoadingOrder(false);
      setPaymentError(err.message || 'Could not initiate payment. Please try again.');
      setStep('failed');
    }
  };

  // Open Razorpay Modal
  const openRazorpayCheckout = (orderData: { order_id: string; amount: number; currency: string; key_id: string }) => {
    setStep('processing');

    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'AquaNova Smart Aquaculture',
      description: 'AquaNova Smart Aquaculture Kit Purchase',
      image: '/kit-image.png',
      order_id: orderData.order_id,
      prefill: {
        name: formData.fullName,
        email: formData.email,
        contact: formData.phone
      },
      theme: {
        color: '#2563eb'
      },
      handler: async function (response: any) {
        verifyPayment(response);
      },
      modal: {
        ondismiss: function () {
          setPaymentError('Razorpay modal closed. You can retry with Razorpay or use Test Sandbox simulation.');
          setStep('failed');
        }
      }
    };

    if (window.Razorpay) {
      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          setPaymentError(response.error?.description || 'Razorpay Key/Payment error. Use Test Sandbox below.');
          setStep('failed');
        });
        rzp.open();
      } catch (e: any) {
        console.warn('Razorpay SDK modal error:', e);
        simulatePayment(orderData.order_id);
      }
    } else {
      simulatePayment(orderData.order_id);
    }
  };

  // Simulate Payment for Test Sandbox / Demo Mode
  const simulatePayment = (targetOrderId?: string) => {
    const oId = targetOrderId || activeOrderData?.order_id || 'order_' + Math.random().toString(36).substring(2, 10);
    setStep('processing');
    setTimeout(() => {
      verifyPayment({
        razorpay_order_id: oId,
        razorpay_payment_id: 'pay_' + Math.random().toString(36).substring(2, 12),
        razorpay_signature: 'mock_valid_signature'
      });
    }, 1200);
  };

  // Verify Payment Server-Side & Provision Account
  const verifyPayment = async (razorpayResponse: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    setIsVerifying(true);
    setPaymentError(null);

    try {
      const res = await fetch('/api/orders/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(razorpayResponse)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Payment signature verification failed.');
      }

      await refreshProfile();

      setConfirmationData({
        orderId: data.orderId,
        amount: data.amount,
        currency: data.currency,
        deviceId: data.deviceId,
        customerEmail: data.customerEmail,
      });

      setIsVerifying(false);
      setStep('success');
    } catch (err: any) {
      console.error('Verification error:', err);
      setIsVerifying(false);
      setPaymentError(err.message || 'We could not verify your payment signature. Please contact support.');
      setStep('failed');
    }
  };

  // Auto Login & Navigate to App Dashboard
  const handleAutoLogin = async () => {
    if (!confirmationData) return;
    setIsLoggingIn(true);
    try {
      const email = confirmationData.customerEmail;
      const pwd = formData.password;
      await signIn(email, pwd);
      onClose();
      navigate('/app');
    } catch (err) {
      // Fallback navigate to login if auto login fails
      onClose();
      navigate('/login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const copyText = (text: string, type: 'device' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'device') {
      setCopiedDeviceId(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
    } else if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8 transition-all">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">AquaNova Kit Checkout</h3>
              <p className="text-xs text-slate-400">Official Smart Aquaculture Hardware Purchase</p>
            </div>
          </div>
          {step !== 'processing' && (
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Step Indicator */}
        {step !== 'success' && (
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200/60 flex items-center justify-between text-xs font-medium text-slate-500">
            <span className={step === 'form' ? 'text-blue-600 font-bold' : ''}>1. Shipping & Account Details</span>
            <ChevronDivider />
            <span className={step === 'summary' ? 'text-blue-600 font-bold' : ''}>2. Review Order</span>
            <ChevronDivider />
            <span className={step === 'processing' ? 'text-blue-600 font-bold' : ''}>3. Payment</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
          {/* STEP 1: FORM */}
          {step === 'form' && (
            <form onSubmit={handleFormNext} className="space-y-6">
              {/* Customer Details */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4 flex items-center gap-2">
                  <User className="h-4 w-4" /> Customer & Account Setup
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Kumar"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      onBlur={() => handleBlur('fullName')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.fullName ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      placeholder="e.g. rajesh@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      onBlur={() => handleBlur('email')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.email ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Will become your permanent login ID.</p>
                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Account Password *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Min 6 characters"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        onBlur={() => handleBlur('password')}
                        className={`w-full rounded-xl border px-3.5 py-2 pr-10 text-sm focus:outline-none focus:ring-2 ${
                          errors.password ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Password used to log in after purchase.</p>
                    {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number (India) *</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      onBlur={() => handleBlur('phone')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.phone ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* Tank / Farm Details */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4 flex items-center gap-2">
                  <Box className="h-4 w-4" /> Tank / Farm Profile
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tank Name / Device Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Main Nursery Tank or Tank Alpha"
                      value={formData.tankName}
                      onChange={(e) => handleInputChange('tankName', e.target.value)}
                      onBlur={() => handleBlur('tankName')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.tankName ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      This tank name will be set as your official IoT device name in your dashboard.
                    </p>
                    {errors.tankName && <p className="mt-1 text-xs text-red-500">{errors.tankName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tank Type *</label>
                    <select
                      value={formData.tankType}
                      onChange={(e) => handleInputChange('tankType', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {TANK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tank Location (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Sector 4, Greenhouse"
                      value={formData.tankLocation}
                      onChange={(e) => handleInputChange('tankLocation', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tank Capacity / Size *</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="1000"
                        value={formData.tankSize}
                        onChange={(e) => handleInputChange('tankSize', e.target.value)}
                        onBlur={() => handleBlur('tankSize')}
                        className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                          errors.tankSize ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                        }`}
                      />
                      <select
                        value={formData.tankUnit}
                        onChange={(e) => handleInputChange('tankUnit', e.target.value)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <option value="Liters">Liters</option>
                        <option value="Cubic Meters">m³</option>
                        <option value="Gallons">Gallons</option>
                      </select>
                    </div>
                    {errors.tankSize && <p className="mt-1 text-xs text-red-500">{errors.tankSize}</p>}
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-sm font-bold uppercase tracking-wider text-blue-600 mb-4 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Shipping Address
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Complete Address *</label>
                    <textarea
                      rows={2}
                      placeholder="Door No, Street Name, Landmark"
                      value={formData.shippingAddress}
                      onChange={(e) => handleInputChange('shippingAddress', e.target.value)}
                      onBlur={() => handleBlur('shippingAddress')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.shippingAddress ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    {errors.shippingAddress && <p className="mt-1 text-xs text-red-500">{errors.shippingAddress}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">City *</label>
                    <input
                      type="text"
                      placeholder="e.g. Kochi"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      onBlur={() => handleBlur('city')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.city ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                    <input
                      type="text"
                      placeholder="e.g. Kerala"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      onBlur={() => handleBlur('state')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.state ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">PIN Code (6 digits) *</label>
                    <input
                      type="text"
                      placeholder="e.g. 682001"
                      value={formData.pinCode}
                      onChange={(e) => handleInputChange('pinCode', e.target.value)}
                      onBlur={() => handleBlur('pinCode')}
                      className={`w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 ${
                        errors.pinCode ? 'border-red-400 focus:ring-red-200' : 'border-slate-200 focus:ring-blue-200'
                      }`}
                    />
                    {errors.pinCode && <p className="mt-1 text-xs text-red-500">{errors.pinCode}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      <option value="India">India</option>
                      <option value="International">International Shipping</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex items-center justify-end gap-3">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isFormValid} className="px-6">
                  Continue to Order Review
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: SUMMARY & REVIEW */}
          {step === 'summary' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-blue-50/70 border border-blue-200/70 p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img src="/kit-image.png" alt="Kit" className="h-16 w-16 rounded-xl object-cover border border-blue-200" />
                  <div>
                    <h4 className="font-bold text-slate-900">AquaNova Smart Aquaculture Kit</h4>
                    <p className="text-xs text-slate-600 mt-0.5">ESP32 + 6 Sensors + AI Camera + Auto Feeder</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-blue-600">{pricing.displayPrice}</span>
                  <p className="text-[10px] text-slate-400">({pricing.usdFormatted} USD approx)</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Customer & Account</h5>
                  <p className="font-semibold text-slate-900 text-sm">{formData.fullName}</p>
                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {formData.email}
                  </p>
                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                    <Lock className="h-3.5 w-3.5 text-slate-400" /> Password: ••••••••
                  </p>
                  <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> {formData.phone}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Device & Tank Profile</h5>
                  <p className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <span className="text-blue-600 font-bold">Device Name:</span> {formData.tankName}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Type: <span className="font-medium text-slate-800">{formData.tankType}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Capacity: <span className="font-medium text-slate-800">{formData.tankSize} {formData.tankUnit}</span>
                  </p>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-slate-200 p-4 bg-white">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Shipping Address</h5>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {formData.shippingAddress}, {formData.city}, {formData.state} - {formData.pinCode}, {formData.country}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <Button type="button" variant="secondary" onClick={() => setStep('form')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Edit Details
                </Button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    onClick={() => handleInitiatePayment(false)}
                    disabled={isLoadingOrder}
                    className="w-full sm:w-auto px-6 py-5 text-sm bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                  >
                    {isLoadingOrder ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating Order...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" /> Pay via Razorpay
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleInitiatePayment(true)}
                    disabled={isLoadingOrder}
                    className="w-full sm:w-auto px-4 py-5 text-xs bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1 text-cyan-400" /> Test Sandbox
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PROCESSING / LOADING */}
          {step === 'processing' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <h4 className="text-xl font-bold text-slate-900">Processing Payment & Creating Account...</h4>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Verifying transaction signature and registering your AquaNova login credentials...
              </p>
              {isVerifying && (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-full animate-pulse">
                  <ShieldCheck className="h-4 w-4" /> Provisioning account & assigning Device ID...
                </div>
              )}
            </div>
          )}

          {/* STEP 4: FAILURE / CANCELLED */}
          {step === 'failed' && (
            <div className="py-8 text-center space-y-5">
              <div className="h-16 w-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto border border-red-200">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h4 className="text-2xl font-bold text-slate-900">Payment Notice</h4>
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-xl p-3.5 max-w-md mx-auto leading-relaxed">
                {paymentError || 'Razorpay requires registered API Keys in .env.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <Button variant="secondary" onClick={() => setStep('summary')}>
                  Back to Summary
                </Button>
                <Button onClick={() => simulatePayment()} className="px-6 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700">
                  <Zap className="h-4 w-4 mr-2 text-cyan-400 text-cyan-400" /> Complete Test Sandbox Payment
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS & PROVISIONED CREDENTIALS + DEVICE ID */}
          {step === 'success' && confirmationData && (
            <div className="space-y-6">
              <div className="text-center py-2">
                <div className="h-16 w-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 border border-emerald-200 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 font-semibold text-xs rounded-full mb-2">
                  Purchase Successful
                </span>
                <h3 className="text-3xl font-extrabold text-slate-900">Account Active</h3>
                <p className="text-sm text-slate-600 mt-1">Your AquaNova account is now active. You can log in and add your device.</p>
              </div>

              {/* Prominent Device ID Box */}
              <div className="bg-slate-900 rounded-2xl p-5 text-white text-center border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="h-32 w-32 text-cyan-400" />
                </div>
                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-1.5">
                  Assigned AquaNova Device ID
                </p>
                <div className="inline-flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-5 py-2.5 shadow-inner my-1">
                  <span className="text-2xl font-mono font-bold tracking-wider text-white">
                    {confirmationData.deviceId}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(confirmationData.deviceId, 'device')}
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
                  >
                    {copiedDeviceId ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-300" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy ID
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Device Name: <strong className="text-white">{formData.tankName}</strong> ({formData.tankType})
                </p>
              </div>

              {/* Secure account confirmation */}
              <div className="bg-blue-50/80 border border-blue-200/90 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-blue-600" /> Your AquaNova Account
                  </h4>
                  <span className="text-[10px] text-blue-600 font-semibold bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    Account Created
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="bg-white rounded-xl p-3 border border-blue-100 flex items-center justify-between sm:col-span-2">
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium uppercase">Login Email</p>
                      <p className="text-xs font-bold text-slate-900 truncate max-w-[160px]">
                        {confirmationData.customerEmail}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(confirmationData.customerEmail, 'email')}
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                      title="Copy Email"
                    >
                      {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 sm:col-span-2">Your password is never displayed or returned by the server. Use Forgot password to set a new password if needed.</p>
                </div>
              </div>

              {/* Single Button Auto Login & Launch Dashboard */}
              <div className="pt-2">
                <Button
                  onClick={handleAutoLogin}
                  disabled={isLoggingIn}
                  className="w-full py-6 text-base bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-xl shadow-blue-600/25"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Logging in & launching dashboard...
                    </>
                  ) : (
                    <>
                      🚀 Auto Login & Open Dashboard <ArrowRight className="h-5 w-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronDivider() {
  return <span className="text-slate-300">/</span>;
}
