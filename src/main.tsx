import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initAnalytics } from './utils/analytics.ts'

// Initialize Posthog analytics (no-op in dev)
initAnalytics()

// Prevent pinch-to-zoom on iOS (Safari ignores viewport meta since iOS 10)
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('gestureend', (e) => e.preventDefault());

// Prevent multi-touch zoom on all mobile browsers
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Note: StrictMode disabled due to react-three-fiber WebGL context issues
// R3F's Canvas doesn't handle StrictMode's double-mount cycle well
createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
    <Analytics />
    <SpeedInsights />
  </ErrorBoundary>,
)
