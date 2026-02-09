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

interface DriverDashboardProps {
  user: User;
  accessToken: string;
  onLogout: () => void;
  onUpdatePassword: (password: string) => Promise<void>;
}

// ... Interfaces mantidas ...
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

  const activeTrips = trips.filter(t => t.status === 'in_progress');
  const completedTrips = trips.filter(t => t.status === 'completed');

  useEffect(() => {
    fetchTrips();
  }, []);

  useEffect(() => {
    if (trips.length > 0) {
      checkMaintenanceAlerts();
    }
  }, [trips]);

  const fetchTrips = async () => {
    try {
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
                'Authorization': `Bearer ${publicAnonKey}`,
                'x-access-token': accessToken,
                'Cache-Control': 'no-cache',
              },
            }
          );
          if (response) break;
        } catch (fetchError) {
          attempts++;
          if (attempts >= maxAttempts) throw fetchError;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!response || !response.ok) {
        if (response?.status === 401) {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          onLogout();
          return;
        }
        throw new Error('Falha ao carregar viagens');
      }

      const data = await response.json();
      setTrips(data.trips.sort((a: Trip, b: Trip) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error: any) {
      // Silently handle generic fetch errors to avoid spamming toast
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
      const response = await fetch(
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

      if (!response.ok) {
        throw new Error('Falha ao criar viagem');
      }

      toast.success('Viagem iniciada com sucesso!');
      setShowTripForm(false);
      fetchTrips();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao iniciar viagem');
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
        throw new Error(data.error || 'Failed to complete trip');
      }

      toast.success('Viagem finalizada com sucesso!');
      if (data.trip) {
        setTrips(prevTrips => prevTrips.map(t => t.id === tripId ? data.trip : t));
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao finalizar viagem');
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

      if (!response.ok) throw new Error('Failed to delete trip');

      toast.success('Viagem cancelada com sucesso!');
      setTrips(prevTrips => prevTrips.filter(t => t.id !== tripId));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cancelar viagem');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Logo Local /logo.png */}
              <div className="bg-blue-50 p-2 rounded-xl overflow-hidden border border-blue-100 flex items-center justify-center shadow-sm w-10 h-10">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
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

      <main className="max-w-7xl mx-auto px-3 py-4">
        {maintenanceAlerts.length > 0 && (
          <div className="mb-4 space-y-3">
            {maintenanceAlerts.map((alert) => (
              <Alert key={alert.plate} variant="destructive" className="py-3">
                <CircleAlert className="h-4 w-4" />
                <AlertTitle className="text-sm">Alerta de Manutenção</AlertTitle>
                <AlertDescription className="text-xs">
                  Veículo <strong>{alert.plate}</strong> precisa de troca de óleo!
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

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
                Você possui {activeTrips.length > 1 ? `${activeTrips.length} viagens` : 'uma viagem'} em andamento.
              </span>
            </div>
          )}
        </div>

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
                      {activeTrips.length} viagens ativas
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