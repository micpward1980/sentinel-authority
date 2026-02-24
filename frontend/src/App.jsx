import React, { Suspense, lazy } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { DashboardSkeleton } from './components/LoadingSkeleton';

// Eager load — always needed
import LoginPage from './pages/LoginPage';

// Lazy load — only when navigated to
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.RoleBasedDashboard })));
const ApplicationsList = lazy(() => import('./pages/ApplicationsList'));
const NewApplication = lazy(() => import('./pages/NewApplication'));
const ApplicationDetail = lazy(() => import('./pages/ApplicationDetail'));
const CAT72Console = lazy(() => import('./pages/CAT72Console'));
const CertificatesPage = lazy(() => import('./pages/CertificatesPage'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const PendingPage = lazy(() => import('./pages/PendingPage'));
const ResourcesPage = lazy(() => import('./pages/ResourcesPage'));
const EnveloPage = lazy(() => import('./pages/EnveloPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const LicenseesPage = lazy(() => import('./pages/LicenseesPage'));
const ActivityPage = lazy(() => import('./pages/ActivityPage'));
const MyActivityPage = lazy(() => import('./pages/MyActivityPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

function LazyLoad({ children }) {
  return <Suspense fallback={<DashboardSkeleton />}>{children}</Suspense>;
}

function App() {
  return (
    <ErrorBoundary><ToastProvider><BrowserRouter><ConfirmProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<LazyLoad><ResetPasswordPage /></LazyLoad>} />
          <Route path="/verify" element={<LazyLoad><VerifyPage /></LazyLoad>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><LazyLoad><DashboardPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Layout><LazyLoad><ApplicationsList /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications/new" element={<ProtectedRoute><Layout><LazyLoad><NewApplication /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications/:id" element={<ProtectedRoute><Layout><LazyLoad><ApplicationDetail /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/cat72" element={<ProtectedRoute roles={['admin', 'operator', 'applicant']}><Layout><LazyLoad><CAT72Console /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/certificates" element={<ProtectedRoute><Layout><LazyLoad><CertificatesPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/pending" element={<LazyLoad><PendingPage /></LazyLoad>} />
          <Route path="/resources" element={<ProtectedRoute><Layout><LazyLoad><ResourcesPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/monitoring" element={<ProtectedRoute><Layout><LazyLoad><MonitoringPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/envelo" element={<ProtectedRoute><Layout><LazyLoad><EnveloPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><ActivityPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/my-activity" element={<ProtectedRoute><Layout><LazyLoad><MyActivityPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><LazyLoad><SettingsPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/api-docs" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><ApiDocsPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/licensees" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><LicenseesPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><UserManagementPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<LazyLoad><NotFoundPage /></LazyLoad>} />
        </Routes>
      </AuthProvider>
    </ConfirmProvider></BrowserRouter></ToastProvider></ErrorBoundary>
  );
}

export default App;
