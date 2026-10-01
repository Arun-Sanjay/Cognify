import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom'

import AppLayout from '../components/layout/AppLayout'
import ProtectedRoute from './ProtectedRoute'
import PublicOnlyRoute from './PublicOnlyRoute'

// Auth pages (no sidebar)
import LandingPage from '../pages/auth/LandingPage'
import LoginPage from '../pages/auth/LoginPage'
import SignupPage from '../pages/auth/SignupPage'

// Shared pages (rendered under every role's shell)
import HomePage from '../pages/shared/HomePage'
import AssistantPage from '../pages/shared/AssistantPage'
import LibraryPage from '../pages/shared/LibraryPage'
import LearnHomePage from '../pages/shared/learn/LearnHomePage'
import LearnUnitPage from '../pages/shared/learn/LearnUnitPage'
import QuizHomePage from '../pages/shared/learn/QuizHomePage'
import QuizAttemptPage from '../pages/shared/learn/QuizAttemptPage'

// Admin pages
import AdminDashboard from '../pages/admin/DashboardPage'
import UserManagementPage from '../pages/admin/UserManagementPage'
import NotificationStatusPage from '../pages/admin/NotificationStatusPage'

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* Landing is always public */}
      <Route path="/" element={<LandingPage />} />

      {/* Login/Signup — redirect to home if already authenticated */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
      </Route>

      {/* Student routes (login required, role: student) */}
      <Route element={<ProtectedRoute allowedRoles={['student']} />}>
        <Route path="student" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="learn" element={<LearnHomePage />} />
          <Route path="learn/:subjectId/:unitId" element={<LearnUnitPage />} />
          <Route path="learn/:subjectId/:unitId/:lectureId" element={<LearnUnitPage />} />
          <Route path="learn/:subjectId/:unitId/quiz" element={<QuizHomePage />} />
          <Route path="learn/:subjectId/:unitId/quiz/:attemptId" element={<QuizAttemptPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="library" element={<LibraryPage />} />
        </Route>
      </Route>

      {/* Teacher routes (login required, role: teacher) */}
      <Route element={<ProtectedRoute allowedRoles={['teacher']} />}>
        <Route path="teacher" element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="learn" element={<LearnHomePage />} />
          <Route path="learn/:subjectId/:unitId" element={<LearnUnitPage />} />
          <Route path="learn/:subjectId/:unitId/:lectureId" element={<LearnUnitPage />} />
          <Route path="learn/:subjectId/:unitId/quiz" element={<QuizHomePage />} />
          <Route path="learn/:subjectId/:unitId/quiz/:attemptId" element={<QuizAttemptPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="library" element={<LibraryPage />} />
        </Route>
      </Route>

      {/* Admin routes (login required, role: admin) */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="admin" element={<AppLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="learn" element={<LearnHomePage />} />
          <Route path="learn/:subjectId/:unitId" element={<LearnUnitPage />} />
          <Route path="learn/:subjectId/:unitId/:lectureId" element={<LearnUnitPage />} />
          <Route path="learn/:subjectId/:unitId/quiz" element={<QuizHomePage />} />
          <Route path="learn/:subjectId/:unitId/quiz/:attemptId" element={<QuizAttemptPage />} />
          <Route path="assistant" element={<AssistantPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="notifications" element={<NotificationStatusPage />} />
        </Route>
      </Route>
    </>,
  ),
)

export function AppRouter() {
  return <RouterProvider router={router} />
}
