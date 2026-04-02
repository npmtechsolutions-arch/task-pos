import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Calendar,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Plus,
  Clock,
  ShieldCheck,
  Kanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useUIStore, useProjectStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ProjectForm } from '@/components/projects/ProjectForm';

const mainNavigation = [
  { name: 'Dashboard',  href: '/dashboard',  icon: LayoutDashboard },
  { name: 'Projects',   href: '/projects',   icon: FolderKanban },
  { name: 'My Tasks',   href: '/tasks',      icon: CheckSquare },
  { name: 'Timesheets', href: '/timesheets', icon: Clock },
  { name: 'HR & Org',   href: '/hr',         icon: Users },
  { name: 'Calendar',   href: '/calendar',   icon: Calendar },
  { name: 'Reports',    href: '/reports',    icon: BarChart3 },
];

const adminNavigation = [
  { name: 'Super Admin',   href: '/admin/super',    icon: ShieldCheck },
  { name: 'Landing Admin', href: '/dashboard/admin', icon: LayoutDashboard },
  { name: 'Settings',      href: '/settings',        icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { projects } = useProjectStore();
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    }
    return location.pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: { name: string; href: string; icon: React.ElementType } }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    if (sidebarCollapsed) {
      return (
        <Tooltip key={item.name}>
          <TooltipTrigger asChild>
            <Link
              to={item.href}
              className={cn(
                'flex items-center justify-center p-2 rounded-lg transition-colors',
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right"><p>{item.name}</p></TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link
        key={item.name}
        to={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
          active
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        )}
      >
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{item.name}</span>
      </Link>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* ── Full-height sidebar using flex column — NO absolute positioning ── */}
      <aside
        className={cn(
          'flex flex-col flex-shrink-0 h-screen bg-gray-900 transition-all duration-300 overflow-hidden',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* ── Logo + collapse toggle ─────────────────────────────────────── */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-lg font-semibold text-white">ProjectFlow</span>
            )}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* ── New Project button ─────────────────────────────────────────── */}
        <div className="p-3 flex-shrink-0">
          <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className={cn(
                  'w-full bg-blue-600 hover:bg-blue-700 text-white',
                  sidebarCollapsed && 'px-2'
                )}
              >
                <Plus className="w-4 h-4" />
                {!sidebarCollapsed && <span className="ml-2">New Project</span>}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Fill in the details below to create a new project.
                </DialogDescription>
              </DialogHeader>
              <ProjectForm onSuccess={() => setIsProjectDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Main navigation — scrollable middle section ────────────────── */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {mainNavigation.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}

          {/* Recent Projects */}
          {!sidebarCollapsed && projects.length > 0 && (
            <div className="pt-4">
              <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Recent Projects
              </p>
              {projects.slice(0, 4).map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: project.progress === 100 ? '#10B981' : '#3B82F6' }}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              ))}
            </div>
          )}
        </nav>

        {/* ── Admin / Settings navigation — fixed at bottom ─────────────── */}
        <div className="px-2 py-2 border-t border-gray-800 space-y-0.5 flex-shrink-0">
          {adminNavigation.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>

        {/* ── User profile + logout ──────────────────────────────────────── */}
        <div className="px-2 py-2 border-t border-gray-800 flex-shrink-0">
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-full p-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{user?.fullName || user?.email}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
