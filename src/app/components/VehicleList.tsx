import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Trash2, Edit, Unlock, Fuel } from 'lucide-react';
import { toast } from 'sonner';

interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: string;
  createdAt: string;
  fuelLevel?: number; // 0-100
  lastFuelUpdate?: string;
  lastFuelUpdateBy?: string;
  isAvailable?: boolean;
  activeTrip?: {
    id: string;
    userName: string;
    timeStart: string;
  } | null;
}

interface VehicleListProps {
  vehicles: Vehicle[];
  onDelete?: (plate: string) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onForceUnlock?: (tripId: string) => void;
  onUpdateFuel?: (plate: string, level: number) => Promise<void>;
  isAdmin?: boolean; 
}

const FuelGauge = ({ level }: { level: number }) => {
  // Divide em 4 quartos
  // 0 = Vazio
  // 1 = 1/4
  // 2 = 1/2
  // 3 = 3/4
  // 4 = 4/4 (Cheio)
  const quarters = Math.ceil((level || 0) / 25);

  // Helper para cor baseada na posição do bloco (de baixo para cima, 1 a 4)
  const getBlockColor = (position: number) => {
    if (position === 1) return 'bg-red-500';    // 1/4 - Reserva
    if (position === 2) return 'bg-yellow-400'; // 1/2 - Médio
    if (position === 3) return 'bg-green-500';  // 3/4 - Bom
    if (position === 4) return 'bg-green-600';  // 4/4 - Cheio
    return 'bg-gray-200';
  };

  const getLabel = () => {
    if (level <= 5) return "Reserva";
    if (level <= 35) return "1/4";
    if (level <= 60) return "1/2";
    if (level <= 85) return "3/4";
    return "4/4";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-col gap-[2px] w-5 p-0.5 bg-gray-100 rounded border border-gray-200 shadow-sm" title={`${level}%`}>
        {[4, 3, 2, 1].map((pos) => {
          const isActive = quarters >= pos;
          return (
            <div
              key={pos}
              className={`h-2.5 w-full rounded-[1px] transition-all duration-300 ${
                isActive ? getBlockColor(pos) : 'bg-gray-200'
              }`}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-bold text-gray-600 w-full text-center whitespace-nowrap">
        {getLabel()}
      </span>
    </div>
  );
};

export function VehicleList({ vehicles, onDelete, onEdit, onForceUnlock, onUpdateFuel, isAdmin = false }: VehicleListProps) {
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [newFuelLevel, setNewFuelLevel] = useState<string>('');

  const handleOpenFuelModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setNewFuelLevel(vehicle.fuelLevel?.toString() || '');
    setFuelModalOpen(true);
  };

  const submitFuelUpdate = async () => {
    if (!selectedVehicle || !onUpdateFuel) return;
    
    const level = parseInt(newFuelLevel);
    if (isNaN(level) || level < 0 || level > 100) {
      toast.error("Por favor, insira um valor entre 0 e 100");
      return;
    }

    await onUpdateFuel(selectedVehicle.plate, level);
    setFuelModalOpen(false);
  };

  const quickSelect = (val: number) => {
    setNewFuelLevel(val.toString());
  };

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum veículo cadastrado ainda.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.plate}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                {/* Left Side: Gauge */}
                <div className="pt-1">
                   <FuelGauge level={vehicle.fuelLevel || 0} />
                </div>

                {/* Middle: Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-medium text-base">{vehicle.brand} {vehicle.model}</h3>
                    <Badge variant="secondary" className="text-xs">{vehicle.year}</Badge>
                    {typeof vehicle.isAvailable !== 'undefined' && (
                      <Badge variant={vehicle.isAvailable ? "outline" : "destructive"} className={`text-[10px] px-1.5 py-0 ${vehicle.isAvailable ? "bg-green-50 text-green-700 border-green-200" : ""}`}>
                        {vehicle.isAvailable ? "Disponível" : "Em Uso"}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-2 space-y-0.5">
                    <div className="flex items-center gap-3">
                       <span>Placa: <span className="font-medium text-gray-700">{vehicle.plate}</span></span>
                       <span>Cor: {vehicle.color}</span>
                    </div>
                    {vehicle.lastFuelUpdateBy && (
                       <div className="text-[10px] text-gray-400">
                         Refuel: {vehicle.lastFuelUpdateBy.split(' ')[0]}
                       </div>
                    )}
                  </div>

                  {!vehicle.isAvailable && vehicle.activeTrip && (
                     <div className="text-xs bg-red-50 p-1.5 rounded text-red-700 border border-red-100 flex items-center gap-2">
                        <span className="font-semibold">Motorista:</span> {vehicle.activeTrip.userName}
                     </div>
                  )}
                </div>
                
                {/* Right: Actions */}
                <div className="flex flex-col gap-1 pl-2 border-l border-gray-100 ml-1">
                  {onUpdateFuel && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenFuelModal(vehicle)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-8 w-8"
                      title="Atualizar Combustível"
                    >
                      <Fuel className="h-4 w-4" />
                    </Button>
                  )}

                  {isAdmin && (
                    <>
                      {onForceUnlock && !vehicle.isAvailable && vehicle.activeTrip && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onForceUnlock(vehicle.activeTrip!.id)}
                          className="text-orange-600 hover:bg-orange-50 h-8 w-8"
                          title="Forçar Liberação"
                        >
                          <Unlock className="h-4 w-4" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(vehicle)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8"
                          title="Editar Veículo"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(vehicle.plate)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                          title="Excluir Veículo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={fuelModalOpen} onOpenChange={setFuelModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Atualizar Nível</DialogTitle>
            <DialogDescription>
              Selecione o nível aproximado do tanque do {selectedVehicle?.model}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            
            {/* Quick Select Buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button 
                variant={parseInt(newFuelLevel) === 25 ? "default" : "outline"}
                className={`text-xs ${parseInt(newFuelLevel) === 25 ? 'bg-red-600 hover:bg-red-700' : 'text-red-600 border-red-200 hover:bg-red-50'}`}
                onClick={() => quickSelect(25)}
              >
                1/4
              </Button>
              <Button 
                variant={parseInt(newFuelLevel) === 50 ? "default" : "outline"}
                className={`text-xs ${parseInt(newFuelLevel) === 50 ? 'bg-yellow-500 hover:bg-yellow-600' : 'text-yellow-600 border-yellow-200 hover:bg-yellow-50'}`}
                onClick={() => quickSelect(50)}
              >
                1/2
              </Button>
              <Button 
                variant={parseInt(newFuelLevel) === 75 ? "default" : "outline"}
                className={`text-xs ${parseInt(newFuelLevel) === 75 ? 'bg-green-600 hover:bg-green-700' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                onClick={() => quickSelect(75)}
              >
                3/4
              </Button>
              <Button 
                variant={parseInt(newFuelLevel) === 100 ? "default" : "outline"}
                className={`text-xs ${parseInt(newFuelLevel) === 100 ? 'bg-green-700 hover:bg-green-800' : 'text-green-700 border-green-200 hover:bg-green-50'}`}
                onClick={() => quickSelect(100)}
              >
                4/4
              </Button>
            </div>
            
            <div className="relative">
               <div className="absolute inset-0 flex items-center">
                 <span className="w-full border-t border-gray-200" />
               </div>
               <div className="relative flex justify-center text-xs uppercase">
                 <span className="bg-white px-2 text-muted-foreground">Ou informe manual</span>
               </div>
             </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fuel-level" className="text-right text-xs">
                Porcentagem
              </Label>
              <Input
                id="fuel-level"
                type="number"
                min="0"
                max="100"
                value={newFuelLevel}
                onChange={(e) => setNewFuelLevel(e.target.value)}
                className="col-span-3 h-9"
                placeholder="Ex: 75"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submitFuelUpdate} disabled={newFuelLevel === ''}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}