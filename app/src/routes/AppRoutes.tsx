/**
 * AppRoutes.tsx — ALL heavy pages are lazy-loaded.
 * Only Login, Register, and Landing ship in the initial JS bundle.
 * Every other page is code-split and loaded on first navigation.
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { AppLayout } from '@/components/layout/AppLayout';
import { Login } from '@/pages/auth/Login';
import { Register } from '@/pages/auth/Register';
import { LandingPage } from '@/pages/landing/LandingPage';

// ─── Skeleton fallback shown while lazy chunks load ──────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-gray-200" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-gray-100" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-gray-100" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

// ─── Lazy page imports ────────────────────────────────────────────────────────
const Dashboard       = lazy(() => import('@/pages/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const ProjectsList    = lazy(() => import('@/pages/projects/ProjectsList').then(m => ({ default: m.ProjectsList })));
const ProjectDetail   = lazy(() => import('@/pages/projects/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const ProjectDetailsPage = lazy(() => import('@/pages/projects/ProjectDetailsPage').then(m => ({ default: m.ProjectDetailsPage })));
const TasksList       = lazy(() => import('@/pages/tasks/TasksList').then(m => ({ default: m.TasksList })));
const TaskDetail      = lazy(() => import('@/pages/tasks/TaskDetail').then(m => ({ default: m.TaskDetail })));
const AdminDashboard  = lazy(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SuperAdminPage  = lazy(() => import('@/pages/admin/SuperAdminPage').then(m => ({ default: m.SuperAdminPage })));
const TimesheetsPage  = lazy(() => import('@/pages/timesheets/Timesheets'));
const AttendancePage  = lazy(() => import('@/pages/timesheets/AttendancePage'));
const ActivityFeed    = lazy(() => import('@/pages/activity/ActivityFeed').then(m => ({ default: m.ActivityFeed })));
const PeoplePage      = lazy(() => import('@/pages/people/PeoplePage').then(m => ({ default: m.PeoplePage })));
const EmployeeProfile = lazy(() => import('@/pages/people/EmployeeProfile').then(m => ({ default: m.EmployeeProfile })));
const SkillMatrix     = lazy(() => import('@/pages/people/SkillMatrix').then(m => ({ default: m.SkillMatrix })));
const CapacityPlanning = lazy(() => import('@/pages/people/CapacityPlanning').then(m => ({ default: m.CapacityPlanning })));
const ReportsPage     = lazy(() => import('@/pages/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const CalendarPage    = lazy(() => import('@/pages/calendar/CalendarPage').then(m => ({ default: m.CalendarPage })));
const HRPage          = lazy(() => import('@/pages/hr/HRPage').then(m => ({ default: m.HRPage })));
const KanbanPage      = lazy(() => import('@/pages/kanban/KanbanPage').then(m => ({ default: m.KanbanPage })));
const ChatPage        = lazy(() => import('@/pages/chat/ChatPage'));
const SettingsPage    = lazy(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const HrApprovalPage  = lazy(() => import('@/pages/hr/HrApprovalPage').then(m => ({ default: m.HrApprovalPage })));

// ─── Guards ──────────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// ─── Route helper: wraps a lazy page in Suspense automatically ───────────────
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

// ─── Protected layout wrapper ────────────────────────────────────────────────
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/"        element={<LandingPage />} />
      <Route path="/landing" element={<LandingPage />} />

      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* ── Dashboard ──────────────────────────────────────────────────── */}
      <Route path="/dashboard" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><Dashboard /></Lazy>} />
        <Route path="admin" element={<Lazy><AdminDashboard /></Lazy>} />
      </Route>

      {/* ── Projects ───────────────────────────────────────────────────── */}
      <Route path="/projects" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><ProjectsList /></Lazy>} />
        <Route path=":projectId" element={<Lazy><ProjectDetail /></Lazy>} />
        <Route path=":projectId/details" element={<Lazy><ProjectDetailsPage /></Lazy>} />
      </Route>

      {/* ── Kanban ─────────────────────────────────────────────────────── */}
      <Route path="/kanban" element={<Layout><></></Layout>}>
        <Route path=":projectId" element={<Lazy><KanbanPage /></Lazy>} />
      </Route>

      {/* ── Tasks ──────────────────────────────────────────────────────── */}
      <Route path="/tasks" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><TasksList /></Lazy>} />
        <Route path=":taskId" element={<Lazy><TaskDetail /></Lazy>} />
      </Route>

      {/* ── Activity ───────────────────────────────────────────────────── */}
      <Route path="/activity" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><ActivityFeed /></Lazy>} />
      </Route>

      {/* ── Timesheets ─────────────────────────────────────────────────── */}
      <Route path="/timesheets" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><TimesheetsPage /></Lazy>} />
      </Route>

      {/* ── People ─────────────────────────────────────────────────────── */}
      <Route path="/team"   element={<Layout><></></Layout>}>
        <Route index element={<Navigate to="/people" replace />} />
      </Route>
      <Route path="/people" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><PeoplePage /></Lazy>} />
        <Route path=":userId" element={<Lazy><EmployeeProfile /></Lazy>} />
        <Route path="skills" element={<Lazy><SkillMatrix /></Lazy>} />
        <Route path="capacity" element={<Lazy><CapacityPlanning /></Lazy>} />
      </Route>

      {/* ── Calendar ───────────────────────────────────────────────────── */}
      <Route path="/calendar" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><CalendarPage /></Lazy>} />
      </Route>

      {/* ── Reports ────────────────────────────────────────────────────── */}
      <Route path="/reports" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><ReportsPage /></Lazy>} />
      </Route>

      {/* ── Settings ───────────────────────────────────────────────────── */}
      <Route path="/settings" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><SettingsPage /></Lazy>} />
      </Route>

      {/* ── Super Admin ────────────────────────────────────────────────── */}
      <Route path="/admin/super" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><SuperAdminPage /></Lazy>} />
      </Route>

      <Route path="/hr" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><HRPage /></Lazy>} />
        <Route path="approval/:type/:id" element={<Lazy><HrApprovalPage /></Lazy>} />
      </Route>

      {/* ── Attendance ─────────────────────────────────────────────────── */}
      <Route path="/attendance" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><AttendancePage /></Lazy>} />
      </Route>

      {/* ── Chat ───────────────────────────────────────────────────────── */}
      <Route path="/chat" element={<Layout><></></Layout>}>
        <Route index element={<Lazy><ChatPage /></Lazy>} />
      </Route>

      {/* ── Catch-all ──────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
