/**
 * queryClient.ts — singleton QueryClient instance.
 *
 * By exporting a module-level singleton we can access it from
 * non-React contexts (e.g. WebSocket message handler, Zustand actions).
 *
 * App.tsx still wraps the tree in <QueryClientProvider client={queryClient}>
 * using this same instance.
 */

import { QueryClient } from '@tanstack/react-query';

let _client: QueryClient | null = null;

export function getQueryClient(): QueryClient {
  if (!_client) {
    _client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000, // 5 minutes
          retry: 1,
          // IMPORTANT: disable window focus refetch globally.
          // Drag-and-drop triggers a blur→focus cycle which caused Kanban
          // cards to jump back after 10 seconds (old DB data overwriting
          // the optimistic UI update). Re-enable per-query where needed.
          refetchOnWindowFocus: false,
          refetchOnReconnect: 'always',
        },
      },
    });
  }
  return _client;
}
