import { useState, useEffect } from 'react';
import { User } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';
import { TripForm } from './TripForm';
import { TripList } from './TripList';
import { LogOut, Plus, List, CircleAlert, RefreshCw, History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { InstallPWA } from './InstallPWA';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

import { ChangePasswordDialog } from './ChangePasswordDialog';

// Ajuste para ambiente local/Vercel
const appIcon = "https://images.unsplash.com/photo-1559497056-fe4dab665446?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsb2dpc3RpY3MlMjBmbGVldCUyMG1hbmFnZW1lbnQlMjBsb2dvJTIwbWluaW1hbGlzdCUyMHZlY3RvciUyMHN0eWxlfGVufDF8fHx8MTc3MDU5OTkwM3ww&ixlib=rb-4.1.0&q=80&w=1080";

interface DriverDashboardProps {
  user: User;
  accessToken: string;
  onLogout: () => void;
  onUpdatePassword: (password: string) => Promise<void>;
}

interface Trip {
  id: string;
  userId: string;
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

interface MaintenanceInfo {
  plate: string;
  totalKm: number;
  lastOilChange: number;
  kmSinceOilChange: number;
  needsOilChange: boolean;
}

export function DriverDashboard({ user, accessToken, onLogout, onUpdatePassword }: DriverDashboardProps) {
  const [showTripForm, setShowTripForm] = useState(false);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceInfo[]>([]);

  // Filter all active trips
  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const completedTrips = trips.filter(t => t.status === 'completed');

  useEffect(() => {
    console.log('=== DRIVER DASHBOARD MOUNTED ===');
    console.log('User:', user);
    console.log('Access token:', accessToken ? `${accessToken.substring(0, 30)}...` : 'MISSING');
    fetchTrips();
  }, []);

  useEffect(() => {
    if (trips.length > 0) {
      checkMaintenanceAlerts();
    }
  }, [trips]);

  const fetchTrips = async () => {
    try {
      console.log('=== FETCHING TRIPS ===');
      console.log('Access token for request:', accessToken ? 'Present' : 'MISSING');
      
      let response;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/trips?t=${new Date().getTime()}`,
            {
              headers: {
                'apikey': publicAnonKey, 
                'Authorization': `Bearer ${publicAnonKey}`, // Use Anon Key for Gateway auth
                'x-access-token': accessToken, // User token for backend logic
                'Cache-Control': 'no-cache',
                'Figma': 'no-cache' 
              },
            }
          );
          if (response) break;
        } catch (fetchError) {
          attempts++;
          console.warn(`Fetch trips attempt ${attempts} failed:`, fetchError);
          if (attempts >= maxAttempts) throw fetchError;
          await new Promise(r => setTimeout(r, 1000)); // Wait 1s between retries
        }
      }

      if (!response) throw new Error('Falha na conexão com o servidor');

      console.log('Fetch trips response status:', response.status);
      
      if (!response.ok) {
        const data = await response.json();
        console.log('Fetch trips response data:', data);
        
        if (response.status === 401) {
          // If error is "Invalid JWT", it's a gateway/key issue, not session expiry
          if (data.message === 'Invalid JWT') {
            console.error('Invalid JWT error from Gateway - Check Supabase Keys');
            throw new Error('Erro de configuração do servidor (Invalid JWT). Contate o suporte.');
          }
          
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error(data.error || 'Failed to fetch trips');
      }

      const data = await response.json();
      console.log('Fetch trips response data:', data);

      setTrips(data.trips.sort((a: Trip, b: Trip) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error: any) {
      console.error('Error fetching trips:', error);
      // Only show toast if it's not a 401 (already handled)
      if (error.message !== 'Failed to fetch trips' || !error.message.includes('Sessão expirada')) {
         let errorMessage = error.message || 'Erro ao carregar viagens';
         if (errorMessage === 'Failed to fetch') {
           errorMessage = 'Erro de conexão. Tentando reconectar...';
           // Optionally trigger another retry or just inform user
         }
         toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkMaintenanceAlerts = async () => {
    const uniquePlates = [...new Set(trips.map(t => t.vehiclePlate))];
    const alerts: MaintenanceInfo[] = [];

    for (const plate of uniquePlates) {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles/${plate}/maintenance`,
          {
            headers: {
              'apikey': publicAnonKey,
              'Authorization': `Bearer ${publicAnonKey}`,
              'x-access-token': accessToken,
            },
          }
        );

        const data = await response.json();
        
        if (response.ok && data.needsOilChange) {
          alerts.push(data);
        }
      } catch (error) {
        console.error('Error checking maintenance:', error);
      }
    }

    setMaintenanceAlerts(alerts);
  };

  const handleCreateTrip = async (tripData: any) => {
    try {
      console.log('=== CREATING TRIP ===');
      console.log('Trip data:', tripData);
      console.log('Access token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'none');
      
      // Retry logic for robust connection
      let response;
      let attempts = 0;
      const maxAttempts = 2;
      
      while (attempts < maxAttempts) {
        try {
          response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/trips`,
            {
              method: 'POST',
              headers: {
                'apikey': publicAnonKey,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicAnonKey}`,
                'x-access-token': accessToken,
              },
              body: JSON.stringify(tripData),
            }
          );
          
          // If we got a response (even 4xx/5xx), break the retry loop
          break;
        } catch (fetchError) {
          attempts++;
          console.warn(`Attempt ${attempts} failed:`, fetchError);
          if (attempts >= maxAttempts) throw fetchError;
          // Wait 500ms before retry
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (!response) throw new Error('Falha na conexão com o servidor');

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error(data.error || 'Failed to create trip');
      }

      toast.success('Viagem iniciada com sucesso!');
      setShowTripForm(false);
      fetchTrips();
    } catch (error: any) {
      console.error('Error creating trip:', error);
      
      let errorMessage = error.message || 'Erro ao iniciar viagem';
      if (errorMessage === 'Failed to fetch' || errorMessage.includes('NetworkError')) {
        errorMessage = 'Erro de conexão. Verifique sua internet ou tente novamente em alguns instantes.';
      }
      
      toast.error(errorMessage);
      // Don't rethrow to avoid crashing the UI flow
    }
  };

  const handleCompleteTrip = async (tripId: string, kmEnd: number, timeEnd: string) => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/trips/${tripId}/complete`,
        {
          method: 'PUT',
          headers: {
            'apikey': publicAnonKey,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
          },
          body: JSON.stringify({ kmEnd, timeEnd }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error(data.error || 'Failed to complete trip');
      }

      toast.success('Viagem finalizada com sucesso!');
      
      // Update local state immediately with the returned data
      if (data.trip) {
        if (data.trip.status !== 'completed') {
          console.warn('Trip completed but status not updated in response');
        }
        
        setTrips(prevTrips => prevTrips.map(t => 
          t.id === tripId ? data.trip : t
        ));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar viagem');
      throw error;
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
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

      toast.success('Viagem cancelada com sucesso!');
      
      // Remove from local state
      setTrips(prevTrips => prevTrips.filter(t => t.id !== tripId));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar viagem');
      throw error;
    }
  };

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
                <h1 className="text-lg font-bold text-gray-900">Sistema de Frota</h1>
                <p className="text-xs text-gray-600">Olá, {user.user_metadata.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <InstallPWA />
              <Badge variant="outline" className="text-xs px-2 py-0.5">Motorista</Badge>
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
        {/* Maintenance Alerts */}
        {maintenanceAlerts.length > 0 && (
          <div className="mb-4 space-y-3">
            {maintenanceAlerts.map((alert) => (
              <Alert key={alert.plate} variant="destructive" className="py-3">
                <CircleAlert className="h-4 w-4" />
                <AlertTitle className="text-sm">Alerta de Manutenção</AlertTitle>
                <AlertDescription className="text-xs">
                  Veículo <strong>{alert.plate}</strong> precisa de troca de óleo! 
                  ({alert.kmSinceOilChange.toLocaleString()} km desde a última troca)
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mb-4">
          {activeTrips.length === 0 ? (
            <Button onClick={() => setShowTripForm(!showTripForm)} className="flex items-center gap-2 w-full h-11">
              <Plus className="h-4 w-4" />
              Iniciar Nova Viagem
            </Button>
          ) : (
             <div className="p-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 text-sm flex items-center gap-2">
              <CircleAlert className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs">
                Você possui {activeTrips.length > 1 ? `${activeTrips.length} viagens` : 'uma viagem'} em andamento. Finalize-as ou cancele-as para iniciar uma nova.
              </span>
            </div>
          )}
        </div>

        {/* Trip Form */}
        {showTripForm && activeTrips.length === 0 && (
          <div className="mb-4">
            <TripForm
              driverName={user.user_metadata.name}
              accessToken={accessToken}
              onSubmit={handleCreateTrip}
              onCancel={() => setShowTripForm(false)}
            />
          </div>
        )}

        {/* Trip List with Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="active" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span>Em Andamento ({activeTrips.length})</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span>Histórico</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <List className="h-4 w-4" />
                      Viagens em Andamento
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {activeTrips.length} {activeTrips.length === 1 ? 'viagem ativa' : 'viagens ativas'}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setLoading(true);
                      fetchTrips();
                    }}
                    title="Atualizar lista"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : activeTrips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhuma viagem em andamento.
                  </div>
                ) : (
                  <TripList 
                    trips={activeTrips} 
                    onCompleteTrip={handleCompleteTrip} 
                    onDeleteTrip={handleDeleteTrip}
                    showDriverName={false} 
                    viewMode="table" 
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-4 w-4" />
                  Histórico de Viagens
                </CardTitle>
                <CardDescription className="text-xs">
                  Minhas viagens concluídas ({completedTrips.length})
                </CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : completedTrips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhum histórico de viagens.
                  </div>
                ) : (
                  <TripList 
                    trips={completedTrips} 
                    // No actions for history items
                    showDriverName={false} 
                    viewMode="table" 
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <div className="py-4 text-center">
        <p className="text-xs text-gray-400">Desenvolvido por Elenilton Felix</p>
      </div>
    </div>
  );
}