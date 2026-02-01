import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { X, Search } from 'lucide-react';

export interface TripFiltersState {
  driverName: string;
  vehicle: string;
  date: string;
}

interface TripFiltersProps {
  onFilterChange: (filters: TripFiltersState) => void;
  drivers: string[];
  vehicles: { plate: string; model: string }[];
}

export function TripFilters({ onFilterChange, drivers, vehicles }: TripFiltersProps) {
  const [filters, setFilters] = useState<TripFiltersState>({
    driverName: 'all',
    vehicle: 'all',
    date: '',
  });

  // Debounce filter changes to avoid excessive re-renders/searches
  useEffect(() => {
    const timer = setTimeout(() => {
      // Convert 'all' to empty string for the parent filter logic
      onFilterChange({
        ...filters,
        driverName: filters.driverName === 'all' ? '' : filters.driverName,
        vehicle: filters.vehicle === 'all' ? '' : filters.vehicle,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, onFilterChange]);

  const handleClear = () => {
    const newFilters = {
      driverName: 'all',
      vehicle: 'all',
      date: '',
    };
    setFilters(newFilters);
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
          <Search className="h-4 w-4" />
          Filtrar Viagens
        </h3>
        {(filters.driverName !== 'all' || filters.vehicle !== 'all' || filters.date) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClear}
            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="driver" className="text-xs">Motorista</Label>
          <Select
            value={filters.driverName}
            onValueChange={(value) => setFilters(prev => ({ ...prev, driverName: value }))}
          >
            <SelectTrigger id="driver" className="h-9">
              <SelectValue placeholder="Selecione um motorista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os motoristas</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver} value={driver}>
                  {driver}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="vehicle" className="text-xs">Veículo</Label>
          <Select
            value={filters.vehicle}
            onValueChange={(value) => setFilters(prev => ({ ...prev, vehicle: value }))}
          >
            <SelectTrigger id="vehicle" className="h-9">
              <SelectValue placeholder="Selecione um veículo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os veículos</SelectItem>
              {vehicles.map((v) => (
                <SelectItem key={v.plate} value={v.plate}>
                  {v.plate} - {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="date" className="text-xs">Data da Viagem</Label>
          <Input
            id="date"
            type="date"
            value={filters.date}
            onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}