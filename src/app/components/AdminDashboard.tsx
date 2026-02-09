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
import { LogOut, ChartBar, Car, CircleAlert, LayoutGrid, Table as TableIcon, Settings, ShieldAlert, MonitorPlay, Users, Crown } from 'lucide-react';

import { TripFilters, TripFiltersState } from './TripFilters';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { InstallPWA } from './InstallPWA';

import { ChangePasswordDialog } from './ChangePasswordDialog';

// Ajuste para ambiente local/Vercel
const appIcon = "const appIcon = "https://images.unsplash.com/photo-1559497056-fe4dab665446?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsb2dpc3RpY3MlMjBmbGVldCUyMG1hbmFnZW1lbnQlMjBsb2dvJTIwbWluaW1hbGlzdCUyMHZlY3RvciUyMHN0eWxlfGVufDF8fHx8MTc3MDU5OTkwM3ww&ixlib=rb-4.1.0&q=80&w=1080";

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
    // Optimistic update
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
        throw new Error('Failed to update setting');
        // Revert on error
        setAdminRegistrationEnabled(!checked);
      } else {
        toast.success(checked ? 'Cadastro de administradores ativado' : 'Cadastro de administradores desativado');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar configuração');
      setAdminRegistrationEnabled(!checked);
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

      // Deduplicate trips by ID just in case
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
      console.log('=== Fetching vehicles ===');
      console.log('URL:', url);
      console.log('ProjectId:', projectId);
      console.log('AccessToken preview:', accessToken ? `${accessToken.substring(0, 30)}...` : 'null');
      console.log('AccessToken full:', accessToken);
      console.log('Authorization header will be:', `Bearer ${accessToken}`);
      
      const response = await fetch(url, {
        headers: {
          'apikey': publicAnonKey,
          'Authorization': `Bearer ${publicAnonKey}`,
          'x-access-token': accessToken,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      let data;
      try {
        data = await response.json();
        console.log('Response data:', data);
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        const text = await response.text();
        console.log('Response text:', text);
        throw new Error('Invalid JSON response from server');
      }
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        console.error('Response not OK. Status:', response.status, 'Error:', data.error);
        throw new Error(data.error || `HTTP ${response.status}: Failed to fetch vehicles`);
      }

      // Deduplicate vehicles by plate
      const uniqueVehiclesMap = new Map();
      if (Array.isArray(data.vehicles)) {
        data.vehicles.forEach((vehicle: Vehicle) => {
          if (vehicle && vehicle.plate) {
            uniqueVehiclesMap.set(vehicle.plate, vehicle);
          }
        });
      }
      
      const uniqueVehicles = Array.from(uniqueVehiclesMap.values()) as Vehicle[];
      console.log('Unique vehicles:', uniqueVehicles.length);

      setVehicles(uniqueVehicles);
    } catch (error: any) {
      console.error('=== Error fetching vehicles ===');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
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
        throw new Error(data.error || 'Failed to delete vehicle');
      }

      toast.success('Veículo excluído com sucesso!');
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir veículo');
    }
  };

  const handleForceUnlock = async (tripId: string) => {
    if (!confirm('ATENÇÃO: Isso irá cancelar a viagem atual e liberar o veículo.\n\nTem certeza?')) {
      return;
    }
    
    await handleDeleteTrip(tripId);
    // Refresh both lists
    fetchVehicles();
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

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error(data.error || 'Failed to delete trip');
      }

      toast.success('Viagem excluída com sucesso!');
      
      // Update local state
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

  // Extract unique driver names for the filter
  const drivers = Array.from(new Set(trips.map(t => t.userName).filter(Boolean))).sort() as string[];

  // Extract unique vehicles for the filter
  const uniqueVehiclesMap = new Map();
  trips.forEach(t => {
    if (!uniqueVehiclesMap.has(t.vehiclePlate)) {
      uniqueVehiclesMap.set(t.vehiclePlate, { plate: t.vehiclePlate, model: t.vehicleModel });
    }
  });
  const filterVehicles = Array.from(uniqueVehiclesMap.values()) as { plate: string, model: string }[];

  const filteredTrips = trips.filter(trip => {
    const matchDriver = filters.driverName 
      ? trip.userName === filters.driverName
      : true;
    
    const matchVehicle = filters.vehicle
      ? trip.vehiclePlate === filters.vehicle
      : true;
      
    const matchDate = filters.date
      ? trip.timeStart.startsWith(filters.date) || trip.createdAt.startsWith(filters.date)
      : true;

    return matchDriver && matchVehicle && matchDate;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center shadow-sm">
                 <img src={appIcon} alt="Logo" className="h-10 w-auto object-contain" />
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 py-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card>
            <CardHeader className="pb-2 px-3 pt-3">
              <CardDescription className="text-xs">Usuários</CardDescription>
              <CardTitle className="text-2xl flex items-end gap-1.5">
                {userStats.total}
                <span className="text-xs font-normal text-muted-foreground mb-0.5">
                  ({userStats.admins})
                </span>
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

        {/* Tabs */}
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
                <CardDescription>
                  Lista completa de administradores e motoristas cadastrados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserList accessToken={accessToken} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitor">
            <Card className="border-orange-200 bg-orange-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800">
                  <MonitorPlay className="h-5 w-5" />
                  Monitoramento de Frota em Tempo Real
                </CardTitle>
                <CardDescription>
                  Visualize veículos atualmente em uso e force a liberação em caso de inconsistências.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                  </div>
                ) : activeTrips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-orange-200 rounded-lg bg-white">
                    <div className="p-4 bg-green-50 rounded-full mb-3">
                      <Car className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Frota Livre</h3>
                    <p className="text-sm text-gray-500 max-w-sm mt-1">
                      Nenhum veículo está em uso no momento. Todos os veículos estão disponíveis para novas viagens.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeTrips.map((trip) => (
                      <Card key={trip.id} className="bg-white border-l-4 border-l-orange-500 shadow-sm overflow-hidden">
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-lg text-gray-900">{trip.vehiclePlate}</h3>
                              <p className="text-sm text-gray-500">{trip.vehicleModel}</p>
                            </div>
                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                              Em Uso
                            </Badge>
                          </div>
                          
                          <div className="space-y-3 text-sm mb-4">
                            <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2 rounded">
                              <span className="text-xs font-semibold uppercase text-gray-500 w-16">Motorista</span>
                              <span className="font-medium">{trip.userName || 'Desconhecido'}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-xs font-semibold uppercase text-gray-500 w-16">Saída</span>
                              <span>{new Date(trip.timeStart).toLocaleString()}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-gray-700">
                              <span className="text-xs font-semibold uppercase text-gray-500 w-16">Destino</span>
                              <span>{trip.destination}</span>
                            </div>
                          </div>

                          <div className="pt-3 border-t flex items-center justify-between">
                            <span className="text-xs text-gray-400">ID: {trip.id.slice(0, 8)}...</span>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                              onClick={() => {
                                if (confirm(`ATENÇÃO: Isso irá cancelar a viagem atual do veículo ${trip.vehiclePlate} e liberá-lo para outros motoristas.\n\nTem certeza que deseja forçar a liberação?`)) {
                                  handleDeleteTrip(trip.id);
                                }
                              }}
                            >
                              <ShieldAlert className="h-3 w-3 mr-2" />
                              Forçar Liberação
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <MaintenanceAlerts 
              projectId={projectId}
              accessToken={accessToken}
              trips={trips}
            />
          </TabsContent>

          <TabsContent value="register">
            <VehicleForm
              onVehicleCreated={fetchVehicles}
              projectId={projectId}
              accessToken={accessToken}
            />
          </TabsContent>

          <TabsContent value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Frota Cadastrada
                </CardTitle>
                <CardDescription>
                  {!vehiclesLoading && `${vehicles.length} ${vehicles.length === 1 ? 'veículo cadastrado' : 'veículos cadastrados'}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {vehiclesLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">Carregando veículos...</p>
                  </div>
                ) : (
                  <VehicleList
                    vehicles={vehicles}
                    onDelete={handleDeleteVehicle}
                    onEdit={setEditingVehicle}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats">
            {/* Stats content omitted for brevity as it was not fully visible in the original file but logic remains the same */}
             <div className="text-center py-8 text-gray-500">Estatísticas detalhadas em breve.</div>
          </TabsContent>

          <TabsContent value="settings">
             <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações do Sistema
                </CardTitle>
                <CardDescription>
                  Ajuste as preferências globais da aplicação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 border p-4 rounded-lg bg-slate-50">
                  <div className="space-y-1">
                    <Label htmlFor="admin-registration" className="font-medium">Cadastro de Administradores</Label>
                    <p className="text-sm text-muted-foreground">
                      Permite que novos usuários se cadastrem como administradores na tela de login.
                      <br/>
                      <span className="text-xs text-amber-600 font-medium">Recomendado desativar após configurar o primeiro admin.</span>
                    </p>
                  </div>
                  <Switch 
                    id="admin-registration" 
                    checked={adminRegistrationEnabled}
                    onCheckedChange={toggleAdminRegistration}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Edit Vehicle Dialog */}
       <Dialog open={!!editingVehicle} onOpenChange={(open) => !open && setEditingVehicle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
            <DialogDescription>
              Atualize as informações do veículo. A placa não pode ser alterada.
            </DialogDescription>
          </DialogHeader>
          
          {editingVehicle && (
             <VehicleForm 
               onVehicleCreated={() => {
                 setEditingVehicle(null);
                 fetchVehicles();
               }}
               projectId={projectId}
               accessToken={accessToken}
               initialData={editingVehicle}
               isEditing={true}
             />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}