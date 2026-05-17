import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useWebSocket } from '@/hooks/useWebSocket';
import { PageErrorBoundary } from '@/components/ErrorBoundary';

export function AppLayout() {
  const { user, token } = useAuthStore();

  // 🔌 Live WebSocket connection — streams notifications in real-time
  useWebSocket({
    userId: user?.id ?? '',
    token: token ?? '',
    enabled: !!user?.id && !!token,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 relative pt-16">
          <div className="p-6 max-w-full">
            <PageErrorBoundary>
              <Outlet />
            </PageErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

