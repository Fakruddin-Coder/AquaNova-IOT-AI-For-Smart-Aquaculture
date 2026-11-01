const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'aquanova_token';

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

const getHeaders = (isJson = true) => {
  const headers: Record<string, string> = {};
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  requiresVerification?: boolean;
  email?: string;
  message?: string;
  cooldownRemaining?: number;
  token?: string;
  user?: any;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<any> {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        error: json.error || `Request failed with status ${res.status}`,
        status: res.status,
        requiresVerification: json.requiresVerification || false,
        email: json.email,
        code: json.code,
        cooldownRemaining: json.cooldownRemaining,
      };
    }

    return json;
  } catch (err) {
    console.warn(`[API Call Warning] ${endpoint}:`, (err as Error).message);
    return { error: (err as Error).message || 'Network error' };
  }
}

export const api = {
  // Auth
  async register(data: { name?: string; email: string; password: string; phone?: string }) {
    return apiFetch<{ message: string; requiresVerification: boolean; email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyOTP(data: { email: string; otp: string }) {
    const res = await apiFetch<{ token: string; user: any; message: string }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res?.token) {
      setToken(res.token);
    }
    return res;
  },

  async resendOTP(data: { email: string }) {
    return apiFetch<{ message: string; email: string; cooldownRemaining?: number }>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: { email: string; password: string }) {
    const res = await apiFetch<{ token: string; user: any; requiresVerification?: boolean; email?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res?.token) {
      setToken(res.token);
    }
    return res;
  },

  async forgotPassword(data: { email: string }) {
    return apiFetch<{ message: string; devOtp?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resetPasswordWithOtp(data: { email: string; otp: string; newPassword: string }) {
    return apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMe() {
    return apiFetch<{ id: string; name: string; email: string; role?: string; phone?: string; address?: string; avatarUrl?: string; tankDetails?: any; isVerified?: boolean; createdAt?: string; kitPurchased?: boolean }>('/auth/me');
  },

  async updateProfile(data: { name?: string; phone?: string; address?: string; tankDetails?: any }) {
    return apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async uploadProfilePhoto(image: string) {
    return apiFetch<{ message: string; avatarUrl: string }>('/auth/profile/photo', {
      method: 'POST',
      body: JSON.stringify({ image }),
    });
  },

  async removeProfilePhoto() {
    return apiFetch<{ message: string; avatarUrl: null }>('/auth/profile/photo', {
      method: 'DELETE',
    });
  },

  async changePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    return apiFetch<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async changeEmailRequest(data: { newEmail: string; currentPassword: string }) {
    return apiFetch<{ message: string; pendingEmail: string }>('/auth/change-email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyEmailChangeOTP(data: { otp: string }) {
    return apiFetch<{ message: string; newEmail: string }>('/auth/verify-email-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Notifications & System Settings
  async getNotificationPreferences() {
    return apiFetch<{ emailAlerts: boolean; criticalOnly: boolean; dailySummary: boolean; feedingReminders: boolean }>('/notifications/preferences');
  },

  async updateNotificationPreferences(data: { emailAlerts?: boolean; criticalOnly?: boolean; dailySummary?: boolean; feedingReminders?: boolean }) {
    return apiFetch<{ message: string; preferences: any }>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async get2FAStatus() {
    return apiFetch<{ enabled: boolean }>('/auth/2fa/status');
  },

  async setup2FA() {
    return apiFetch<{ secret: string; otpauthUrl: string; verificationCode: string; message: string }>('/auth/2fa/setup', {
      method: 'POST',
    });
  },

  async verify2FA(code: string) {
    return apiFetch<{ message: string; enabled: boolean }>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async disable2FA(password?: string) {
    return apiFetch<{ message: string; enabled: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  async getSystemInfo() {
    return apiFetch<{ plan: string; deviceCount: number; deviceLimit: number; dataRetention: string; apiAccess: string; accountId: string }>('/system/info');
  },

  logout() {
    setToken(null);
  },

  // Assistant
  async chatWithAssistant(data: { deviceId?: string; message: string }) {
    return apiFetch<{ reply: string; deviceId: string; timestamp: string }>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Devices
  async getDevices() {
    const res = await apiFetch<any[]>('/devices');
    return Array.isArray(res) ? res : [];
  },

  async createDevice(data: { deviceId: string; deviceName: string }) {
    return apiFetch('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteDevice(deviceId: string) {
    return apiFetch(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  },

  // Sensors
  async postSensorReading(data: { deviceId: string; temperature: number; ph: number; waterLevel: number; otherSensorValues?: any }) {
    return apiFetch('/sensors/readings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getLatestSensorReading(deviceId: string) {
    return apiFetch<any>(`/sensors/${deviceId}/latest`);
  },

  async getSensorHistory(deviceId: string, limit = 100) {
    const res = await apiFetch<any[]>(`/sensors/${deviceId}/history?limit=${limit}`);
    return Array.isArray(res) ? res : [];
  },

  // Feeding
  async getFeeding(deviceId: string) {
    const res = await apiFetch<{ schedules: any[]; history: any[] }>(`/feeding/${deviceId}`);
    return res || { schedules: [], history: [] };
  },

  async createFeeding(data: {
    deviceId: string;
    scheduledTime: string;
    feedAmount: number;
    status?: string;
    triggerType?: string;
    enabled?: boolean;
    frequency?: 'once' | 'daily' | 'custom';
    customDays?: number[];
  }) {
    return apiFetch('/feeding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateFeeding(
    id: string,
    data: {
      scheduledTime?: string;
      feedAmount?: number;
      status?: string;
      enabled?: boolean;
      frequency?: 'once' | 'daily' | 'custom';
      customDays?: number[];
    }
  ) {
    return apiFetch(`/feeding/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async clearFeedingHistory(deviceId: string) {
    return apiFetch(`/feeding/${deviceId}/history`, {
      method: 'DELETE',
    });
  },

  async deleteFeeding(id: string) {
    return apiFetch(`/feeding/${id}`, {
      method: 'DELETE',
    });
  },

  // Alerts
  async getAlerts(deviceId: string) {
    const res = await apiFetch<any[]>(`/alerts/${deviceId}`);
    return Array.isArray(res) ? res : [];
  },

  async createAlert(data: { deviceId: string; type?: string; severity?: string; message: string }) {
    return apiFetch('/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async resolveAlert(id: string) {
    return apiFetch(`/alerts/${id}/resolve`, {
      method: 'PUT',
    });
  },

  // Dashboard Aggregated Endpoint
  async getDashboard(deviceId: string) {
    return apiFetch<any>(`/dashboard/${deviceId}`);
  },
};
