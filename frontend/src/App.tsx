import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';

// Layout
import { DashboardLayout } from './components/Layout';

// Pages
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { AccountsPage } from './pages/Accounts';
import { AccountDetailPage } from './pages/AccountDetail';
import { SystemsPage } from './pages/Systems';
import { SystemDetailPage } from './pages/SystemDetail';
import { CAT72Page } from './pages/CAT72';
import { CAT72DetailPage } from './pages/CAT72Detail';
import { ConformanceRecordsPage } from './pages/ConformanceRecords';
import { VerifyPage } from './pages/Verify';
import { SettingsPage } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

// Protected route wrapper
function ProtectedRoute() {
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/verify/:recordNumber" element={<VerifyPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/systems" element={<SystemsPage />} />
            <Route path="/systems/:id" element={<SystemDetailPage />} />
            <Route path="/cat72" element={<CAT72Page />} />
            <Route path="/cat72/:id" element={<CAT72DetailPage />} />
            <Route path="/conformance" element={<ConformanceRecordsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
