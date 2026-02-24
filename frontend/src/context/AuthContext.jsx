import React, { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../config/api';

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const [tempToken, setTempToken] = useState(null);

  const login = async (email, password, totp) => {
    if (totp && tempToken) {
      // Step 2: verify TOTP with temp token
      const res = await api.post('/api/auth/2fa/verify-login?temp_token=' + encodeURIComponent(tempToken), { code: totp });
      setTempToken(null);
      localStorage.setItem('token', res.data.access_token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      return res.data.user;
    }
    // Step 1: email + password
    const res = await api.post('/api/auth/login', { email, password });
    if (res.data.requires_2fa) {
      setTempToken(res.data.temp_token);
      const err = new Error('2FA required');
      err.response = { data: { detail: '2FA_REQUIRED' } };
      throw err;
    }
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data) => {
    const res = await api.post('/api/auth/register', data);
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    api.post('/api/auth/logout').catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthProvider };
export default AuthContext;

