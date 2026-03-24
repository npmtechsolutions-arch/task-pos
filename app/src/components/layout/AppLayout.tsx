import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-auto bg-gray-50 relative pt-16">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
