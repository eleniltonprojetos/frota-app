import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { LoginForm } from './components/LoginForm';
import { SignupForm } from './components/SignupForm';
import { ResetPasswordForm } from './components/ResetPasswordForm';
import { DriverDashboard } from './components/DriverDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { InstallPWA } from './components/InstallPWA';
import { User } from './types';
import { Car } from 'lucide-react';

// Ajuste para ambiente local/Vercel
const appIcon = "https://images.unsplash.com/photo-1559497056-fe4dab665446?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsb2dpc3RpY3MlMjBmbGVldCUyMG1hbmFnZW1lbnQlMjBsb2dvJTIwbWluaW1hbGlzdCUyMHZlY3RvciUyMHN0eWxlfGVufDF8fHx8MTc3MDU5OTkwM3ww&ixlib=rb-4.1.0&q=80&w=1080";

const supabase = getSupabaseClient();

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminRegistrationEnabled, setAdminRegistrationEnabled] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    checkSession();
    testServerConnection();
    fetchAdminRegistrationSetting();
    console.log('App mounted');

    // PWA configuration
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);

    const iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    iconLink.href = appIcon;
    document.head.appendChild(iconLink);

    const appleIconLink = document.createElement('link');
    appleIconLink.rel = 'apple-touch-icon';
    appleIconLink.href = appIcon;
    document.head.appendChild(appleIconLink);

    const metaCapable = document.createElement('meta');
    metaCapable.name = 'apple-mobile-web-app-capable';
    metaCapable.content = 'yes';
    document.head.appendChild(metaCapable);

    const metaMobileWeb = document.createElement('meta');
    metaMobileWeb.name = 'mobile-web-app-capable';
    metaMobileWeb.content = 'yes';
    document.head.appendChild(metaMobileWeb);

    const metaStatus = document.createElement('meta');
    metaStatus.name = 'apple-mobile-web-app-status-bar-style';
    metaStatus.content = 'black-translucent';
    document.head.appendChild(metaStatus);

    const metaTheme = document.createElement('meta');
    metaTheme.name = 'theme-color';
    metaTheme.content = '#2563eb';
    document.head.appendChild(metaTheme);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          console.log('SW registered: ', registration);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsResettingPassword(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href,
      });
      if (error) throw error;
      toast.success('Link de recuperação enviado para o email!');
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error.message || 'Erro ao enviar email de recuperação');
      throw error;
    }
  };

  const handleUpdatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Senha atualizada com sucesso! Faça login com a nova senha.');
      setIsResettingPassword(false);
      window.history.replaceState(null, '', window.location.pathname);
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
    } catch (error: any) {
      console.error('Update password error:', error);
      toast.error(error.message || 'Erro ao atualizar senha');
      throw error;
    }
  };

  const fetchAdminRegistrationSetting = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/settings/admin-registration`,
        {
          headers: {
            'apikey': publicAnonKey,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setAdminRegistrationEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error fetching admin registration setting:', error);
    }
  };

  const testServerConnection = async () => {
    try {
      console.log('=== TESTING SERVER CONNECTION ===');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/health`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      const data = await response.json();
      console.log('Server health check:', data);
    } catch (error) {
      console.error('Server connection error:', error);
    }
  };

  const testToken = async (token: string) => {
    try {
      console.log('=== TESTING TOKEN ===');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/test-token`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': token,
          },
        }
      );
      const data = await response.json();
      console.log('Token test result:', data);
      return data;
    } catch (error) {
      console.error('Token test error:', error);
      return null;
    }
  };

  const checkSession = async () => {
    try {
      console.log('=== CHECKING SESSION ===');
      const { data, error } = await supabase.auth.getSession();
      console.log('Session check result:', { 
        hasSession: !!data.session, 
        hasUser: !!data.session?.user,
        hasToken: !!data.session?.access_token,
        error: error?.message 
      });
      
      if (error) throw error;
      
      if (data.session) {
        // Verify token is not expired
        const expiresAt = data.session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        console.log('Token expires at:', expiresAt, 'Current time:', now);
        
        if (expiresAt && expiresAt < now) {
          console.log('Token expired, refreshing session...');
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          
          if (refreshData.session) {
            console.log('Session refreshed. Role:', refreshData.session.user.user_metadata.role);
            setUser(refreshData.session.user as User);
            setAccessToken(refreshData.session.access_token);
          }
        } else {
          console.log('Session valid. Checking metadata...');
          
          const sessionUser = data.session.user;
          
          // Verify if metadata exists and has role
          if (!sessionUser.user_metadata || !sessionUser.user_metadata.role) {
             console.log('Metadata missing or incomplete in session, fetching fresh user data...');
             const { data: userData, error: userError } = await supabase.auth.getUser();
             
             if (!userError && userData.user) {
                console.log('Fresh user data fetched. Role:', userData.user.user_metadata.role);
                setUser(userData.user as User);
             } else {
                console.log('Failed to fetch fresh user data, using session user fallback');
                setUser(sessionUser as User);
             }
          } else {
             console.log('Metadata present. Role:', sessionUser.user_metadata.role);
             setUser(sessionUser as User);
          }
          
          setAccessToken(data.session.access_token);
        }
      } else {
        console.log('No active session found');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (email: string, password: string, name: string, role: 'admin' | 'driver') => {
    try {
      const cleanEmail = email.trim();
      console.log('=== SIGNUP ATTEMPT ===');
      console.log('Creating user:', { email: cleanEmail, name, role });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/signup`,
        {
          method: 'POST',
          headers: {
            'apikey': publicAnonKey,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email: cleanEmail, password, name, role }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha no cadastro');
      }

      console.log('User created successfully, now logging in...');
      
      // Automatically log in after signup to get a valid JWT
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        console.error('Auto-login after signup failed:', loginError);
        toast.success('Cadastro realizado com sucesso! Faça login.');
        setIsSignup(false);
        return;
      }

      if (loginData.session) {
        console.log('Auto-login successful after signup');
        setUser(loginData.session.user as User);
        setAccessToken(loginData.session.access_token);
        toast.success('Cadastro realizado com sucesso! Você está logado.');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Erro ao cadastrar');
      throw error;
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const cleanEmail = email.trim();
      console.log('=== LOGIN ATTEMPT ===');
      console.log('Email:', cleanEmail);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      console.log('Login response:', { 
        hasSession: !!data.session, 
        hasUser: !!data.session?.user,
        hasToken: !!data.session?.access_token,
        error: error?.message 
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error('Email ou senha incorretos. Verifique suas credenciais.');
        }
        throw error;
      }

      if (data.session) {
        console.log('User metadata:', data.session.user.user_metadata);
        console.log('Access token:', data.session.access_token.substring(0, 30) + '...');
        
        // Test if token works with backend
        await testToken(data.session.access_token);
        
        setUser(data.session.user as User);
        setAccessToken(data.session.access_token);
        toast.success('Login realizado com sucesso!');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Erro ao fazer login');
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setAccessToken(null);
      toast.success('Logout realizado com sucesso!');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user || !accessToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-3">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 flex flex-col items-center">
            <div className="bg-white p-6 rounded-2xl mb-8 shadow-xl transform -rotate-3 overflow-hidden border border-gray-100 flex items-center justify-center">
              {!logoError ? (
                <img 
                  src={appIcon} 
                  alt="Logo" 
                  className="h-32 w-auto object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Car className="h-32 w-32 text-blue-600" />
              )}
            </div>
            <h1 className="text-2xl mb-1 text-blue-900">Sistema de Frota</h1>
            <p className="text-sm text-gray-600">Gerencie sua frota de veículos</p>
          </div>
          
          {isResettingPassword ? (
            <ResetPasswordForm onUpdatePassword={handleUpdatePassword} />
          ) : isSignup ? (
            <SignupForm 
              onSignup={handleSignup}
              onToggleMode={() => setIsSignup(false)}
              adminRegistrationEnabled={adminRegistrationEnabled}
            />
          ) : (
            <LoginForm 
              onLogin={handleLogin}
              onResetPassword={handleResetPassword}
              onToggleMode={() => setIsSignup(true)}
            />
          )}
          
          <div className="mt-8 text-center space-y-4">
            <div className="flex justify-center">
              <InstallPWA />
            </div>
            <p className="text-xs text-gray-500">Desenvolvido por <span className="font-semibold text-blue-700">Elenilton Felix</span></p>
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {['admin', 'super_admin'].includes(user.user_metadata.role) ? (
        <AdminDashboard 
          user={user} 
          accessToken={accessToken}
          onLogout={handleLogout}
          onUpdatePassword={handleUpdatePassword}
        />
      ) : (
        <DriverDashboard 
          user={user} 
          accessToken={accessToken}
          onLogout={handleLogout}
          onUpdatePassword={handleUpdatePassword}
        />
      )}
      <Toaster />
    </div>
  );
}

export default App;