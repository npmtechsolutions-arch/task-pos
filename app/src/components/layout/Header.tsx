import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Command,
  Settings,
  User,
  LogOut,
  Moon,
  Sun,
  Monitor
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { NotificationBell } from '@/components/communication/NotificationBell';
import { TaskForm } from '@/components/tasks/TaskForm';

export function Header() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme, sidebarCollapsed } = useUIStore();
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

  return (
    <header 
      className="relative z-30 h-16 bg-white border-b border-gray-200"
    >
      <div className="flex items-center justify-between h-full px-4">
        {/* Left side - Search */}
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search tasks, projects, or people..."
              className="pl-10 pr-10 w-full bg-gray-50 border-gray-200 focus:bg-white"
              readOnly
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded">
                <Command className="w-3 h-3" />
                <span>K</span>
              </kbd>
            </div>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* New Task Button */}
          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
                <span>New Task</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new task to your project.
                </DialogDescription>
              </DialogHeader>
              <TaskForm onSuccess={() => setIsTaskDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* Mobile New Task Button */}
          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="sm:hidden bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <DialogDescription>
                  Add a new task to your project.
                </DialogDescription>
              </DialogHeader>
              <TaskForm onSuccess={() => setIsTaskDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* Notifications */}
          <NotificationBell />

          {/* ── Theme Toggle Switch ─────────────────── */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="relative flex items-center w-14 h-7 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 overflow-hidden select-none"
            aria-label="Toggle dark mode"
          >
            {/* Track icons */}
            <Sun className="absolute left-1.5 w-3.5 h-3.5 text-amber-500 transition-opacity duration-200" style={{ opacity: theme === 'light' ? 1 : 0.3 }} />
            <Moon className="absolute right-1.5 w-3.5 h-3.5 text-indigo-400 transition-opacity duration-200" style={{ opacity: theme === 'dark' ? 1 : 0.3 }} />
            {/* Sliding indicator */}
            <span
              className="absolute top-0.5 w-6 h-6 rounded-full bg-white dark:bg-indigo-600 shadow-md transform transition-transform duration-300"
              style={{ left: theme === 'dark' ? 'calc(100% - 1.625rem)' : '0.125rem' }}
            />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatarUrl} alt={user?.firstName} />
                  <AvatarFallback className="bg-blue-600 text-white">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to="/settings/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs">Theme</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  <span>Light</span>
                  {theme === 'light' && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  <span>Dark</span>
                  {theme === 'dark' && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  <span>System</span>
                  {theme === 'system' && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
