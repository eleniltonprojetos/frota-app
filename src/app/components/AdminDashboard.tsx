import { useState, useEffect } from 'react';
import { User } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { TripList } from './TripList';
import { VehicleForm } from './VehicleForm';
import { VehicleList } from './VehicleList';
import { UserList } from './UserList';
import { MaintenanceAlerts } from './MaintenanceAlerts';
import { LogOut, Users, Truck } from 'lucide-react';
import { TripFilters, TripFiltersState } from './TripFilters';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { InstallPWA } from './InstallPWA';
import { ChangePasswordDialog } from './ChangePasswordDialog';

interface AdminDashboardProps {
  user: User;
  accessToken: string;
  onLogout: () => void;
  onUpdatePassword: (password: string) => Promise<void>;
}

interface Trip {
  id: string;
  userId: string;
  userName?: string;
  vehiclePlate: string;
  vehicleColor: string;
  vehicleModel: string;
  kmStart: number;
  timeStart: string;
  kmEnd: number | null;
  timeEnd: string | null;
  destination: string;
  status: 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
}

interface VehicleStats {
  plate: string;
  model: string;
  color: string;
  totalTrips: number;
  totalKm: number;
  activeTrips: number;
}

interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: string;
  createdAt: string;
  isAvailable?: boolean;
  activeTrip?: {
    id: string;
    userName: string;
    timeStart: string;
  } | null;
}

export function AdminDashboard({ user, accessToken, onLogout, onUpdatePassword }: AdminDashboardProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleStats, setVehicleStats] = useState<VehicleStats[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [userStats, setUserStats] = useState<{ admins: number, drivers: number, total: number }>({ admins: 0, drivers: 0, total: 0 });
  const [adminRegistrationEnabled, setAdminRegistrationEnabled] = useState(true);
  const [filters, setFilters] = useState<TripFiltersState>({
    driverName: '',
    vehicle: '',
    date: '',
  });

  useEffect(() => {
    fetchAllTrips();
    fetchVehicles();
    fetchUserStats();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/settings/admin-registration`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
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
      console.error('Error fetching settings:', error);
    }
  };

  const toggleAdminRegistration = async (checked: boolean) => {
    setAdminRegistrationEnabled(checked);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/settings/admin-registration`,
        {
          method: 'PUT',
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: checked }),
        }
      );

      if (!response.ok) {
        setAdminRegistrationEnabled(!checked);
        throw new Error('Failed to update setting');
      } else {
        toast.success(checked ? 'Cadastro de administradores ativado' : 'Cadastro de administradores desativado');
      }
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const fetchUserStats = async () => {
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

      if (!response.ok) return;

      const data = await response.json();
      if (data.users) {
        const admins = data.users.filter((u: any) => u.role === 'admin' || u.role === 'super_admin').length;
        const drivers = data.users.filter((u: any) => u.role !== 'admin' && u.role !== 'super_admin').length;
        setUserStats({ admins, drivers, total: data.users.length });
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  useEffect(() => {
    if (trips.length > 0) {
      calculateVehicleStats();
    }
  }, [trips]);

  const fetchAllTrips = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/trips`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
          },
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error(data.error || 'Failed to fetch trips');
      }

      const uniqueTripsMap = new Map();
      if (Array.isArray(data.trips)) {
        data.trips.forEach((trip: Trip) => {
          uniqueTripsMap.set(trip.id, trip);
        });
      }
      
      const uniqueTrips = Array.from(uniqueTripsMap.values()) as Trip[];
      setTrips(uniqueTrips.sort((a: Trip, b: Trip) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar viagens');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/admin/vehicles`;
      
      const response = await fetch(url, {
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${publicAnonKey}`,
          'x-access-token': accessToken,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Invalid JSON response');
      }
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error(data.error || 'Failed to fetch vehicles');
      }

      const uniqueVehiclesMap = new Map();
      if (Array.isArray(data.vehicles)) {
        data.vehicles.forEach((vehicle: Vehicle) => {
          if (vehicle && vehicle.plate) {
            uniqueVehiclesMap.set(vehicle.plate, vehicle);
          }
        });
      }
      
      setVehicles(Array.from(uniqueVehiclesMap.values()) as Vehicle[]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar veículos');
      setVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleDeleteVehicle = async (plate: string) => {
    if (!confirm(`Tem certeza que deseja excluir o veículo ${plate}?`)) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles/${plate}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete vehicle');

      toast.success('Veículo excluído com sucesso!');
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir veículo');
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta viagem?')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/trips/${tripId}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': publicAnonKey,
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete trip');

      toast.success('Viagem excluída com sucesso!');
      setTrips(prevTrips => prevTrips.filter(t => t.id !== tripId));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir viagem');
    }
  };

  const calculateVehicleStats = () => {
    const statsMap = new Map<string, VehicleStats>();

    trips.forEach(trip => {
      const existing = statsMap.get(trip.vehiclePlate);
      
      if (existing) {
        existing.totalTrips++;
        if (trip.kmEnd) {
          existing.totalKm += (trip.kmEnd - trip.kmStart);
        }
        if (trip.status === 'in_progress') {
          existing.activeTrips++;
        }
      } else {
        statsMap.set(trip.vehiclePlate, {
          plate: trip.vehiclePlate,
          model: trip.vehicleModel,
          color: trip.vehicleColor,
          totalTrips: 1,
          totalKm: trip.kmEnd ? (trip.kmEnd - trip.kmStart) : 0,
          activeTrips: trip.status === 'in_progress' ? 1 : 0,
        });
      }
    });

    setVehicleStats(Array.from(statsMap.values()));
  };

  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const totalKm = completedTrips.reduce((sum, trip) => sum + (trip.kmEnd! - trip.kmStart), 0);
  const drivers = Array.from(new Set(trips.map(t => t.userName).filter(Boolean))).sort() as string[];
  const uniqueVehiclesMap = new Map();
  trips.forEach(t => {
    if (!uniqueVehiclesMap.has(t.vehiclePlate)) {
      uniqueVehiclesMap.set(t.vehiclePlate, { plate: t.vehiclePlate, model: t.vehicleModel });
    }
  });
  const filterVehicles = Array.from(uniqueVehiclesMap.values()) as { plate: string, model: string }[];

  const filteredTrips = trips.filter(trip => {
    const matchDriver = filters.driverName ? trip.userName === filters.driverName : true;
    const matchVehicle = filters.vehicle ? trip.vehiclePlate === filters.vehicle : true;
    const matchDate = filters.date ? trip.timeStart.startsWith(filters.date) || trip.createdAt.startsWith(filters.date) : true;
    return matchDriver && matchVehicle && matchDate;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 bg-white-100 rounded-lg overflow-hidden">
                <img 
                  src="/logo.png" 
                  alt="Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Frota - Admin</h1>
                <p className="text-xs text-gray-600">Olá, {user.user_metadata.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <InstallPWA />
              <Badge variant={user.user_metadata.role === 'super_admin' ? 'outline' : 'default'} className={`text-xs px-2 py-0.5 hidden sm:inline-flex ${user.user_metadata.role === 'super_admin' ? 'border-amber-500 text-amber-700 bg-amber-50' : ''}`}>
                {user.user_metadata.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </Badge>
              <ChangePasswordDialog onUpdatePassword={onUpdatePassword} />
              <Button variant="ghost" size="icon" onClick={onLogout} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">Usuários</CardDescription>
              <CardTitle className="text-2xl flex items-end gap-1.5">
                {userStats.total}
                <span className="text-xs font-normal text-muted-foreground mb-0.5">({userStats.admins})</span>
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">Veículos</CardDescription>
              <CardTitle className="text-2xl">{vehiclesLoading ? '-' : vehicles.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">Viagens</CardDescription>
              <CardTitle className="text-2xl">{trips.length}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">Ativas</CardDescription>
              <CardTitle className="text-2xl text-blue-600">{activeTrips.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">Concluídas</CardDescription>
              <CardTitle className="text-2xl text-green-600">{completedTrips.length}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">KM Total</CardDescription>
              <CardTitle className="text-2xl">{totalKm.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="trips" className="space-y-4">
          <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 gap-1 h-auto p-1">
            <TabsTrigger value="trips" className="text-xs px-2 py-2">Viagens</TabsTrigger>
            <TabsTrigger value="users" className="text-xs px-2 py-2">Usuários</TabsTrigger>
            <TabsTrigger value="monitor" className="text-xs px-2 py-2">Monitor</TabsTrigger>
            <TabsTrigger value="maintenance" className="text-xs px-2 py-2">Manutenção</TabsTrigger>
            <TabsTrigger value="register" className="text-xs px-2 py-2">Cadastrar</TabsTrigger>
            <TabsTrigger value="vehicles" className="text-xs px-2 py-2">Frota</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs px-2 py-2">Stats</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs px-2 py-2">Config</TabsTrigger>
          </TabsList>

          <TabsContent value="trips">
            <TripFilters onFilterChange={setFilters} drivers={drivers} vehicles={filterVehicles} />
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Histórico de Viagens</CardTitle>
                    <CardDescription>
                      {filteredTrips.length !== trips.length 
                        ? `Mostrando ${filteredTrips.length} de ${trips.length} viagens`
                        : 'Todas as viagens registradas no sistema'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : filteredTrips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {trips.length === 0 
                      ? 'Nenhuma viagem registrada ainda.'
                      : 'Nenhuma viagem encontrada com os filtros selecionados.'}
                  </div>
                ) : (
                  <TripList trips={filteredTrips} showDriverName={true} viewMode="table" onDeleteTrip={handleDeleteTrip} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Usuários do Sistema
                </CardTitle>
                <CardDescription>Lista completa de administradores e motoristas cadastrados.</CardDescription>
              </CardHeader>
              <CardContent>
                <UserList accessToken={accessToken} currentUser={user} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitor">
            <Card className="border-orange-200 bg-orange-50/30">
               <div className="p-4 text-center">Monitoramento de frota disponível</div>
            </Card>
          </TabsContent>
          
          <TabsContent value="maintenance">
             <MaintenanceAlerts projectId={projectId} accessToken={accessToken} trips={trips} />
          </TabsContent>
          
          <TabsContent value="register">
             <VehicleForm onVehicleCreated={fetchVehicles} projectId={projectId} accessToken={accessToken} />
          </TabsContent>
          
          <TabsContent value="vehicles">
             <Card>
               <CardHeader><CardTitle>Frota Cadastrada</CardTitle></CardHeader>
               <CardContent>
                 <VehicleList 
                   vehicles={vehicles} 
                   onDelete={handleDeleteVehicle} 
                   onEdit={setEditingVehicle} 
                   isAdmin={true} 
                 />
               </CardContent>
             </Card>
          </TabsContent>
          
          <TabsContent value="stats">
            <div className="text-center py-8 text-gray-500">Estatísticas detalhadas em breve.</div>
          </TabsContent>
          
          <TabsContent value="settings">
             <Card>
              <CardHeader><CardTitle>Configurações</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <Label htmlFor="admin-registration">Cadastro de Administradores</Label>
                  <Switch id="admin-registration" checked={adminRegistrationEnabled} onCheckedChange={toggleAdminRegistration} />
                </div>
              </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </main>
      
       <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
            <DialogDescription>Atualize as informações do veículo.</DialogDescription>
          </DialogHeader>
          {editingVehicle && (
             <VehicleForm onVehicleCreated={() => { setEditingVehicle(null); fetchVehicles(); }} projectId={projectId} accessToken={accessToken} initialData={editingVehicle} isEditing={true} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}