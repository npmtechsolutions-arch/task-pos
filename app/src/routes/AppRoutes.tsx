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

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/landing" replace />;
  }

  return <>{children}</>;
}

// Public Route wrapper (redirects to dashboard if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/landing"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
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

      {/* Protected Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
        <Route path="projects" element={<ProjectsList />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="tasks" element={<TasksList />} />
        <Route path="tasks/:taskId" element={<div>Task Detail (Coming Soon)</div>} />
        <Route path="team" element={<div>Team (Coming Soon)</div>} />
        <Route path="calendar" element={<div>Calendar (Coming Soon)</div>} />
        <Route path="reports" element={<div>Reports (Coming Soon)</div>} />
        <Route path="settings" element={<div>Settings (Coming Soon)</div>} />
        <Route path="settings/profile" element={<div>Profile Settings (Coming Soon)</div>} />
        <Route path="settings/organization" element={<div>Organization Settings (Coming Soon)</div>} />
        <Route path="settings/notifications" element={<div>Notification Settings (Coming Soon)</div>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
