import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { publicAnonKey } from '../../../utils/supabase/info';

interface VehicleFormData {
  plate: string;
  brand: string;
  model: string;
  color: string;
  year: string;
}

interface VehicleFormProps {
  onVehicleCreated: () => void;
  projectId: string;
  accessToken: string;
  initialData?: VehicleFormData;
  mode?: 'create' | 'edit';
  variant?: 'card' | 'plain';
}

export function VehicleForm({ 
  onVehicleCreated, 
  projectId, 
  accessToken, 
  initialData, 
  mode = 'create',
  variant = 'card'
}: VehicleFormProps) {
  const [loading, setLoading] = useState(false);
  const [originalPlate, setOriginalPlate] = useState('');
  const [formData, setFormData] = useState<VehicleFormData>({
    plate: '',
    brand: '',
    model: '',
    color: '',
    year: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      setOriginalPlate(initialData.plate);
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log(`=== ${mode === 'edit' ? 'UPDATING' : 'CREATING'} VEHICLE ===`);
      console.log('Form data:', formData);
      
      const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles`;
      // Use originalPlate for the URL in edit mode to target the existing resource
      const url = mode === 'edit' ? `${baseUrl}/${originalPlate}` : baseUrl;
      const method = mode === 'edit' ? 'PUT' : 'POST';
      
      console.log('Request URL:', url);
      
      const response = await fetch(url, {
        method,
        headers: {
          'apikey': publicAnonKey,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'x-access-token': accessToken,
        },
        body: JSON.stringify(formData),
      });

      console.log('Response status:', response.status);
      
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError);
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        if (response.status === 400 && mode === 'create') {
           throw new Error(data.error);
        }
        console.error('Server returned error:', data);
        throw new Error(data.error || `HTTP ${response.status}: Failed to ${mode} vehicle`);
      }

      console.log(`Vehicle ${mode}d successfully!`);
      toast.success(`Veículo ${mode === 'edit' ? 'atualizado' : 'cadastrado'} com sucesso!`);
      
      if (mode === 'create') {
        setFormData({
          plate: '',
          brand: '',
          model: '',
          color: '',
          year: '',
        });
      }
      
      onVehicleCreated();
    } catch (error: any) {
      let errorMessage = error.message || `Erro ao ${mode === 'edit' ? 'atualizar' : 'cadastrar'} veículo`;
      
      if (errorMessage.includes('Vehicle with this plate already exists')) {
        errorMessage = 'Já existe um veículo cadastrado com esta placa.';
      } else {
        console.error(`=== Error ${mode} vehicle ===`);
        console.error('Error message:', error.message);
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'plain') {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="plate">Placa *</Label>
            <Input
              id="plate"
              placeholder="ABC-1234"
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
              required
              maxLength={8}
              className={mode === 'edit' ? '' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Marca *</Label>
            <Input
              id="brand"
              placeholder="Toyota"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo *</Label>
            <Input
              id="model"
              placeholder="Corolla"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor *</Label>
            <Input
              id="color"
              placeholder="Preto"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="year">Ano *</Label>
            <Input
              id="year"
              type="number"
              placeholder="2024"
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
              required
              min="1900"
              max={new Date().getFullYear() + 1}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={loading}>
            {loading 
              ? (mode === 'edit' ? 'Salvando...' : 'Cadastrando...') 
              : (mode === 'edit' ? 'Salvar Alterações' : 'Cadastrar Veículo')
            }
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'edit' ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}</CardTitle>
        <CardDescription>
          {mode === 'edit' 
            ? 'Atualize as informações do veículo' 
            : 'Preencha as informações do veículo para adicionar à frota'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plate">Placa *</Label>
              <Input
                id="plate"
                placeholder="ABC-1234"
                value={formData.plate}
                onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                required
                maxLength={8}
                className={mode === 'edit' ? '' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca *</Label>
              <Input
                id="brand"
                placeholder="Toyota"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo *</Label>
              <Input
                id="model"
                placeholder="Corolla"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor *</Label>
              <Input
                id="color"
                placeholder="Preto"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Ano *</Label>
              <Input
                id="year"
                type="number"
                placeholder="2024"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                required
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
              {loading 
                ? (mode === 'edit' ? 'Salvando...' : 'Cadastrando...') 
                : (mode === 'edit' ? 'Salvar Alterações' : 'Cadastrar Veículo')
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}