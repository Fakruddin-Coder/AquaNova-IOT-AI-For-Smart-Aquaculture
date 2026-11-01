import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { DeviceProvider } from '@/context/DeviceContext';
import { MqttProvider } from '@/context/MqttContext';
import LandingPage from '@/pages/LandingPage';
import { LoginPage, SignupPage, ForgotPasswordPage } from '@/pages/AuthPages';
import { OtpVerificationPage } from '@/pages/OtpVerificationPage';
import AppLayout from '@/pages/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import FeedingPage from '@/pages/FeedingPage';
import AiPage from '@/pages/AiPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import AlertsPage from '@/pages/AlertsPage';
import MonitoringPage from '@/pages/MonitoringPage';
import DevicesPage from '@/pages/DevicesPage';
import ReportsPage from '@/pages/ReportsPage';
import AssistantPage from '@/pages/AssistantPage';
import SettingsPage from '@/pages/SettingsPage';
import KitPage from '@/pages/KitPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import { Spinner } from '@/components/ui';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (user?.role === 'admin' || user?.email?.toLowerCase() === 'fakhruddinkhan7253@gmail.com') {
    return <Navigate to="/admin" replace />;
  }
  if (user?.kitPurchased === false) return <Navigate to="/kit" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, user } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <Spinner className="h-10 w-10 text-cyan-400" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  const isAdmin =
    user?.role === 'admin' ||
    user?.user_metadata?.role === 'admin' ||
    user?.email?.toLowerCase() === 'fakhruddinkhan7253@gmail.com';
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner className="h-10 w-10" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/kit" element={<KitPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-otp" element={<OtpVerificationPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Internal Operations Admin Panel */}
      <Route
        path="/admin/*"
        element={
          <AdminRoute>
            <AdminDashboardPage />
          </AdminRoute>
        }
      />

      {/* Customer Dashboard App */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <MqttProvider>
              <DeviceProvider>
                <AppLayout />
              </DeviceProvider>
            </MqttProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="feeding" element={<FeedingPage />} />
        <Route path="ai" element={<AiPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="monitoring" element={<MonitoringPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="assistant" element={<AssistantPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
