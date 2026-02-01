import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

import { ForgotPasswordDialog } from './ForgotPasswordDialog';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onToggleMode: () => void;
}

export function LoginForm({ onLogin, onResetPassword, onToggleMode }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onLogin(email.trim(), password);
    } catch (error) {
      // Error is handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Login</CardTitle>
        <CardDescription className="text-sm">Entre com suas credenciais</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <ForgotPasswordDialog onResetPassword={onResetPassword} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full h-9 text-sm"
            onClick={onToggleMode}
          >
            Não tem conta? Cadastre-se
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}