import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { RefreshCw } from 'lucide-react';

interface Vehicle {
  plate: string;
  model: string;
  color: string;
  year: string;
  brand: string;
  isAvailable?: boolean;
  activeTrip?: {
    userName?: string;
  };
}

interface TripFormProps {
  driverName: string;
  accessToken: string;
  onSubmit: (data: {
    vehiclePlate: string;
    vehicleColor: string;
    vehicleModel: string;
    kmStart: number;
    timeStart: string;
    destination: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export function TripForm({ driverName, accessToken, onSubmit, onCancel }: TripFormProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [kmStart, setKmStart] = useState('');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setError(null);
      // Add timestamp to prevent caching
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles?t=${new Date().getTime()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'x-access-token': accessToken,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        // Ensure uniqueness by plate to avoid duplicate key errors
        const uniqueVehicles = Array.from(
          new Map((data.vehicles || []).map((v: Vehicle) => [v.plate, v])).values()
        ) as Vehicle[];
        setVehicles(uniqueVehicles);
      } else {
        setError(data.error || 'Erro ao carregar veículos');
        console.error('API Error:', data.error);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      setError('Erro de conexão ao buscar veículos');
    } finally {
      setLoadingVehicles(false);
    }
  };

  const handleVehicleSelect = async (plate: string) => {
    const vehicle = vehicles.find(v => v.plate === plate);
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setVehiclePlate(vehicle.plate);
      setVehicleColor(vehicle.color);
      setVehicleModel(`${vehicle.brand} ${vehicle.model}`);
      
      // Auto-fetch last odometer reading
      setKmStart('Carregando...');
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles/${plate}/last-trip`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'x-access-token': accessToken,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.lastOdometer) {
            setKmStart(String(data.lastOdometer));
          } else {
            setKmStart(''); // No previous trips
          }
        } else {
          setKmStart('');
        }
      } catch (error) {
        console.error('Error fetching last odometer:', error);
        setKmStart('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Validate inputs
    const km = Number(kmStart);
    if (isNaN(km) || km < 0) {
      // This should be handled by HTML validation but good to be safe
      setLoading(false);
      return; 
    }

    try {
      await onSubmit({
        vehiclePlate: vehiclePlate.toUpperCase(),
        vehicleColor,
        vehicleModel,
        kmStart: km,
        timeStart: new Date().toISOString(),
        destination,
      });
    } catch (error) {
      // Error is handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Nova Viagem</CardTitle>
            <CardDescription className="text-sm">Motorista: {driverName}</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground" 
            onClick={() => {
              setLoadingVehicles(true);
              fetchVehicles();
            }}
            title="Atualizar lista de veículos"
          >
            <RefreshCw className={`h-4 w-4 ${loadingVehicles ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vehicleSelect" className="text-sm">Selecione o Veículo *</Label>
              {loadingVehicles ? (
                <div className="text-xs text-gray-500">Carregando veículos...</div>
              ) : error ? (
                <div className="text-xs text-red-500 p-2 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              ) : vehicles.length === 0 ? (
                <div className="text-xs text-gray-500 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                  Nenhum veículo cadastrado. Entre em contato com o administrador.
                </div>
              ) : (
                <Select onValueChange={handleVehicleSelect} required>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Escolha um veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((vehicle) => {
                      const isUnavailable = vehicle.isAvailable === false; // Explicit check
                      return (
                        <SelectItem 
                          key={vehicle.plate} 
                          value={vehicle.plate}
                          disabled={isUnavailable}
                          className={isUnavailable ? "opacity-50" : ""}
                        >
                          <div className="flex flex-col">
                            <span>{vehicle.plate} - {vehicle.brand} {vehicle.model}</span>
                            {isUnavailable && (
                              <span className="text-[10px] text-red-500 font-medium">
                                Aguarde até motorista finalizar o trajeto
                                {vehicle.activeTrip?.userName ? ` (${vehicle.activeTrip.userName})` : ''}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vehiclePlate" className="text-sm">Placa</Label>
                <Input
                  id="vehiclePlate"
                  type="text"
                  value={vehiclePlate}
                  disabled
                  className="bg-gray-100 h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vehicleColor" className="text-sm">Cor</Label>
                <Input
                  id="vehicleColor"
                  type="text"
                  value={vehicleColor}
                  disabled
                  className="bg-gray-100 h-10 text-sm"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="vehicleModel" className="text-sm">Modelo</Label>
              <Input
                id="vehicleModel"
                type="text"
                value={vehicleModel}
                disabled
                className="bg-gray-100 h-10 text-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="kmStart" className="text-sm">KM Inicial *</Label>
                <Input
                  id="kmStart"
                  type="number"
                  placeholder="50000"
                  value={kmStart}
                  onChange={(e) => setKmStart(e.target.value)}
                  required
                  min="0"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination" className="text-sm">Destino *</Label>
                <Input
                  id="destination"
                  type="text"
                  placeholder="São Paulo - SP"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <Button 
              type="submit" 
              className="flex-1 h-10" 
              disabled={loading || !selectedVehicle}
            >
              {loading ? 'Iniciando...' : 'Iniciar Viagem'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="h-10">
              Cancelar
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}