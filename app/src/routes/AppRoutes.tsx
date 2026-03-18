import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { ProjectsList } from '@/pages/projects/ProjectsList';
import { ProjectDetail } from '@/pages/projects/ProjectDetail';
import { TasksList } from '@/pages/tasks/TasksList';
import { LandingPage } from '@/pages/landing/LandingPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import TimesheetsPage from '@/pages/timesheets/Timesheets';
import { TaskDetail } from '@/pages/tasks/TaskDetail';

// ─── Protected Route ──────────────────────────────────────────────────────
// If not authenticated, redirects to /login (not landing)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// ─── Public Route ─────────────────────────────────────────────────────────
// If already authenticated, redirects to /dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* ── Public Routes ── */}

      {/* Landing — the entry point of the app */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />

      {/* Login / Register — blocked if already authenticated */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* ── Protected Routes (require authentication) ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard is the default sub-route */}
        <Route index element={<Dashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
      </Route>

      {/* Projects */}
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProjectsList />} />
        <Route path=":projectId" element={<ProjectDetail />} />
      </Route>

      {/* Tasks */}
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TasksList />} />
        <Route path=":taskId" element={<TaskDetail />} />
      </Route>

      {/* Other protected pages */}
      <Route
        path="/timesheets"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TimesheetsPage />} />
      </Route>

      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<div className="p-6 text-gray-500">Team page coming soon...</div>} />
      </Route>

      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<div className="p-6 text-gray-500">Calendar coming soon...</div>} />
      </Route>

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<div className="p-6 text-gray-500">Reports coming soon...</div>} />
      </Route>

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<div className="p-6 text-gray-500">Settings coming soon...</div>} />
        <Route path="profile" element={<div className="p-6 text-gray-500">Profile Settings coming soon...</div>} />
        <Route path="organization" element={<div className="p-6 text-gray-500">Organization Settings coming soon...</div>} />
        <Route path="notifications" element={<div className="p-6 text-gray-500">Notification Settings coming soon...</div>} />
      </Route>

      {/* Catch-all → back to landing */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
