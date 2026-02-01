import { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Calendar, MapPin, Car, Clock, CircleCheck, Trash2 } from 'lucide-react';

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

interface TripListProps {
  trips: Trip[];
  onCompleteTrip?: (tripId: string, kmEnd: number, timeEnd: string) => Promise<void>;
  onDeleteTrip?: (tripId: string) => Promise<void>;
  showDriverName?: boolean;
  viewMode?: 'card' | 'table';
}

export function TripList({ trips, onCompleteTrip, onDeleteTrip, showDriverName = false, viewMode = 'card' }: TripListProps) {
  const [completingTrip, setCompletingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [kmEnd, setKmEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleComplete = async () => {
    if (!completingTrip || !onCompleteTrip) return;
    
    setLoading(true);
    try {
      await onCompleteTrip(completingTrip.id, Number(kmEnd), new Date().toISOString());
      setCompletingTrip(null);
      setKmEnd('');
    } catch (error) {
      // Error is handled in parent
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTrip || !onDeleteTrip) return;
    
    setDeleteLoading(true);
    try {
      await onDeleteTrip(deletingTrip.id);
      setDeletingTrip(null);
    } catch (error) {
      // Error is handled in parent
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderContent = () => {
    if (viewMode === 'table') {
      return (
        <>
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Veículo</TableHead>
                  <TableHead className="text-xs">Destino</TableHead>
                  <TableHead className="text-xs">Início</TableHead>
                  <TableHead className="text-xs">Fim</TableHead>
                  <TableHead className="text-xs">KM Inicial</TableHead>
                  <TableHead className="text-xs">KM Final</TableHead>
                  {showDriverName && <TableHead className="text-xs">Motorista</TableHead>}
                  {(onCompleteTrip || onDeleteTrip) && <TableHead className="text-right text-xs">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell>
                      <Badge className={trip.status === 'in_progress' ? 'bg-blue-600 hover:bg-blue-700 text-xs' : 'bg-green-600 hover:bg-green-700 text-xs'}>
                        {trip.status === 'in_progress' ? 'Progresso' : 'Concluída'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{trip.vehicleModel}</p>
                        <p className="text-xs text-muted-foreground">{trip.vehiclePlate} • {trip.vehicleColor}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {trip.destination}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs">{new Date(trip.timeStart).toLocaleDateString()}</span>
                        <span className="text-xs text-muted-foreground">{new Date(trip.timeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {trip.completedAt ? (
                        <div className="flex flex-col">
                          <span className="text-xs">{new Date(trip.completedAt).toLocaleDateString()}</span>
                          <span className="text-xs text-muted-foreground">{new Date(trip.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{trip.kmStart.toLocaleString()} km</TableCell>
                    <TableCell>
                      {trip.kmEnd ? (
                        <div>
                          <p className="text-sm">{trip.kmEnd.toLocaleString()} km</p>
                          <p className="text-xs text-green-600">
                            +{(trip.kmEnd - trip.kmStart).toLocaleString()} km
                          </p>
                        </div>
                      ) : <span className="text-sm">-</span>}
                    </TableCell>
                    {showDriverName && <TableCell className="text-sm">{trip.userName || 'N/A'}</TableCell>}
                    {(onCompleteTrip || onDeleteTrip) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {trip.status === 'in_progress' && onCompleteTrip && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setCompletingTrip(trip)}
                              className="h-8 text-xs"
                            >
                              Finalizar
                            </Button>
                          )}
                          {trip.status === 'in_progress' && onDeleteTrip && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                              onClick={() => setDeletingTrip(trip)}
                              title="Cancelar/Excluir Viagem"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Mobile Card View - Shown only on mobile */}
          <div className="md:hidden space-y-3">
            {trips.map((trip) => (
              <Card 
                key={trip.id} 
                className={`transition-colors ${ 
                  trip.status === 'in_progress' 
                    ? 'border-blue-500 bg-white' 
                    : 'bg-gray-50/50 border-gray-200'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Car className={`h-4 w-4 ${trip.status === 'in_progress' ? 'text-blue-600' : 'text-gray-500'}`} />
                      <div>
                        <p className="font-medium text-sm">{trip.vehicleModel}</p>
                        <p className="text-xs text-gray-600">{trip.vehiclePlate} • {trip.vehicleColor}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                       {trip.status === 'in_progress' && onDeleteTrip && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeletingTrip(trip)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      <Badge className={`text-xs ${trip.status === 'in_progress' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600'}`}>
                        {trip.status === 'in_progress' ? 'Progresso' : 'Concluída'}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-3 w-3" />
                      <span>{trip.destination}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-3 w-3" />
                      <div className="flex flex-col">
                        <span>Início: {new Date(trip.timeStart).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        {trip.completedAt && (
                          <span className="text-gray-500">Fim: {new Date(trip.completedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-gray-600">
                      <span>KM Inicial: {trip.kmStart.toLocaleString()} km</span>
                      {trip.kmEnd && (
                        <span>KM Final: {trip.kmEnd.toLocaleString()} km</span>
                      )}
                    </div>

                    {trip.kmEnd && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CircleCheck className="h-3 w-3" />
                        <span>Percorrido: {(trip.kmEnd - trip.kmStart).toLocaleString()} km</span>
                      </div>
                    )}

                    {showDriverName && trip.userName && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">Motorista:</span>
                        <span>{trip.userName}</span>
                      </div>
                    )}
                  </div>

                  {trip.status === 'in_progress' && onCompleteTrip && (
                    <div className="mt-3">
                      <Button 
                        size="sm" 
                        onClick={() => setCompletingTrip(trip)}
                        className="w-full h-9 text-sm"
                      >
                        Finalizar Viagem
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      );
    }

    // Card View
    return (
      <div className="space-y-4">
        {trips.map((trip) => (
          <Card 
            key={trip.id} 
            className={`transition-colors ${
              trip.status === 'in_progress' 
                ? 'border-blue-500 bg-white' 
                : 'bg-gray-50/50 border-gray-200'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Car className={`h-5 w-5 ${trip.status === 'in_progress' ? 'text-blue-600' : 'text-gray-500'}`} />
                  <div>
                    <p className="font-medium">{trip.vehicleModel}</p>
                    <p className="text-sm text-gray-600">{trip.vehiclePlate} • {trip.vehicleColor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {trip.status === 'in_progress' && onDeleteTrip && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeletingTrip(trip)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Badge className={trip.status === 'in_progress' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-500 hover:bg-gray-600'}>
                    {trip.status === 'in_progress' ? 'Em Progresso' : 'Concluída'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>{trip.destination}</span>
                </div>
                
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span>Início: {new Date(trip.timeStart).toLocaleString()}</span>
                    {trip.completedAt && (
                      <span className="text-gray-500">Fim: {new Date(trip.completedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <span>KM Inicial: {trip.kmStart.toLocaleString()} km</span>
                </div>

                {trip.kmEnd && (
                  <>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span>KM Final: {trip.kmEnd.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 md:col-span-2">
                      <CircleCheck className="h-4 w-4 text-green-600" />
                      <span>Distância percorrida: {(trip.kmEnd - trip.kmStart).toLocaleString()} km</span>
                    </div>
                  </>
                )}

                {showDriverName && trip.userName && (
                  <div className="flex items-center gap-2 text-gray-600 md:col-span-2">
                    <span className="font-medium">Motorista:</span>
                    <span>{trip.userName}</span>
                  </div>
                )}
              </div>

              {trip.status === 'in_progress' && onCompleteTrip && (
                <div className="mt-4">
                  <Button 
                    size="sm" 
                    onClick={() => setCompletingTrip(trip)}
                    className="w-full md:w-auto"
                  >
                    Finalizar Viagem
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <>
      {renderContent()}

      {/* Complete Trip Dialog */}
      <Dialog open={!!completingTrip} onOpenChange={() => setCompletingTrip(null)}>
        <DialogContent className="sm:max-w-md mx-3">
          <DialogHeader>
            <DialogTitle className="text-lg">Finalizar Viagem</DialogTitle>
            <DialogDescription className="text-sm">
              Preencha as informações para concluir a viagem
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="kmEnd" className="text-sm">KM Final *</Label>
                {completingTrip && (
                  <span className="text-xs text-gray-400 font-normal">
                    KM Inicial: {completingTrip.kmStart.toLocaleString()}
                  </span>
                )}
              </div>
              <Input
                id="kmEnd"
                type="number"
                placeholder={completingTrip ? `Min: ${completingTrip.kmStart}` : "51000"}
                value={kmEnd}
                onChange={(e) => setKmEnd(e.target.value)}
                min={completingTrip?.kmStart || 0}
                required
                className="h-10"
              />
              {completingTrip && kmEnd && Number(kmEnd) < completingTrip.kmStart && (
                <p className="text-xs text-red-500 mt-1">KM Final não pode ser menor que o inicial ({completingTrip.kmStart} km)</p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCompletingTrip(null)} className="h-10">
              Cancelar
            </Button>
            <Button 
              onClick={handleComplete} 
              disabled={loading || !kmEnd || (completingTrip ? Number(kmEnd) < completingTrip.kmStart : true)}
              className="h-10"
            >
              {loading ? 'Finalizando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Trip Confirmation Dialog */}
      <Dialog open={!!deletingTrip} onOpenChange={() => setDeletingTrip(null)}>
        <DialogContent className="sm:max-w-md mx-3">
          <DialogHeader>
            <DialogTitle className="text-lg">Cancelar Viagem</DialogTitle>
            <DialogDescription className="text-sm">
              Tem certeza que deseja cancelar e remover esta viagem? Esta ação não pode ser desfeita.
              Use esta opção apenas se a viagem foi criada por engano.
            </DialogDescription>
          </DialogHeader>
          {deletingTrip && (
            <div className="py-2 text-xs text-gray-600 space-y-1">
               <p><strong>Veículo:</strong> {deletingTrip.vehicleModel} ({deletingTrip.vehiclePlate})</p>
               <p><strong>Destino:</strong> {deletingTrip.destination}</p>
               <p><strong>Data:</strong> {new Date(deletingTrip.timeStart).toLocaleString()}</p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeletingTrip(null)} className="h-10">
              Voltar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete} 
              disabled={deleteLoading}
              className="h-10"
            >
              {deleteLoading ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}