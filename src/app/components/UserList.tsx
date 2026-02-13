import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Shield, User as UserIcon, Calendar, Clock, Loader2, Trash2, Crown, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  role: 'admin' | 'driver' | 'super_admin';
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UserListProps {
  accessToken: string;
  currentUser: any;
}

export function UserList({ accessToken, currentUser }: UserListProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    // Debug: Verificar se o usuário atual está chegando
    console.log('UserList Current User:', currentUser);
    if (currentUser) {
        const role = currentUser.user_metadata?.role || currentUser.role;
        console.log('My Role:', role);
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao buscar usuários');
      }

      const data = await response.json();
      setUsers(data.users);
      
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${userName}? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users/${userId}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': publicAnonKey,
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'x-access-token': accessToken,
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha ao excluir usuário');
        }

        toast.success('Usuário excluído com sucesso');
        setUsers(users.filter(u => u.id !== userId));
    } catch (error: any) {
        toast.error(error.message);
    }
  };

  const handlePromoteToSuperAdmin = async (userId: string) => {
     if (!confirm("Tem certeza? Tornar-se Super Admin dará controle total sobre o sistema.")) return;

     try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users/${userId}/role`,
            {
                method: 'PUT',
                headers: {
                    'apikey': publicAnonKey,
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'x-access-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: 'super_admin' })
            }
        );
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Falha ao atualizar função');
        }
        
        toast.success('Promovido a Super Admin com sucesso! Atualize a página.');
        fetchUsers();
     } catch (error: any) {
         toast.error(error.message);
     }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'driver') => {
     const roleName = newRole === 'admin' ? 'Administrador' : 'Motorista';
     if (!confirm(`Tem certeza que deseja alterar a função deste usuário para ${roleName}?`)) return;

     try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users/${userId}/role`,
            {
                method: 'PUT',
                headers: {
                    'apikey': publicAnonKey,
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'x-access-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            }
        );
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Falha ao atualizar função');
        }
        
        toast.success(`Usuário atualizado para ${roleName} com sucesso!`);
        fetchUsers();
     } catch (error: any) {
         toast.error(error.message);
     }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca acessou';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canDelete = (targetUser: UserData) => {
      if (!currentUser) return false;
      if (currentUser.id === targetUser.id) return false; // Can't delete self

      const role = currentUser.user_metadata?.role || currentUser.role;

      if (role === 'super_admin') return true;
      if (role === 'admin') {
          return targetUser.role === 'driver';
      }
      return false;
  };

  // ATUALIZADO: Permite que Admins e Super Admins promovam motoristas
  const canPromoteToAdmin = (targetUser: UserData) => {
      if (!currentUser) return false;
      const role = currentUser.user_metadata?.role || currentUser.role;
      
      // Se for Super Admin, pode promover qualquer um (exceto outros super admins, lógica à parte)
      if (role === 'super_admin') return targetUser.role === 'driver';
      
      // Se for Admin, pode promover Drivers para Admin
      if (role === 'admin') return targetUser.role === 'driver';
      
      return false;
  };

  const canDemoteToDriver = (targetUser: UserData) => {
      if (!currentUser) return false;
      const role = currentUser.user_metadata?.role || currentUser.role;
      
      // Apenas Super Admin pode rebaixar Admin
      if (role !== 'super_admin') return false; 
      
      return targetUser.role === 'admin';
  };

  const isBootstrapAvailable = () => {
      if (!currentUser) return false;
      const superAdmins = users.filter(u => u.role === 'super_admin');
      // Mostra o botão se não houver super admins OU se eu for o único admin e quiser me promover
      return superAdmins.length === 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Aviso de erro se o AdminDashboard não estiver atualizado
  if (!currentUser) {
      return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                  <h3 className="font-bold">Erro de Integração</h3>
                  <p className="text-sm">O componente UserList não recebeu as informações do usuário atual. Verifique se o arquivo <code>AdminDashboard.tsx</code> foi atualizado corretamente.</p>
              </div>
          </div>
      );
  }

  return (
    <>
      {isBootstrapAvailable() && (
          <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-indigo-600" />
                  <div>
                      <h3 className="font-semibold text-indigo-900">Configuração Inicial</h3>
                      <p className="text-sm text-indigo-700">Você pode se promover a Super Admin.</p>
                  </div>
              </div>
              <Button onClick={() => currentUser && handlePromoteToSuperAdmin(currentUser.id)} className="bg-indigo-600 hover:bg-indigo-700">
                  Tornar-se Super Admin
              </Button>
          </div>
      )}

      {/* Desktop View */}
      <div className="hidden md:block rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        user.role === 'super_admin' ? 'bg-amber-100' : 
                        user.role === 'admin' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {user.role === 'super_admin' ? (
                        <Crown className="h-4 w-4 text-amber-600" />
                      ) : user.role === 'admin' ? (
                        <Shield className="h-4 w-4 text-blue-600" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    {user.name}
                    {currentUser?.id === user.id && <span className="text-xs text-muted-foreground">(Você)</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={
                      user.role === 'super_admin' ? 'outline' : 
                      user.role === 'admin' ? 'default' : 'secondary'
                  } className={user.role === 'super_admin' ? 'border-amber-500 text-amber-700 bg-amber-50' : ''}>
                    {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Motorista'}
                  </Badge>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.last_sign_in_at)}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                    {canPromoteToAdmin(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleUpdateRole(user.id, 'admin')}
                            title="Promover a Administrador"
                        >
                            <Shield className="h-4 w-4" />
                        </Button>
                    )}
                    {canDemoteToDriver(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            onClick={() => handleUpdateRole(user.id, 'driver')}
                            title="Rebaixar a Motorista"
                        >
                            <UserIcon className="h-4 w-4" />
                        </Button>
                    )}
                    {canDelete(user) && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            title="Excluir Usuário"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        user.role === 'super_admin' ? 'bg-amber-100' : 
                        user.role === 'admin' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                    {user.role === 'super_admin' ? (
                        <Crown className="h-4 w-4 text-amber-600" />
                      ) : user.role === 'admin' ? (
                        <Shield className="h-4 w-4 text-blue-600" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-gray-600" />
                      )}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-1">
                        {user.name}
                        {currentUser?.id === user.id && <span className="text-xs font-normal text-muted-foreground">(Você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={
                      user.role === 'super_admin' ? 'outline' : 
                      user.role === 'admin' ? 'default' : 'secondary'
                    } className={user.role === 'super_admin' ? 'border-amber-500 text-amber-700 bg-amber-50' : ''}>
                        {user.role === 'super_admin' ? 'Super' : user.role === 'admin' ? 'Admin' : 'Mot.'}
                    </Badge>
                    
                    {canPromoteToAdmin(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleUpdateRole(user.id, 'admin')}
                            title="Promover"
                        >
                            <Shield className="h-4 w-4" />
                        </Button>
                    )}
                    {canDemoteToDriver(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            onClick={() => handleUpdateRole(user.id, 'driver')}
                            title="Rebaixar"
                        >
                            <UserIcon className="h-4 w-4" />
                        </Button>
                    )}
                    {canDelete(user) && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Cadastro: {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Acesso: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}import { useState, useEffect } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Shield, User as UserIcon, Calendar, Clock, Loader2, Trash2, Crown, AlertTriangle } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

interface UserData {
  id: string;
  email: string;
  role: 'admin' | 'driver' | 'super_admin';
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface UserListProps {
  accessToken: string;
  currentUser: any;
}

export function UserList({ accessToken, currentUser }: UserListProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
    // Debug: Verificar se o usuário atual está chegando
    console.log('UserList Current User:', currentUser);
    if (currentUser) {
        const role = currentUser.user_metadata?.role || currentUser.role;
        console.log('My Role:', role);
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao buscar usuários');
      }

      const data = await response.json();
      setUsers(data.users);
      
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar lista de usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário ${userName}? Esta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users/${userId}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': publicAnonKey,
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'x-access-token': accessToken,
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Falha ao excluir usuário');
        }

        toast.success('Usuário excluído com sucesso');
        setUsers(users.filter(u => u.id !== userId));
    } catch (error: any) {
        toast.error(error.message);
    }
  };

  const handlePromoteToSuperAdmin = async (userId: string) => {
     if (!confirm("Tem certeza? Tornar-se Super Admin dará controle total sobre o sistema.")) return;

     try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users/${userId}/role`,
            {
                method: 'PUT',
                headers: {
                    'apikey': publicAnonKey,
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'x-access-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: 'super_admin' })
            }
        );
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Falha ao atualizar função');
        }
        
        toast.success('Promovido a Super Admin com sucesso! Atualize a página.');
        fetchUsers();
     } catch (error: any) {
         toast.error(error.message);
     }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'driver') => {
     const roleName = newRole === 'admin' ? 'Administrador' : 'Motorista';
     if (!confirm(`Tem certeza que deseja alterar a função deste usuário para ${roleName}?`)) return;

     try {
        const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/users/${userId}/role`,
            {
                method: 'PUT',
                headers: {
                    'apikey': publicAnonKey,
                    'Authorization': `Bearer ${publicAnonKey}`,
                    'x-access-token': accessToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            }
        );
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Falha ao atualizar função');
        }
        
        toast.success(`Usuário atualizado para ${roleName} com sucesso!`);
        fetchUsers();
     } catch (error: any) {
         toast.error(error.message);
     }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca acessou';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const canDelete = (targetUser: UserData) => {
      if (!currentUser) return false;
      if (currentUser.id === targetUser.id) return false; // Can't delete self

      const role = currentUser.user_metadata?.role || currentUser.role;

      if (role === 'super_admin') return true;
      if (role === 'admin') {
          return targetUser.role === 'driver';
      }
      return false;
  };

  // ATUALIZADO: Permite que Admins e Super Admins promovam motoristas
  const canPromoteToAdmin = (targetUser: UserData) => {
      if (!currentUser) return false;
      const role = currentUser.user_metadata?.role || currentUser.role;
      
      // Se for Super Admin, pode promover qualquer um (exceto outros super admins, lógica à parte)
      if (role === 'super_admin') return targetUser.role === 'driver';
      
      // Se for Admin, pode promover Drivers para Admin
      if (role === 'admin') return targetUser.role === 'driver';
      
      return false;
  };

  const canDemoteToDriver = (targetUser: UserData) => {
      if (!currentUser) return false;
      const role = currentUser.user_metadata?.role || currentUser.role;
      
      // Apenas Super Admin pode rebaixar Admin
      if (role !== 'super_admin') return false; 
      
      return targetUser.role === 'admin';
  };

  const isBootstrapAvailable = () => {
      if (!currentUser) return false;
      const superAdmins = users.filter(u => u.role === 'super_admin');
      // Mostra o botão se não houver super admins OU se eu for o único admin e quiser me promover
      return superAdmins.length === 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Aviso de erro se o AdminDashboard não estiver atualizado
  if (!currentUser) {
      return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                  <h3 className="font-bold">Erro de Integração</h3>
                  <p className="text-sm">O componente UserList não recebeu as informações do usuário atual. Verifique se o arquivo <code>AdminDashboard.tsx</code> foi atualizado corretamente.</p>
              </div>
          </div>
      );
  }

  return (
    <>
      {isBootstrapAvailable() && (
          <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-indigo-600" />
                  <div>
                      <h3 className="font-semibold text-indigo-900">Configuração Inicial</h3>
                      <p className="text-sm text-indigo-700">Você pode se promover a Super Admin.</p>
                  </div>
              </div>
              <Button onClick={() => currentUser && handlePromoteToSuperAdmin(currentUser.id)} className="bg-indigo-600 hover:bg-indigo-700">
                  Tornar-se Super Admin
              </Button>
          </div>
      )}

      {/* Desktop View */}
      <div className="hidden md:block rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Último Acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        user.role === 'super_admin' ? 'bg-amber-100' : 
                        user.role === 'admin' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                      {user.role === 'super_admin' ? (
                        <Crown className="h-4 w-4 text-amber-600" />
                      ) : user.role === 'admin' ? (
                        <Shield className="h-4 w-4 text-blue-600" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                    {user.name}
                    {currentUser?.id === user.id && <span className="text-xs text-muted-foreground">(Você)</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={
                      user.role === 'super_admin' ? 'outline' : 
                      user.role === 'admin' ? 'default' : 'secondary'
                  } className={user.role === 'super_admin' ? 'border-amber-500 text-amber-700 bg-amber-50' : ''}>
                    {user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'Motorista'}
                  </Badge>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.created_at)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(user.last_sign_in_at)}
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                    {canPromoteToAdmin(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleUpdateRole(user.id, 'admin')}
                            title="Promover a Administrador"
                        >
                            <Shield className="h-4 w-4" />
                        </Button>
                    )}
                    {canDemoteToDriver(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            onClick={() => handleUpdateRole(user.id, 'driver')}
                            title="Rebaixar a Motorista"
                        >
                            <UserIcon className="h-4 w-4" />
                        </Button>
                    )}
                    {canDelete(user) && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                            title="Excluir Usuário"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        user.role === 'super_admin' ? 'bg-amber-100' : 
                        user.role === 'admin' ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                    {user.role === 'super_admin' ? (
                        <Crown className="h-4 w-4 text-amber-600" />
                      ) : user.role === 'admin' ? (
                        <Shield className="h-4 w-4 text-blue-600" />
                      ) : (
                        <UserIcon className="h-4 w-4 text-gray-600" />
                      )}
                  </div>
                  <div>
                    <p className="font-medium flex items-center gap-1">
                        {user.name}
                        {currentUser?.id === user.id && <span className="text-xs font-normal text-muted-foreground">(Você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={
                      user.role === 'super_admin' ? 'outline' : 
                      user.role === 'admin' ? 'default' : 'secondary'
                    } className={user.role === 'super_admin' ? 'border-amber-500 text-amber-700 bg-amber-50' : ''}>
                        {user.role === 'super_admin' ? 'Super' : user.role === 'admin' ? 'Admin' : 'Mot.'}
                    </Badge>
                    
                    {canPromoteToAdmin(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => handleUpdateRole(user.id, 'admin')}
                            title="Promover"
                        >
                            <Shield className="h-4 w-4" />
                        </Button>
                    )}
                    {canDemoteToDriver(user) && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            onClick={() => handleUpdateRole(user.id, 'driver')}
                            title="Rebaixar"
                        >
                            <UserIcon className="h-4 w-4" />
                        </Button>
                    )}
                    {canDelete(user) && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>Cadastro: {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>Acesso: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}