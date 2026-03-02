import PreCAT72Review from './pages/PreCAT72Review';
import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Eager load — always needed
import LoginPage from './pages/LoginPage';

// Lazy load — only when navigated to
import { RoleBasedDashboard as DashboardPage } from './pages/DashboardPage';
import ApplicationsList from './pages/ApplicationsList';
import NewApplication from './pages/NewApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import CAT72Console from './pages/CAT72Console';
import CertificatesPage from './pages/CertificatesPage';
import VerifyPage from './pages/VerifyPage';
import PendingPage from './pages/PendingPage';
import ResourcesPage from './pages/ResourcesPage';
import EnveloPage from './pages/EnveloPage';
import SurveillancePage from './pages/SurveillancePage';
import UserManagementPage from './pages/UserManagementPage';
import ActivityPage from './pages/ActivityPage';
import MyActivityPage from './pages/MyActivityPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import ApiDocsPage from './pages/ApiDocsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

function LazyLoad({ children }) {
  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary><ToastProvider><BrowserRouter><ConfirmProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<LazyLoad><ResetPasswordPage /></LazyLoad>} />
          <Route path="/verify" element={<ProtectedRoute><Layout><LazyLoad><VerifyPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><LazyLoad><DashboardPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Layout><LazyLoad><ApplicationsList /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications/new" element={<ProtectedRoute><Layout><LazyLoad><NewApplication /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications/:id" element={<ProtectedRoute><Layout><LazyLoad><ApplicationDetail /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/applications/:id/pre-review" element={<PreCAT72Review />} />
        <Route path="/cat72" element={<ProtectedRoute><Layout><LazyLoad><CAT72Console /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/certificates" element={<ProtectedRoute><Layout><LazyLoad><CertificatesPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/pending" element={<LazyLoad><PendingPage /></LazyLoad>} />
          <Route path="/resources" element={<ProtectedRoute><Layout><LazyLoad><ResourcesPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/monitoring" element={<Navigate to="/surveillance" replace />} />
          <Route path="/envelo" element={<ProtectedRoute><Layout><LazyLoad><EnveloPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/surveillance" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><SurveillancePage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><ActivityPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/my-activity" element={<ProtectedRoute><Layout><LazyLoad><MyActivityPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><LazyLoad><SettingsPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/api-docs" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><ApiDocsPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/licensees" element={<Navigate to="/envelo" />} />
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Layout><LazyLoad><UserManagementPage /></LazyLoad></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<LazyLoad><NotFoundPage /></LazyLoad>} />
        </Routes>
      </AuthProvider>
    </ConfirmProvider></BrowserRouter></ToastProvider></ErrorBoundary>
  );
}

export default App;
