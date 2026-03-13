import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Modals
  activeModal: string | null;
  modalData: any;
  openModal: (modal: string, data?: any) => void;
  closeModal: () => void;
  
  // Toasts
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
  // Loading states
  loadingStates: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;
  
  // Search
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
  
  // View preferences
  taskView: 'board' | 'list' | 'calendar';
  setTaskView: (view: 'board' | 'list' | 'calendar') => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ 
        sidebarCollapsed: !state.sidebarCollapsed 
      })),
      setSidebarCollapsed: (collapsed) => set({ 
        sidebarCollapsed: collapsed 
      }),
      
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      
      // Modals
      activeModal: null,
      modalData: null,
      openModal: (modal, data) => set({ 
        activeModal: modal, 
        modalData: data 
      }),
      closeModal: () => set({ 
        activeModal: null, 
        modalData: null 
      }),
      
      // Toasts
      toasts: [],
      addToast: (toast) => {
        const id = Math.random().toString(36).substring(7);
        const newToast = { ...toast, id };
        set((state) => ({ 
          toasts: [...state.toasts, newToast] 
        }));
        
        // Auto-remove toast
        const duration = toast.duration || 5000;
        setTimeout(() => {
          get().removeToast(id);
        }, duration);
      },
      removeToast: (id) => {
        set((state) => ({ 
          toasts: state.toasts.filter((t) => t.id !== id) 
        }));
      },
      
      // Loading states
      loadingStates: {},
      setLoading: (key, loading) => {
        set((state) => ({
          loadingStates: { 
            ...state.loadingStates, 
            [key]: loading 
          }
        }));
      },
      
      // Search
      globalSearchOpen: false,
      setGlobalSearchOpen: (open) => set({ 
        globalSearchOpen: open 
      }),
      
      // View preferences
      taskView: 'board',
      setTaskView: (view) => set({ taskView: view }),
    }),
    {
      name: 'ui-preferences',
      partialize: (state) => ({ 
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        taskView: state.taskView,
      }),
    }
  )
);
