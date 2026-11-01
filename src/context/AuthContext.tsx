import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken } from '@/services/api';
import type { Profile } from '@/types';

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'customer' | 'admin' | string;
  phone?: string;
  address?: string;
  avatar_url?: string | null;
  isVerified?: boolean;
  user_metadata?: { full_name?: string; role?: string };
  created_at?: string;
  kitPurchased?: boolean;
}

interface AuthContextValue {
  session: { access_token: string } | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; requiresVerification?: boolean; email?: string; user?: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; requiresVerification?: boolean; email?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ error: string | null; user?: User }>;
  resendOTP: (email: string) => Promise<{ error: string | null; cooldownRemaining?: number }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null; message?: string }>;
  resetPasswordWithOtp: (email: string, otp: string, newPassword: string) => Promise<{ error: string | null; message?: string }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const session = token ? { access_token: token } : null;

  const loadUser = async () => {
    const existingToken = getToken();
    if (!existingToken) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const userData = await api.getMe();
    if (userData && userData.id) {
      const userRole = (userData as any).role || (userData.email?.toLowerCase() === 'fakhruddinkhan7253@gmail.com' ? 'admin' : 'customer');
      const u: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userRole,
        phone: userData.phone,
        address: userData.address,
        avatar_url: userData.avatarUrl || null,
        isVerified: userData.isVerified ?? true,
        user_metadata: {
          full_name: userData.name,
          role: userRole,
        },
        created_at: userData.createdAt || new Date().toISOString(),
        kitPurchased: userData.kitPurchased,
      };
      setUser(u);
      setProfile({
        id: userData.id,
        full_name: userData.name || userData.email.split('@')[0],
        avatar_url: userData.avatarUrl || null,
        created_at: userData.createdAt || new Date().toISOString(),
      });
    } else {
      // Clear invalid or expired tokens cleanly
      setToken(null);
      setUser(null);
      setProfile(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, []);

  const refreshProfile = async () => {
    await loadUser();
  };

  const signIn = async (email: string, password: string) => {
    if (!email || !password) {
      return { error: 'Please enter both email and password.' };
    }

    const res = await api.login({ email, password });

    if (res.requiresVerification) {
      return {
        error: res.error || 'Email verification required',
        requiresVerification: true,
        email: res.email || email,
      };
    }

    if (res.error) {
      return { error: res.error };
    }

    if (res && res.user) {
      const userRole = res.user.role || (res.user.email?.toLowerCase() === 'fakhruddinkhan7253@gmail.com' ? 'admin' : 'customer');
      const u: User = {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        role: userRole,
        phone: res.user.phone,
        isVerified: res.user.isVerified ?? true,
        kitPurchased: res.user.kitPurchased,
        user_metadata: {
          full_name: res.user.name,
          role: userRole,
        },
      };
      setUser(u);
      setProfile({
        id: res.user.id,
        full_name: res.user.name || email.split('@')[0],
        avatar_url: null,
        created_at: new Date().toISOString(),
      });
      return { error: null, user: u };
    }

    return { error: 'Failed to sign in. Please check your credentials.' };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!email || !password) {
      return { error: 'Please enter all required fields.' };
    }

    const res = await api.register({ email, password, name: fullName });

    if (res.error) {
      return { error: res.error };
    }

    if (res.requiresVerification) {
      return {
        error: null,
        requiresVerification: true,
        email: res.email || email,
      };
    }

    return { error: null };
  };

  const verifyOTP = async (email: string, otp: string) => {
    const res = await api.verifyOTP({ email, otp });

    if (res.error) {
      return { error: res.error };
    }

    if (res.user && res.token) {
      const userRole = res.user.role || (res.user.email?.toLowerCase() === 'fakhruddinkhan7253@gmail.com' ? 'admin' : 'customer');
      const u: User = {
        id: res.user.id,
        email: res.user.email,
        name: res.user.name,
        role: userRole,
        phone: res.user.phone,
        isVerified: true,
        kitPurchased: res.user.kitPurchased,
        user_metadata: {
          full_name: res.user.name,
          role: userRole,
        },
      };
      setUser(u);
      setProfile({
        id: res.user.id,
        full_name: res.user.name || email.split('@')[0],
        avatar_url: null,
        created_at: new Date().toISOString(),
      });
      return { error: null, user: u };
    }

    return { error: 'Verification failed. Please try again.' };
  };

  const resendOTP = async (email: string) => {
    const res = await api.resendOTP({ email });
    if (res.error) {
      return { error: res.error, cooldownRemaining: res.cooldownRemaining };
    }
    return { error: null };
  };

  const signOut = async () => {
    api.logout();
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const res = await api.forgotPassword({ email });
    if (res.error) return { error: res.error };
    return { error: null, message: res.message };
  };

  const resetPasswordWithOtp = async (email: string, otp: string, newPassword: string) => {
    const res = await api.resetPasswordWithOtp({ email, otp, newPassword });
    if (res.error) return { error: res.error };
    return { error: null, message: res.message };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        verifyOTP,
        resendOTP,
        signOut,
        resetPassword,
        resetPasswordWithOtp,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
