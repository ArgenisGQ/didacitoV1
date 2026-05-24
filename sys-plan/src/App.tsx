import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ActivateAccount from './components/ActivateAccount';
import api, { setAccessToken, registerAuthCallbacks } from './lib/api-client';
import { Loader2, BookOpen } from 'lucide-react';

type ViewType = 'login' | 'dashboard' | 'forgot-password' | 'reset-password' | 'activate';

function App() {
  const [view, setView] = useState<ViewType>('login');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth callbacks from axios client
  useEffect(() => {
    registerAuthCallbacks(
      (newToken) => {
        setToken(newToken);
      },
      () => {
        setToken(null);
        setView('login');
      }
    );

    // 1. Silent Refresh on startup
    const checkSilentRefresh = async () => {
      const params = new URLSearchParams(window.location.search);
      const isActivation = window.location.pathname.includes('/activate') && params.has('token');

      if (isActivation) {
        setView('activate');
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.post('/auth/refresh');
        const { access_token } = response.data;
        setToken(access_token);
        setAccessToken(access_token);
        setView('dashboard');
      } catch (err) {
        // No session cookie or expired. Stay at login unless token reset is in URL.
        if (params.get('token')) {
          setView('reset-password');
        } else {
          setView('login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkSilentRefresh();
  }, []);

  // Sync state token with the axios client module variable
  useEffect(() => {
    setAccessToken(token);
  }, [token]);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (e) {
      // Ignore network errors on logout
    }
    setToken(null);
    setAccessToken(null);
    setView('login');
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 space-y-6">
        <div className="flex items-center gap-3 text-primary animate-pulse">
          <BookOpen size={44} strokeWidth={2.5} className="text-primary" />
          <span className="text-3xl font-extrabold tracking-tight text-white">DIDACTICO</span>
        </div>
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin text-primary" size={24} />
          <span className="text-sm font-medium text-slate-400">Verificando sesión segura...</span>
        </div>
      </div>
    );
  }

  switch (view) {
    case 'dashboard':
      return <Dashboard onLogout={handleLogout} />;
    case 'forgot-password':
      return <ForgotPassword onBackToLogin={() => setView('login')} />;
    case 'reset-password':
      return (
        <ResetPassword 
          onResetSuccess={() => {
            setView('login');
            // Clean up the URL search params so the reset token is removed cleanly
            window.history.replaceState({}, document.title, window.location.pathname);
          }} 
        />
      );
    case 'activate':
      return (
        <ActivateAccount
          onActivationSuccess={() => {
            setView('login');
            // Clean up the URL and reset path to root
            window.history.replaceState({}, document.title, '/');
          }}
        />
      );
    case 'login':
    default:
      return (
        <Login 
          onLoginSuccess={(accessToken) => {
            setToken(accessToken);
            setView('dashboard');
          }} 
          onForgotPassword={() => setView('forgot-password')}
        />
      );
  }
}

export default App;

