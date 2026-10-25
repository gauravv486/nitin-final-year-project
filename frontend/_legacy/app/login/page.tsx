'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, UserCheck } from 'lucide-react';

type RoleKey = 'admin' | 'staff' | 'client';

interface RoleConfig {
  key: RoleKey;
  label: string;
  icon: string;
  color: string;
  email: string;
  password: string;
  name: string;
  caRole: string;
  avatar: string;
}

const ROLES: RoleConfig[] = [
  {
    key: 'admin',
    label: 'CA / Partner',
    icon: '💼',
    color: '#4D8BFF',
    email: 'admin@caos.in',
    password: 'Admin@2026',
    name: 'Rajesh Sharma',
    caRole: 'CA/Partner',
    avatar: 'RS',
  },
  {
    key: 'staff',
    label: 'Staff',
    icon: '👤',
    color: '#10B981',
    email: 'staff@caos.in',
    password: 'Staff@2026',
    name: 'Priya Mehta',
    caRole: 'Staff/Article',
    avatar: 'PM',
  },
  {
    key: 'client',
    label: 'Client',
    icon: '🏢',
    color: '#F59E0B',
    email: 'client@aroraco.com',
    password: 'Client@2026',
    name: 'Arora Trading Co.',
    caRole: 'Client',
    avatar: 'AT',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleKey>('admin');
  const [email, setEmail] = useState(ROLES[0].email);
  const [password, setPassword] = useState(ROLES[0].password);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  useEffect(() => {
    setMounted(true);
    
    // Load remember me info
    try {
      const savedEmail = localStorage.getItem('ca-os-remember-email');
      const savedRole = localStorage.getItem('ca-os-remember-role') as RoleKey;
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
        if (savedRole) {
          setSelectedRole(savedRole);
          const role = ROLES.find(r => r.key === savedRole);
          if (role) setPassword(role.password);
        }
      }
    } catch (e) {
      console.error('Failed to load remembered email:', e);
    }

    // If already logged in, redirect to dashboard
    try {
      const stored = localStorage.getItem('ca-os-user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user && user.id) {
          router.replace('/');
          return;
        }
      }
    } catch {
      localStorage.removeItem('ca-os-user');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock timer countdown
  useEffect(() => {
    if (!isLocked || lockTimer <= 0) {
      if (isLocked && lockTimer <= 0) {
        setIsLocked(false);
        setLoginAttempts(0);
      }
      return;
    }
    const t = setTimeout(() => setLockTimer(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [isLocked, lockTimer]);

  const activeRole = ROLES.find(r => r.key === selectedRole)!;

  const handleRoleSelect = (key: RoleKey) => {
    setSelectedRole(key);
    setError('');
    // Auto-fill with demo credentials on role change
    const role = ROLES.find(r => r.key === key)!;
    setEmail(role.email);
    setPassword(role.password);
  };

  const validateEmail = (val: string) => {
    if (!val.trim()) {
      setEmailError('Email is required.');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      setEmailError('Please enter a valid email address.');
    } else {
      setEmailError('');
    }
  };

  const validatePassword = (val: string) => {
    if (!val.trim()) {
      setPasswordError('Password is required.');
    } else if (val.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters.');
    } else {
      setPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || loading) return;

    setError('');
    
    const trimmedEmail = email.toLowerCase().trim();
    const trimmedPass = password.trim();

    // Perform validation
    let hasValidationError = false;
    if (!trimmedEmail) {
      setEmailError('Email is required.');
      hasValidationError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      hasValidationError = true;
    } else {
      setEmailError('');
    }

    if (!trimmedPass) {
      setPasswordError('Password is required.');
      hasValidationError = true;
    } else if (trimmedPass.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      hasValidationError = true;
    } else {
      setPasswordError('');
    }

    if (hasValidationError) {
      return;
    }

    setLoading(true);

    // Simulated auth delay
    await new Promise(resolve => setTimeout(resolve, 700));

    try {
      // Find matching role by credentials
      const matchedRole = ROLES.find(
        r => r.email.toLowerCase() === trimmedEmail && r.password === trimmedPass
      );

      // Also check if the selected role matches (allow flexible matching)
      if (!matchedRole) {
        const newAttempts = loginAttempts + 1;
        setLoginAttempts(newAttempts);
        if (newAttempts >= 3) {
          setIsLocked(true);
          setLockTimer(30);
          throw new Error('Too many failed attempts. Account locked for 30 seconds.');
        }
        throw new Error(`Invalid email or password. ${3 - newAttempts} attempt(s) remaining.`);
      }

      // Build user object with all required fields
      const userObj = {
        id: 'user-' + Date.now().toString(36),
        name: matchedRole.name,
        email: matchedRole.email,
        role: matchedRole.caRole,       // Used by some components
        caRole: matchedRole.caRole,     // Used by app-content.tsx for role detection
        avatar: matchedRole.avatar,
        loginTime: new Date().toISOString(),
      };

      if (rememberMe) {
        localStorage.setItem('ca-os-remember-email', trimmedEmail);
        localStorage.setItem('ca-os-remember-role', selectedRole);
      } else {
        localStorage.removeItem('ca-os-remember-email');
        localStorage.removeItem('ca-os-remember-role');
      }

      localStorage.setItem('ca-os-user', JSON.stringify(userObj));
      setLoginAttempts(0);

      // Use replace to avoid back-button going back to login
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      background: '#1C1E1F',
      color: '#fff',
    }}>
      {/* Left Branding Panel */}
      <div style={{
        flex: '0 0 44%',
        background: 'linear-gradient(135deg, #0F2240 0%, #142847 50%, #1A3F6D 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 52px',
        position: 'relative',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {/* Atmospheric glowing orbs */}
        <div style={{
          position: 'absolute', top: '-120px', left: '-120px',
          width: '480px', height: '480px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(77,139,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', right: '-80px',
          width: '360px', height: '360px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(77,139,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 2 }}>
          <div style={{
            width: '44px', height: '44px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>🧮</div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: '#fff', letterSpacing: '0.3px' }}>CA Assistant</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Practice Management</div>
          </div>
        </div>

        {/* Hero content */}
        <div style={{ maxWidth: '360px', position: 'relative', zIndex: 2 }}>
          <h1 style={{
            fontSize: '34px', fontWeight: '800',
            lineHeight: '1.2', marginBottom: '18px',
            color: '#fff', letterSpacing: '-0.5px',
          }}>
            Your complete CA practice, in one place.
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.72)', lineHeight: '1.65', marginBottom: '32px' }}>
            Manage clients, GST filings, ITR, compliance deadlines, and more — built for chartered accountants.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {[
              { label: 'GST & ITR', icon: '📄' },
              { label: 'Client Ledger', icon: '👥' },
              { label: 'Compliance', icon: '🔄' },
              { label: 'Reports', icon: '📊' },
            ].map((b, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 14px',
                background: 'rgba(255,255,255,0.07)',
                borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <span>{b.icon}</span> {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.4)', position: 'relative', zIndex: 2 }}>
          Trusted by 1,200+ CA firms across India
        </div>
      </div>

      {/* Right Login Panel */}
      <div style={{
        flex: 1, background: '#1C1E1F',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '48px 64px', position: 'relative',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '26px', fontWeight: '700', marginBottom: '6px', color: '#fff' }}>Sign in</h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '28px' }}>
            Select your role and enter credentials to continue
          </p>

          {/* Role Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
            {ROLES.map(role => (
              <button
                key={role.key}
                type="button"
                onClick={() => handleRoleSelect(role.key)}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '8px', padding: '16px 8px',
                  borderRadius: '10px',
                  border: selectedRole === role.key
                    ? `1.5px solid ${role.color}`
                    : '1.5px solid rgba(255,255,255,0.1)',
                  background: selectedRole === role.key
                    ? `rgba(${role.key === 'admin' ? '77,139,255' : role.key === 'staff' ? '16,185,129' : '245,158,11'},0.1)`
                    : 'rgba(255,255,255,0.03)',
                  color: selectedRole === role.key ? role.color : 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '22px' }}>{role.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: '700' }}>{role.label}</span>
              </button>
            ))}
          </div>

          {/* Demo credentials hint */}
          <div style={{
            background: 'rgba(77,139,255,0.08)',
            border: '1px solid rgba(77,139,255,0.2)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '20px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.6)',
          }}>
            <span style={{ fontWeight: '700', color: activeRole.color }}>Demo: </span>
            {activeRole.email} / {activeRole.password}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#FCA5A5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              fontWeight: '500',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Locked warning */}
          {isLocked && (
            <div style={{
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.4)',
              color: '#FCD34D',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              fontWeight: '500',
            }}>
              🔒 Locked. Try again in {lockTimer}s
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: '700',
                color: 'rgba(255,255,255,0.55)', marginBottom: '8px',
                letterSpacing: '0.6px', textTransform: 'uppercase',
              }}>
                Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail style={{
                  position: 'absolute', left: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)',
                }} />
                <input
                  type="text"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={e => validateEmail(e.target.value)}
                  placeholder={activeRole.email}
                  disabled={isLocked}
                  autoComplete="email"
                  style={{
                    width: '100%', padding: '12px 14px 12px 40px',
                    background: 'rgba(255,255,255,0.06)',
                    border: emailError ? '1.5px solid #FCA5A5' : '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', color: '#fff', fontSize: '14px',
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = emailError ? '#FCA5A5' : 'rgba(77,139,255,0.6)'}
                />
              </div>
              {emailError && (
                <div style={{ fontSize: '11.5px', color: '#FCA5A5', marginTop: '6px', fontWeight: '500' }}>
                  ⚠️ {emailError}
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: '11px', fontWeight: '700',
                color: 'rgba(255,255,255,0.55)', marginBottom: '8px',
                letterSpacing: '0.6px', textTransform: 'uppercase',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{
                  position: 'absolute', left: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px', height: '16px', color: 'rgba(255,255,255,0.3)',
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (passwordError) validatePassword(e.target.value);
                  }}
                  onBlur={e => validatePassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLocked}
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '12px 44px 12px 40px',
                    background: 'rgba(255,255,255,0.06)',
                    border: passwordError ? '1.5px solid #FCA5A5' : '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', color: '#fff', fontSize: '14px',
                    outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'inherit', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = passwordError ? '#FCA5A5' : 'rgba(77,139,255,0.6)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <div style={{ fontSize: '11.5px', color: '#FCA5A5', marginTop: '6px', fontWeight: '500' }}>
                  ⚠️ {passwordError}
                </div>
              )}
            </div>

            {/* Remember Me and Forgot Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{
                    width: '15px', height: '15px', borderRadius: '4px',
                    accentColor: '#2563EB', cursor: 'pointer',
                  }}
                />
                Remember Me
              </label>
              <a href="#forgot" style={{ fontSize: '13px', color: '#4D8BFF', textDecoration: 'none', fontWeight: '500' }}>
                Forgot Password?
              </a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading || isLocked}
              style={{
                width: '100%', padding: '13px 18px',
                background: loading || isLocked
                  ? 'rgba(77,139,255,0.3)'
                  : 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                border: 'none',
                borderRadius: '8px', color: '#fff',
                fontSize: '15px', fontWeight: '700',
                cursor: loading || isLocked ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                marginTop: '4px',
                boxShadow: loading || isLocked ? 'none' : '0 4px 16px rgba(37,99,235,0.35)',
              }}
              onMouseEnter={e => {
                if (!loading && !isLocked) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #1D4ED8 0%, #1E3A8A 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.45)';
                }
              }}
              onMouseLeave={e => {
                if (!loading && !isLocked) {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(37,99,235,0.35)';
                }
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{
                    display: 'inline-block', width: '15px', height: '15px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  Signing in...
                </span>
              ) : `Sign in as ${activeRole.label}`}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center',
            margin: '22px 0', color: 'rgba(255,255,255,0.25)', fontSize: '12px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ padding: '0 12px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Quick Demo Login */}
          <button
            type="button"
            onClick={() => {
              setEmail(activeRole.email);
              setPassword(activeRole.password);
              // Auto-submit after filling
              setTimeout(() => {
                const form = document.querySelector('form');
                form?.requestSubmit();
              }, 100);
            }}
            style={{
              width: '100%', padding: '12px 18px',
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              borderRadius: '8px', color: '#fff',
              fontSize: '13.5px', fontWeight: '600',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <span>⚡</span> Quick Demo Login ({activeRole.label})
          </button>

          <div style={{
            marginTop: '28px', textAlign: 'center',
            fontSize: '12px', color: 'rgba(255,255,255,0.35)',
          }}>
            New firm?{' '}
            <a href="#register" style={{ color: '#4D8BFF', textDecoration: 'none', fontWeight: '600' }}>
              Register your practice
            </a>
            {' · '}
            <a href="#privacy" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>
              Privacy policy
            </a>
          </div>
        </div>

        {/* Spin animation */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
