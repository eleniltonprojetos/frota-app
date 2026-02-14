import { useState, useEffect } from 'react';
import { Truck } from 'lucide-react';
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

const supabase = getSupabaseClient();

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSignup, setIsSignup] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adminRegistrationEnabled, setAdminRegistrationEnabled] = useState(false);

  useEffect(() => {
    checkSession();
    testServerConnection();
    fetchAdminRegistrationSetting();
    console.log('App mounted');
  }, []);

  useEffect(() => {
    if (isSignup) {
      fetchAdminRegistrationSetting();
    }
  }, [isSignup]);

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
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
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
        const expiresAt = data.session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        
        if (expiresAt && expiresAt < now) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          
          if (refreshData.session) {
            setUser(refreshData.session.user as User);
            setAccessToken(refreshData.session.access_token);
          }
        } else {
          const sessionUser = data.session.user;
          if (!sessionUser.user_metadata || !sessionUser.user_metadata.role) {
             const { data: userData, error: userError } = await supabase.auth.getUser();
             if (!userError && userData.user) {
                setUser(userData.user as User);
             } else {
                setUser(sessionUser as User);
             }
          } else {
             setUser(sessionUser as User);
          }
          setAccessToken(data.session.access_token);
        }
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
      const cleanPassword = password.trim();
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/signup`,
        {
          method: 'POST',
          headers: {
            'apikey': publicAnonKey,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email: cleanEmail, password: cleanPassword, name, role }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha no cadastro');
      }
      
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (loginError) {
        toast.success('Cadastro realizado com sucesso! Faça login.');
        setIsSignup(false);
        return;
      }

      if (loginData.session) {
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
      const cleanPassword = password.trim();
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        if (error.message === 'Invalid login credentials') {
          throw new Error('Email ou senha incorretos. Verifique suas credenciais.');
        }
        throw error;
      }

      if (data.session) {
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
            {/* Logo Local */}
            <div className="mb-8 flex items-center justify-center">
               <div className="h-40 w-40 bg-white-100 rounded-full flex items-center justify-center drop-shadow-lg overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="Logo Sistema de Frota" 
                    className="w-full h-full object-cover"
                  />
               </div>
            </div>
            <h1 className="text-2xl mb-1 text-blue-900 font-bold">Sistema de Frota</h1>
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