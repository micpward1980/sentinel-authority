import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import { RoleBasedDashboard } from './pages/DashboardPage';
import ApplicationsList from './pages/ApplicationsList';
import NewApplication from './pages/NewApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import CAT72Console from './pages/CAT72Console';
import CertificatesPage from './pages/CertificatesPage';
import VerifyPage from './pages/VerifyPage';
import PendingPage from './pages/PendingPage';
import ResourcesPage from './pages/ResourcesPage';
import EnveloPage from './pages/EnveloPage';
import MonitoringPage from './pages/MonitoringPage';
import UserManagementPage from './pages/UserManagementPage';
import ActivityPage from './pages/ActivityPage';
import MyActivityPage from './pages/MyActivityPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <ToastProvider><BrowserRouter><ConfirmProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><RoleBasedDashboard /></Layout></ProtectedRoute>} />
          <Route path="/applications" element={<ProtectedRoute><Layout><ApplicationsList /></Layout></ProtectedRoute>} />
          <Route path="/applications/new" element={<ProtectedRoute><Layout><NewApplication /></Layout></ProtectedRoute>} />
          <Route path="/applications/:id" element={<ProtectedRoute><Layout><ApplicationDetail /></Layout></ProtectedRoute>} />
          <Route path="/cat72" element={<ProtectedRoute roles={['admin', 'operator']}><Layout><CAT72Console /></Layout></ProtectedRoute>} />
          <Route path="/certificates" element={<ProtectedRoute><Layout><CertificatesPage /></Layout></ProtectedRoute>} />
          <Route path="/pending" element={<PendingPage />} />
          <Route path="/resources" element={<ProtectedRoute><Layout><ResourcesPage /></Layout></ProtectedRoute>} />
          <Route path="/envelo" element={<ProtectedRoute><Layout><EnveloPage /></Layout></ProtectedRoute>} />
          <Route path="/monitoring" element={<ProtectedRoute><Layout><MonitoringPage /></Layout></ProtectedRoute>} />
          <Route path="/activity" element={<ProtectedRoute roles={["admin"]}><Layout><ActivityPage /></Layout></ProtectedRoute>} />
          <Route path="/my-activity" element={<ProtectedRoute><Layout><MyActivityPage /></Layout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Layout><UserManagementPage /></Layout></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </ConfirmProvider></BrowserRouter></ToastProvider>
  );
}

export default App;

