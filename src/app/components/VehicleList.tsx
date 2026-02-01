import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trash2, Edit, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

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

interface VehicleListProps {
  vehicles: Vehicle[];
  onDelete: (plate: string) => void;
  onEdit?: (vehicle: Vehicle) => void;
  onForceUnlock?: (tripId: string) => void;
  isAdmin?: boolean;
}

export function VehicleList({ vehicles, onDelete, onEdit, onForceUnlock, isAdmin = false }: VehicleListProps) {
  if (vehicles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum veículo cadastrado ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {vehicles.map((vehicle) => (
        <Card key={vehicle.plate}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-medium">{vehicle.brand} {vehicle.model}</h3>
                  <Badge variant="secondary">{vehicle.year}</Badge>
                  {typeof vehicle.isAvailable !== 'undefined' && (
                    <Badge variant={vehicle.isAvailable ? "outline" : "destructive"} className={vehicle.isAvailable ? "bg-green-50 text-green-700 border-green-200" : ""}>
                      {vehicle.isAvailable ? "Disponível" : "Em Uso"}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Placa:</span> {vehicle.plate}
                  </div>
                  <div>
                    <span className="font-medium">Cor:</span> {vehicle.color}
                  </div>
                </div>
                {!vehicle.isAvailable && vehicle.activeTrip && (
                   <div className="mt-2 text-xs bg-red-50 p-2 rounded text-red-700 border border-red-100">
                      <span className="font-semibold">Motorista:</span> {vehicle.activeTrip.userName}
                   </div>
                )}
              </div>
              
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {onForceUnlock && !vehicle.isAvailable && vehicle.activeTrip && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onForceUnlock(vehicle.activeTrip!.id)}
                      className="text-orange-600 border-orange-200 hover:bg-orange-50 mr-2"
                      title="Forçar Liberação"
                    >
                      <Unlock className="h-4 w-4 mr-1" />
                      Liberar
                    </Button>
                  )}
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(vehicle)}
                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(vehicle.plate)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
