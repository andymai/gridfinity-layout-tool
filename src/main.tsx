import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Note: StrictMode disabled due to react-three-fiber WebGL context issues
// R3F's Canvas doesn't handle StrictMode's double-mount cycle well
createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
)
