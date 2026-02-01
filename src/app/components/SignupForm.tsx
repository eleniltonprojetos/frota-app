import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface SignupFormProps {
  onSignup: (email: string, password: string, name: string, role: 'admin' | 'driver') => Promise<void>;
  onToggleMode: () => void;
  adminRegistrationEnabled: boolean;
}

export function SignupForm({ onSignup, onToggleMode, adminRegistrationEnabled }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'driver'>('driver');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSignup(email.trim(), password, name, role);
      setEmail('');
      setPassword('');
      setName('');
      setRole('driver');
    } catch (error) {
      // Error is handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Cadastro</CardTitle>
        <CardDescription className="text-sm">Crie sua conta no sistema</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm">Nome</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-email" className="text-sm">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-password" className="text-sm">Senha</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-sm">Tipo de Usuário</Label>
            <Select 
              value={role} 
              onValueChange={(value: 'admin' | 'driver') => setRole(value)}
              disabled={loading}
            >
              <SelectTrigger id="role" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">Motorista</SelectItem>
                <SelectItem 
                  value="admin" 
                  disabled={!adminRegistrationEnabled}
                >
                  Administrador {!adminRegistrationEnabled && '(Indisponível)'}
                </SelectItem>
              </SelectContent>
            </Select>
            {!adminRegistrationEnabled && role !== 'driver' && (
              <p className="text-xs text-red-500">
                O cadastro de novos administradores está temporariamente desativado.
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3 pt-2">
          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
          <Button 
            type="button" 
            variant="ghost" 
            className="w-full h-9 text-sm"
            onClick={onToggleMode}
          >
            Já tem conta? Faça login
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}