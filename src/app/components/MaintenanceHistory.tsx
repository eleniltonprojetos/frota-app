import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { History, Wrench, Droplet } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MaintenanceRecord {
  id: string;
  plate: string;
  type: string;
  km: number;
  date: string;
  userId: string;
  userName: string;
  notes?: string;
}

interface MaintenanceHistoryProps {
  plate: string;
  accessToken: string;
}

export function MaintenanceHistory({ plate, accessToken }: MaintenanceHistoryProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ [year: string]: number }>({});

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e4206deb/vehicles/${plate}/maintenance-history`,
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
        const records = data.history || [];
        setHistory(records);
        calculateStats(records);
      }
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (records: MaintenanceRecord[]) => {
    const yearStats: { [key: string]: number } = {};
    
    records.forEach(record => {
      const year = new Date(record.date).getFullYear().toString();
      yearStats[year] = (yearStats[year] || 0) + 1;
    });

    setStats(yearStats);
  };

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <History className="h-4 w-4" />
          Histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Histórico de Manutenção - {plate}
          </DialogTitle>
          <DialogDescription>
            Visualize o histórico completo de manutenções e trocas de óleo realizadas para este veículo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Card className="bg-blue-50 border-blue-100">
             <CardHeader className="pb-2 pt-4">
               <CardDescription className="text-blue-700 font-medium">Trocas este ano ({new Date().getFullYear()})</CardDescription>
               <CardTitle className="text-3xl text-blue-900">
                 {stats[new Date().getFullYear().toString()] || 0}
               </CardTitle>
             </CardHeader>
          </Card>
          
          <Card className="bg-gray-50 border-gray-100">
             <CardHeader className="pb-2 pt-4">
               <CardDescription className="text-gray-700 font-medium">Total de Trocas</CardDescription>
               <CardTitle className="text-3xl text-gray-900">{history.length}</CardTitle>
             </CardHeader>
          </Card>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>KM</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">Carregando...</TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">Nenhum registro encontrado.</TableCell>
                </TableRow>
              ) : (
                history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {format(new Date(record.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Droplet className="h-3 w-3 text-amber-600" />
                        Troca de Óleo
                      </div>
                    </TableCell>
                    <TableCell>{record.km} km</TableCell>
                    <TableCell className="text-gray-600 text-xs">{record.userName}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}