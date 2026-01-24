import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button, Input } from '../components/ui';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      // Error is handled by store
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center font-bold text-xl">
              S
            </div>
            <div className="text-left">
              <div className="font-bold text-xl">Sentinel Authority</div>
              <div className="text-xs text-gray-500 font-mono">ENVELO™ Certification Platform</div>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-[#12151c] border border-white/[0.08] rounded-xl p-8">
          <h1 className="text-2xl font-bold mb-2">Sign in</h1>
          <p className="text-gray-400 text-sm mb-6">
            Enter your credentials to access the platform
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
            
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/[0.08] text-center text-sm text-gray-500">
            Need an account?{' '}
            <a href="mailto:contact@sentinelauthority.org" className="text-indigo-400 hover:underline">
              Contact us
            </a>
          </div>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-6 text-center text-xs text-gray-600">
          Demo: Use any email with any password
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
