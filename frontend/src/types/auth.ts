/**
 * Auth types — mirror backend Pydantic schemas in backend/app/schemas/auth.py
 */

export type UserRole = 'student' | 'teacher' | 'admin'

export interface StudentProfile {
  branch: string | null
}

export interface TeacherProfile {
  department_name: string | null
  designation: string | null
}

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  last_login: string | null
  created_at: string
  student_profile: StudentProfile | null
  teacher_profile: TeacherProfile | null
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in_seconds: number
  user: User
}

export interface LoginRequest {
  identifier: string // email OR username
  password: string
}

export interface SignupRequest {
  email: string
  username: string
  password: string
  full_name: string
  role: UserRole
  // Student-specific
  branch?: string
  // Teacher-specific
  department_name?: string
  designation?: string
}

// ── Admin user management — mirrors backend/app/schemas/admin.py ──

export interface AdminUserRow {
  id: string
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  branch: string | null
  department: string | null
  last_login: string | null
  created_at: string
}

export interface AdminUserListResponse {
  total: number
  items: AdminUserRow[]
}

export interface AdminUserUpdate {
  is_active?: boolean
  role?: UserRole
}

export interface AdminStatsResponse {
  total_users: number
  students: number
  teachers: number
  admins: number
  documents: number
  ready_documents: number
  chat_sessions: number
}
