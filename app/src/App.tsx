import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/queryClient';
import { AppRoutes } from '@/routes/AppRoutes';
import { Toaster } from '@/components/ui/sonner';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { PageErrorBoundary } from '@/components/ErrorBoundary';
import './App.css';

const queryClient = getQueryClient();

function App() {
  const { theme } = useUIStore();
  const { initAuth } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // Re-hydrate auth on app startup — re-applies JWT token to axios headers
  useEffect(() => {
    initAuth().finally(() => setAuthChecked(true));
  }, [initAuth]);

  // Don't render routes until auth state is resolved (prevents flash of redirect)
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PageErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </PageErrorBoundary>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
