import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './utils/serviceWorkerCleanup'
import { ReloadDebuggerService } from './utils/reloadDebugger'

// Initialize reload debugger for auth debugging
if (import.meta.env.DEV || localStorage.getItem('mako_debug_reload') === 'true') {
  ReloadDebuggerService.initialize();
}

createRoot(document.getElementById("root")!).render(<App />);
