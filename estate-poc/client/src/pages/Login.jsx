import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      toast.success(`Welcome back, ${u.name}!`);
    } catch {
      // Error handled by api interceptor
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 30% 40%, rgba(15, 76, 53, 0.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(15, 76, 53, 0.15) 0%, transparent 50%)' }}>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-estate-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-estate-900/50">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-display font-bold text-slate-100">GreenVille Estate</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="label">Email Address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-500" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input pl-9" placeholder="your@email.com" autoComplete="email" />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-3 text-slate-500" />
              <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="input pl-9 pr-9" placeholder="••••••••" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="btn-primary w-full justify-center py-2.5 text-base">
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Logins */}
        <div className="mt-4 card p-4">
          <p className="text-xs text-slate-500 mb-3 text-center uppercase tracking-wider font-medium">Quick Demo Login</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Admin', e: 'admin@estate.com', p: 'Admin@123' },
              { label: 'Guard', e: 'guard@estate.com', p: 'Guard@123' },
              { label: 'Resident', e: 'chidi@email.com', p: 'Resident@123' },
              { label: 'Finance', e: 'finance@estate.com', p: 'Finance@123' },
              { label: 'Security', e: 'security@estate.com', p: 'Security@123' },
              { label: 'Maintenance', e: 'maintenance@estate.com', p: 'Maint@123' },
            ].map(({ label, e, p }) => (
              <button key={label} type="button" onClick={() => quickLogin(e, p)}
                className="btn-ghost text-xs justify-center py-1.5 border border-slate-800">
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
