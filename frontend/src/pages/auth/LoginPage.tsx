import '../marketing/landing.css'

import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Lock,
  Shield,
  type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import { authApi, ApiError } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import type { UserRole } from '../../types'
import MarketingButton from '../marketing/components/MarketingButton'
import MarketingInput from '../marketing/components/MarketingInput'
import { Mark } from '../marketing/components/MarketingNav'

interface RoleOption {
  value: UserRole
  label: string
  icon: LucideIcon
  description: string
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'student',
    label: 'Student',
    icon: GraduationCap,
    description: 'Learn with an AI tutor grounded in your material.',
  },
  {
    value: 'teacher',
    label: 'Teacher',
    icon: BookOpen,
    description: 'Curate study material and guide learners.',
  },
  {
    value: 'admin',
    label: 'Admin',
    icon: Shield,
    description: 'Manage the platform and its users.',
  },
]

const ROLE_TO_HOME: Record<UserRole, string> = {
  student: '/student',
  teacher: '/teacher',
  admin: '/admin',
}

interface LocationState {
  from?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuthStore((s) => s.setSession)

  const [pickedRole, setPickedRole] = useState<UserRole | null>(null)
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const stage: 'role' | 'credentials' = pickedRole ? 'credentials' : 'role'

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!pickedRole) return
    setError(null)
    setLoading(true)
    try {
      const response = await authApi.login(form.identifier.trim(), form.password)
      if (response.user.role !== pickedRole) {
        setError(
          `This account is registered as a ${response.user.role}, not a ${pickedRole}.` +
            ` Go back and pick the ${response.user.role} portal.`,
        )
        setLoading(false)
        return
      }
      setSession({ user: response.user, token: response.access_token })
      const state = location.state as LocationState | null
      const redirectTo =
        state?.from || ROLE_TO_HOME[response.user.role] || '/student'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : 'Login failed')
      } else {
        setError('Could not reach the server. Is the backend running?')
      }
    } finally {
      setLoading(false)
    }
  }

  const goBackToRoles = () => {
    setPickedRole(null)
    setError(null)
    setForm({ identifier: '', password: '' })
  }

  return (
    <div className="landing-theme">
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 20px',
          position: 'relative',
        }}
      >
        <span
          aria-hidden
          className="halo"
          style={{
            width: 460,
            height: 460,
            background:
              'radial-gradient(circle, rgba(139,92,246,0.45), transparent 60%)',
            top: '-120px',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        />

        <div style={{ width: '100%', maxWidth: 720, position: 'relative', zIndex: 1 }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: 'inherit',
              marginBottom: 32,
            }}
          >
            <Mark size={28} />
            <span
              className="display"
              style={{ fontSize: 18, fontWeight: 600 }}
            >
              Cognify
            </span>
          </Link>

          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1
              className="display"
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                margin: '0 0 10px',
              }}
            >
              {stage === 'role' ? (
                <>
                  Welcome to <span className="gradient-text">Cognify</span>
                </>
              ) : (
                'Welcome back'
              )}
            </h1>
            <p
              style={{
                color: 'var(--landing-fg-muted)',
                fontSize: 14,
                margin: 0,
              }}
            >
              {stage === 'role'
                ? 'Choose your portal to continue'
                : `Signing in as ${pickedRole}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {stage === 'role' ? (
              <motion.div
                key="role"
                initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                {ROLE_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPickedRole(opt.value)}
                      className="glass glow-border"
                      style={{
                        padding: 20,
                        textAlign: 'left',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'inherit',
                        font: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                        transition: 'transform 0.25s ease',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div className="tile-icon">
                          <Icon size={20} strokeWidth={2} />
                        </div>
                        <ChevronRight
                          size={16}
                          style={{ color: 'var(--landing-fg-faint)' }}
                        />
                      </div>
                      <div>
                        <div
                          className="display"
                          style={{
                            fontSize: 17,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}
                        >
                          {opt.label}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--landing-fg-muted)',
                            lineHeight: 1.5,
                          }}
                        >
                          {opt.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </motion.div>
            ) : (
              <motion.form
                key="credentials"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="glass"
                style={{
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  maxWidth: 420,
                  margin: '0 auto',
                }}
              >
                <button
                  type="button"
                  onClick={goBackToRoles}
                  className="btn btn-ghost"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '6px 10px',
                    fontSize: 12,
                  }}
                >
                  <ArrowLeft size={14} strokeWidth={2.25} />
                  Change portal
                </button>

                {error && (
                  <div
                    role="alert"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: 12,
                      borderRadius: 10,
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#FCA5A5',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{error}</span>
                  </div>
                )}

                <MarketingInput
                  label="Email or username"
                  type="text"
                  icon={AtSign}
                  placeholder="you@example.com or your.handle"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
                <MarketingInput
                  label="Password"
                  type="password"
                  icon={Lock}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                />
                <MarketingButton
                  type="submit"
                  loading={loading}
                  size="lg"
                  iconRight={ArrowRight}
                  className={clsx(loading && 'mb-loading')}
                  style={{ marginTop: 4, justifyContent: 'center', width: '100%' }}
                >
                  {loading ? 'Signing in…' : `Sign in as ${pickedRole}`}
                </MarketingButton>
              </motion.form>
            )}
          </AnimatePresence>

          <p
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--landing-fg-muted)',
              marginTop: 24,
            }}
          >
            Don&apos;t have an account?{' '}
            <Link
              to="/signup"
              style={{
                color: 'var(--landing-fg)',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
