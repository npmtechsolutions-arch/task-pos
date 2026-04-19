import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { Dashboard } from '@/pages/dashboard/Dashboard';
import { ProjectsList } from '@/pages/projects/ProjectsList';
import { ProjectDetail } from '@/pages/projects/ProjectDetail';
import { ProjectDetailsPage } from '@/pages/projects/ProjectDetailsPage';
import { TasksList } from '@/pages/tasks/TasksList';
import { LandingPage } from '@/pages/landing/LandingPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import TimesheetsPage from '@/pages/timesheets/Timesheets';
import { TaskDetail } from '@/pages/tasks/TaskDetail';
import { ActivityFeed } from '@/pages/activity/ActivityFeed';
// Employee Management Module
import { PeoplePage } from '@/pages/people/PeoplePage';
import { EmployeeProfile } from '@/pages/people/EmployeeProfile';
import { SkillMatrix } from '@/pages/people/SkillMatrix';
import { CapacityPlanning } from '@/pages/people/CapacityPlanning';
import '@/pages/people/people.css';
// Analytics & Reports Module
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { ReportBuilder } from '@/pages/reports/ReportBuilder';
import { ReportHistory } from '@/pages/reports/ReportHistory';
// Calendar
import { CalendarPage } from '@/pages/calendar/CalendarPage';
// Super Admin
import { SuperAdminPage } from '@/pages/admin/SuperAdminPage';
// HR
import { HRPage } from '@/pages/hr/HRPage';
// Kanban (standalone board)
import { KanbanPage } from '@/pages/kanban/KanbanPage';
// PRD Upload
import PRDUploadPage from '@/pages/documents/PRDUploadPage';
// Attendance
import AttendancePage from '@/pages/timesheets/AttendancePage';
// Chat
import ChatPage from '@/pages/chat/ChatPage';


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
        <Route path=":projectId/details" element={<ProjectDetailsPage />} />
      </Route>

      {/* Standalone Kanban Board */}
      <Route
        path="/kanban"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path=":projectId" element={<KanbanPage />} />
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
        path="/activity"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ActivityFeed />} />
      </Route>

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
        <Route index element={<Navigate to="/people" replace />} />
      </Route>

      {/* People / Employee Management */}
      <Route
        path="/people"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PeoplePage />} />
        <Route path=":userId" element={<EmployeeProfile />} />
        <Route path="skills" element={<SkillMatrix />} />
        <Route path="capacity" element={<CapacityPlanning />} />
      </Route>


      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<CalendarPage />} />
      </Route>

      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ReportsPage />} />
        <Route path="builder" element={<ReportBuilder />} />
        <Route path="history" element={<ReportHistory />} />
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

      {/* Super Admin */}
      <Route
        path="/admin/super"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<SuperAdminPage />} />
      </Route>

      {/* HR & Organisation */}
      <Route
        path="/hr"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HRPage />} />
      </Route>

      {/* PRD Upload */}
      <Route
        path="/prd-upload"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PRDUploadPage />} />
      </Route>

      {/* Attendance */}
      <Route
        path="/attendance"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AttendancePage />} />
      </Route>

      {/* Chat */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ChatPage />} />
      </Route>
    </Routes>
  );
}
