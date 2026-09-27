import '../marketing/landing.css'

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail,
  Lock,
  User as UserIcon,
  AtSign,
  GraduationCap,
  BookOpen,
  Shield,
  AlertCircle,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'

const USERNAME_RE = /^[a-z0-9][a-z0-9_.]{2,29}$/
import { clsx } from 'clsx'
import { authApi, ApiError } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import type { SignupRequest, UserRole } from '../../types'
import MarketingButton from '../marketing/components/MarketingButton'
import MarketingInput from '../marketing/components/MarketingInput'
import { Mark } from '../marketing/components/MarketingNav'

interface RoleOption {
  value: UserRole
  label: string
  icon: LucideIcon
}

const roles: RoleOption[] = [
  { value: 'student', label: 'Student', icon: GraduationCap },
  { value: 'teacher', label: 'Teacher', icon: BookOpen },
  { value: 'admin', label: 'Admin', icon: Shield },
]

const roleToHome: Record<UserRole, string> = {
  student: '/student',
  teacher: '/teacher',
  admin: '/admin',
}

interface FormState {
  name: string
  email: string
  username: string
  password: string
  role: UserRole | ''
  branch: string
  department_name: string
  designation: string
}

export default function SignupPage() {
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    username: '',
    password: '',
    role: '',
    branch: '',
    department_name: '',
    designation: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (!form.role) {
      setError('Please select your role')
      return
    }
    const username = form.username.trim().toLowerCase()
    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3-30 characters: lowercase letters, numbers, dot or underscore.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const payload: SignupRequest = {
        email: form.email.trim(),
        username,
        password: form.password,
        full_name: form.name.trim(),
        role: form.role,
      }
      if (form.role === 'student') {
        if (form.branch) payload.branch = form.branch
      } else if (form.role === 'teacher') {
        if (form.department_name) payload.department_name = form.department_name
        if (form.designation) payload.designation = form.designation
      }

      const response = await authApi.signup(payload)
      setSession({ user: response.user, token: response.access_token })
      navigate(roleToHome[response.user.role], { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        let detail: unknown = err.detail
        if (Array.isArray(detail)) {
          detail = (detail[0] as { msg?: string })?.msg || 'Invalid input'
        }
        setError(typeof detail === 'string' ? detail : 'Signup failed')
      } else {
        setError('Could not reach the server. Is the backend running?')
      }
    } finally {
      setLoading(false)
    }
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
              'radial-gradient(circle, rgba(34,211,238,0.4), transparent 60%)',
            top: '-120px',
            right: '-80px',
          }}
        />

        <div
          style={{
            width: '100%',
            maxWidth: 460,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: 'inherit',
              marginBottom: 28,
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

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1
              className="display"
              style={{
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                margin: '0 0 8px',
              }}
            >
              Create your <span className="gradient-text">account</span>
            </h1>
            <p
              style={{
                color: 'var(--landing-fg-muted)',
                fontSize: 14,
                margin: 0,
              }}
            >
              Join Cognify today
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="glass"
            style={{
              padding: 26,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
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
              label="Full name"
              icon={UserIcon}
              placeholder="Your full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              disabled={loading}
              autoComplete="name"
            />
            <MarketingInput
              label="Email"
              type="email"
              icon={Mail}
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              disabled={loading}
              autoComplete="email"
            />
            <MarketingInput
              label="Username"
              icon={AtSign}
              placeholder="your.handle — teachers use this to add you"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              disabled={loading}
              autoComplete="username"
            />
            <MarketingInput
              label="Password"
              type="password"
              icon={Lock}
              placeholder="Min 8 chars, letters + numbers"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              disabled={loading}
              autoComplete="new-password"
            />

            <div>
              <label className="lbl">I am a</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                }}
              >
                {roles.map((r) => {
                  const active = form.role === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setForm({ ...form, role: r.value })}
                      disabled={loading}
                      className={clsx(active && 'active')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        padding: '14px 10px',
                        borderRadius: 12,
                        border: active
                          ? '1px solid rgba(167,139,250,0.6)'
                          : '1px solid var(--landing-border)',
                        background: active
                          ? 'linear-gradient(180deg, rgba(139,92,246,0.18), rgba(34,211,238,0.06))'
                          : 'rgba(255,255,255,0.03)',
                        color: active
                          ? 'var(--landing-fg)'
                          : 'var(--landing-fg-muted)',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                        transition: 'all 0.2s ease',
                        font: 'inherit',
                        boxShadow: active
                          ? '0 0 24px rgba(139, 92, 246, 0.18)'
                          : 'none',
                      }}
                    >
                      <r.icon size={18} strokeWidth={2} />
                      <span style={{ fontSize: 12, fontWeight: 500 }}>
                        {r.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {form.role === 'student' && (
              <MarketingInput
                label="Branch"
                placeholder="CSE"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                disabled={loading}
              />
            )}
            {form.role === 'teacher' && (
              <>
                <MarketingInput
                  label="Department"
                  placeholder="Computer Science"
                  value={form.department_name}
                  onChange={(e) =>
                    setForm({ ...form, department_name: e.target.value })
                  }
                  disabled={loading}
                />
                <MarketingInput
                  label="Designation"
                  placeholder="Assistant Professor"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  disabled={loading}
                />
              </>
            )}

            <MarketingButton
              type="submit"
              loading={loading}
              size="lg"
              iconRight={ArrowRight}
              disabled={!form.role}
              style={{ marginTop: 6, justifyContent: 'center', width: '100%' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </MarketingButton>
          </form>

          <p
            style={{
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--landing-fg-muted)',
              marginTop: 20,
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: 'var(--landing-fg)',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
