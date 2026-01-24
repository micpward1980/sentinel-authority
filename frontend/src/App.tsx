import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { DashboardLayout } from './components/Layout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import AccountsPage from './pages/Accounts';
import {
  AccountDetailPage,
  SystemsPage,
  SystemDetailPage,
  CAT72Page,
  CAT72DetailPage,
  ConformanceRecordsPage,
  VerifyPage,
  SettingsPage,
} from './pages/index';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/verify/:recordNumber" element={<VerifyPage />} />
          
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
          <Route path="/accounts/:id" element={<ProtectedRoute><AccountDetailPage /></ProtectedRoute>} />
          <Route path="/systems" element={<ProtectedRoute><SystemsPage /></ProtectedRoute>} />
          <Route path="/systems/:id" element={<ProtectedRoute><SystemDetailPage /></ProtectedRoute>} />
          <Route path="/cat72" element={<ProtectedRoute><CAT72Page /></ProtectedRoute>} />
          <Route path="/cat72/:id" element={<ProtectedRoute><CAT72DetailPage /></ProtectedRoute>} />
          <Route path="/conformance" element={<ProtectedRoute><ConformanceRecordsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
