import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { lazyWithRetry, namedExport } from './utils/lazyWithRetry';

// Lazy load the main app (keeps initial bundle small for guide-only visitors)
const App = lazy(() => import('./App'));

// Lazy load the guide page
const GuidePage = lazyWithRetry(() =>
  import('./guide/GuidePage').then(namedExport('GuidePage'))
);

// Loading fallback for route transitions (inline to avoid fast-refresh warning)
const routeLoadingFallback = (
  <div className="h-screen bg-surface flex items-center justify-center">
    <div className="text-content-secondary">Loading...</div>
  </div>
);

/**
 * Route configuration for the app.
 * Exported separately for testing with createMemoryRouter.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={routeLoadingFallback}>
        <App />
      </Suspense>
    ),
  },
  {
    path: '/guide',
    element: (
      <Suspense fallback={routeLoadingFallback}>
        <GuidePage />
      </Suspense>
    ),
    children: [
      {
        path: ':lessonId',
        element: null, // Handled by GuidePage internally
      },
    ],
  },
];
