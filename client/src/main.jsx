import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { ToastProvider } from './components/ui/Toast.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/login.css';
import './styles/shell.css';
import './styles/pages.css';
import './styles/site.css';
import './styles/motion.css';

// Scroll-reveal hides things only once this class is set, so the page is fully readable without JavaScript.
document.documentElement.classList.add('js');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>,
);
