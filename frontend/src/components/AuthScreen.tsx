import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registerUser, loginUser } from '../api/client';

interface AuthScreenProps {
  onAuth: (token: string, user: { id: string; name: string; email: string }) => void;
  onGuest: () => void;
}

export default function AuthScreen({ onAuth, onGuest }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isLight, setIsLight] = useState(document.documentElement.getAttribute('data-theme') === 'light');
  useEffect(() => {
    const check = () => setIsLight(document.documentElement.getAttribute('data-theme') === 'light');
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = mode === 'register'
        ? await registerUser(name, email, password)
        : await loginUser(email, password);

      // Save token
      localStorage.setItem('claimguard_token', data.access_token);
      localStorage.setItem('claimguard_user', JSON.stringify(data.user));
      onAuth(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const bgClass = isLight ? 'bg-[#f3f2ef]' : 'bg-[#050907]';
  const cardBg = isLight ? 'bg-white border-[#e0dfdc]' : 'bg-[#111311] border-[#222]';
  const inputBg = isLight ? 'bg-[#f3f2ef] border-[#e0dfdc] text-[#1a1a2e] placeholder:text-[#999]' : 'bg-[#1a1c1a] border-[#2a2c2a] text-white placeholder:text-[#555]';
  const textPrimary = isLight ? 'text-[#1a1a2e]' : 'text-white';
  const textMuted = isLight ? 'text-[#666]' : 'text-[#888]';

  return (
    <div className={`fixed inset-0 ${bgClass} flex items-center justify-center z-[9999] overflow-hidden`}>
      {/* Animated background gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #4ade80 0%, transparent 70%)', top: '-10%', right: '-10%' }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div 
          className="absolute w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #22c55e 0%, transparent 70%)', bottom: '-5%', left: '-5%' }}
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full max-w-[440px] mx-4 ${cardBg} border rounded-[28px] shadow-2xl overflow-hidden`}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-[#22c55e] via-[#4ade80] to-[#22c55e]" />

        <div className="p-8 pt-7">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <motion.div 
              className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center shadow-lg shadow-[#22c55e]/20"
              whileHover={{ scale: 1.05, rotate: 2 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
              </svg>
            </motion.div>
            <h1 className={`text-2xl font-bold ${textPrimary} tracking-tight`}>
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className={`mt-2 text-sm ${textMuted}`}>
              {mode === 'login' 
                ? 'Sign in to track your EDI parsing history' 
                : 'Join ClaimGuard to save your work'
              }
            </p>
          </div>

          {/* Tab Toggle */}
          <div className={`flex p-1 rounded-xl mb-6 ${isLight ? 'bg-[#f3f2ef]' : 'bg-[#1a1c1a]'}`}>
            {(['login', 'register'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(null); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === tab
                    ? 'bg-[#22c55e] text-white shadow-md shadow-[#22c55e]/20'
                    : `${textMuted} hover:text-[#22c55e]`
                }`}
              >
                {tab === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === 'register' && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <label className={`block text-xs font-semibold ${textMuted} mb-1.5 uppercase tracking-wider`}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className={`w-full px-4 py-3 rounded-xl border text-sm ${inputBg} focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 focus:border-[#22c55e]/60 transition`}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className={`block text-xs font-semibold ${textMuted} mb-1.5 uppercase tracking-wider`}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={`w-full px-4 py-3 rounded-xl border text-sm ${inputBg} focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 focus:border-[#22c55e]/60 transition`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold ${textMuted} mb-1.5 uppercase tracking-wider`}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className={`w-full px-4 py-3 rounded-xl border text-sm ${inputBg} focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 focus:border-[#22c55e]/60 transition`}
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white font-bold text-sm shadow-lg shadow-[#22c55e]/25 hover:shadow-[#22c55e]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <motion.div
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className={`flex-1 h-px ${isLight ? 'bg-[#e0dfdc]' : 'bg-[#2a2c2a]'}`} />
            <span className={`text-xs ${textMuted} font-medium`}>or</span>
            <div className={`flex-1 h-px ${isLight ? 'bg-[#e0dfdc]' : 'bg-[#2a2c2a]'}`} />
          </div>

          {/* Guest Button */}
          <motion.button
            onClick={onGuest}
            className={`w-full py-3 rounded-xl border text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
              isLight 
                ? 'border-[#e0dfdc] text-[#666] hover:bg-[#f3f2ef] hover:text-[#1a1a2e]' 
                : 'border-[#2a2c2a] text-[#888] hover:bg-[#1a1c1a] hover:text-white'
            }`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
            Continue as Guest
          </motion.button>

          <p className={`mt-5 text-center text-[11px] ${textMuted}`}>
            Guest users can use all features, but activity history won't be saved.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
