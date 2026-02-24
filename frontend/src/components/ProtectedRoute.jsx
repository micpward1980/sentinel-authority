import { styles } from "../config/styles";
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen" style={{background: styles.bgDeep, color: styles.textPrimary}}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'pending') return <Navigate to="/pending" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

export default ProtectedRoute;

