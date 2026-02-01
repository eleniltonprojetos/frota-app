import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CircleAlert, CheckCircle, Droplet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { publicAnonKey } from '../../../utils/supabase/info';

interface MaintenanceInfo {
  plate: string;
  totalKm: number;
  lastOilChange: number;
  kmSinceOilChange: number;
  needsOilChange: boolean;
}

interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: string;
}

interface Trip {
  vehiclePlate: string;
  vehicleModel: string;
  status: string;
  kmEnd: number | null;
  kmStart: number;
}

interface MaintenanceAlertsProps {
  projectId: string;
  accessToken: string;
  trips: Trip[];
}

export function MaintenanceAlerts({ projectId, accessToken, trips }: MaintenanceAlertsProps) {
  const [maintenanceData, setMaintenanceData] = useState<Map<string, MaintenanceInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{ plate: string; model: string; totalKm: number } | null>(null);
  const [currentKm, setCurrentKm] = useState('');

  useEffect(() => {
    fetchMaintenanceData();
  }, [trips]);

  const fetchMaintenanceData = async () => {
    try {
      // Get unique vehicle plates from trips
      const vehiclePlates = Array.from(new Set(trips.map(t => t.vehiclePlate)));
      
      const maintenancePromises = vehiclePlates.map(async (plate) => {
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

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return { plate, data };
      });

      const results = await Promise.all(maintenancePromises);
      const newMaintenanceData = new Map<string, MaintenanceInfo>();

      results.forEach((result) => {
        if (result) {
          newMaintenanceData.set(result.plate, result.data);
        }
      });

      setMaintenanceData(newMaintenanceData);
    } catch (error: any) {
      console.error('Error fetching maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordOilChange = async () => {
    if (!selectedVehicle) return;

    const kmValue = parseInt(currentKm);
    if (isNaN(kmValue) || kmValue <= 0) {
      toast.error('Por favor, insira uma quilometragem válida');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles/${selectedVehicle.plate}/oil-change`,
        {
          method: 'POST',
          headers: {
            'apikey': publicAnonKey,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
          },
          body: JSON.stringify({ currentKm: kmValue }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record oil change');
      }

      toast.success('Troca de óleo registrada com sucesso!');
      setDialogOpen(false);
      setCurrentKm('');
      setSelectedVehicle(null);
      fetchMaintenanceData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar troca de óleo');
    }
  };

  const openOilChangeDialog = (plate: string, model: string, totalKm: number) => {
    setSelectedVehicle({ plate, model, totalKm });
    setCurrentKm(totalKm.toString());
    setDialogOpen(true);
  };

  const vehiclesNeedingMaintenance = Array.from(maintenanceData.entries())
    .filter(([_, info]) => info.needsOilChange);

  const vehiclesOk = Array.from(maintenanceData.entries())
    .filter(([_, info]) => !info.needsOilChange);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (maintenanceData.size === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5" />
            Alertas de Manutenção
          </CardTitle>
          <CardDescription>Acompanhamento de troca de óleo da frota</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            Nenhum veículo com histórico de viagens ainda.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplet className="h-5 w-5" />
            Alertas de Manutenção
          </CardTitle>
          <CardDescription>
            Troca de óleo recomendada a cada 10.000 km
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vehicles needing maintenance */}
          {vehiclesNeedingMaintenance.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-red-600 flex items-center gap-2">
                <CircleAlert className="h-4 w-4" />
                Manutenção Necessária ({vehiclesNeedingMaintenance.length})
              </h3>
              {vehiclesNeedingMaintenance.map(([plate, info]) => {
                const trip = trips.find(t => t.vehiclePlate === plate);
                return (
                  <Alert key={plate} variant="destructive">
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle className="mb-2">
                      {trip?.vehicleModel || plate} - {plate}
                    </AlertTitle>
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <p>KM total rodado: <strong>{info.totalKm.toLocaleString()} km</strong></p>
                          <p>Última troca: <strong>{info.lastOilChange.toLocaleString()} km</strong></p>
                          <p>KM desde última troca: <strong className="text-red-700">{info.kmSinceOilChange.toLocaleString()} km</strong></p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openOilChangeDialog(plate, trip?.vehicleModel || plate, info.totalKm)}
                          className="mt-2"
                        >
                          Registrar Troca de Óleo
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                );
              })}
            </div>
          )}

          {/* Vehicles OK */}
          {vehiclesOk.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Em Dia ({vehiclesOk.length})
              </h3>
              <div className="space-y-2">
                {vehiclesOk.map(([plate, info]) => {
                  const trip = trips.find(t => t.vehiclePlate === plate);
                  const progressPercentage = Math.min((info.kmSinceOilChange / 10000) * 100, 100);
                  const kmRemaining = Math.max(10000 - info.kmSinceOilChange, 0);
                  
                  let barColor = 'bg-green-500';
                  let statusText = 'Normal';
                  let cardBorder = 'border-green-200';
                  let cardBg = 'bg-green-50';

                  if (info.kmSinceOilChange >= 8000) {
                    barColor = 'bg-red-500';
                    statusText = 'Próximo da troca';
                    cardBorder = 'border-red-200';
                    cardBg = 'bg-red-50';
                  } else if (info.kmSinceOilChange >= 5000) {
                    barColor = 'bg-orange-500';
                    statusText = 'Atenção';
                    cardBorder = 'border-orange-200';
                    cardBg = 'bg-orange-50';
                  }
                  
                  return (
                    <Card key={plate} className={`${cardBorder} ${cardBg}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-medium">{trip?.vehicleModel || plate}</p>
                            <p className="text-sm text-gray-600">{plate}</p>
                          </div>
                          <Badge variant="outline" className="bg-white">
                            {kmRemaining.toLocaleString()} km restantes
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Progresso até próxima troca</span>
                            <span className={info.kmSinceOilChange >= 8000 ? 'text-red-600 font-bold' : ''}>
                                {Math.round(progressPercentage)}% ({statusText})
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${barColor}`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>KM rodados: {info.kmSinceOilChange.toLocaleString()} km</span>
                            <span>Meta: 10.000 km</span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openOilChangeDialog(plate, trip?.vehicleModel || plate, info.totalKm)}
                          className="mt-3 w-full"
                        >
                          Registrar Troca de Óleo
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Oil Change Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Troca de Óleo</DialogTitle>
            <DialogDescription>
              {selectedVehicle?.model} - {selectedVehicle?.plate}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentKm">Quilometragem Atual do Veículo</Label>
              <Input
                id="currentKm"
                type="number"
                placeholder="Ex: 50000"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                min="0"
              />
              <p className="text-sm text-gray-500">
                Insira a quilometragem atual mostrada no odômetro do veículo
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRecordOilChange}>
              Confirmar Troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
