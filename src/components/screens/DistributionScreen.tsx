import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, AlertTriangle, Eraser, FileDown, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useDistribution, DistributedItem } from '../../hooks/useDistribution';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface DistributionScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

interface Client {
  id: string;
  name: string;
  document?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  whatsappNumber?: string;
  createdAt: string;
}

interface Sector {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  clientId?: string;
}

interface Bed {
  id: string;
  number: string;
  sectorId: string;
  status: 'free' | 'occupied';
  token: string;
  sector?: Sector;
}

interface LinenItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  createdAt: string;
  clientId?: string;
}

export const DistributionScreen: React.FC<DistributionScreenProps> = ({ onBack, onNavigate }) => {
  const { settings } = useSettings();
  const { selectedClient } = useClients();
  const [clients, setClients] = useState<Client[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [linenItems, setLinenItems] = useState<LinenItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [showCollected, setShowCollected] = useState<boolean>(false);
  const [onlySectorVirtual, setOnlySectorVirtual] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const { 
    distributedItems, 
    loading: distributionLoading, 
    error: distributionError,
    updateItemStatus,
    collectAllFromBed,
    refreshData
  } = useDistribution({
    apiBaseUrl: settings.server.baseUrl,
    clientId: selectedClient?.id
  });

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Simular carregamento de dados
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Dados simulados
      setClients([
        { id: '1', name: 'Hospital São Paulo', document: '12.345.678/0001-90', createdAt: '2024-01-01' },
        { id: '2', name: 'Clínica MedCenter', document: '98.765.432/0001-10', createdAt: '2024-01-01' }
      ]);
      
      setSectors([
        { id: '1', name: 'UTI', description: 'Unidade de Terapia Intensiva', clientId: '1', createdAt: '2024-01-01' },
        { id: '2', name: 'Enfermaria A', description: 'Enfermaria A - 1º andar', clientId: '1', createdAt: '2024-01-01' },
        { id: '3', name: 'Centro Cirúrgico', description: 'Centro Cirúrgico', clientId: '1', createdAt: '2024-01-01' }
      ]);
      
      setBeds([
        { id: '1', number: '101', sectorId: '1', status: 'occupied', token: 'BED-101' },
        { id: '2', number: '102', sectorId: '1', status: 'free', token: 'BED-102' },
        { id: '3', number: '201', sectorId: '2', status: 'occupied', token: 'BED-201' },
        { id: '4', number: '202', sectorId: '2', status: 'occupied', token: 'BED-202' }
      ]);
      
      setLinenItems([
        { id: '1', name: 'Lençol Solteiro', sku: 'LS001', unit: 'un', currentStock: 150, minimumStock: 50, clientId: '1', createdAt: '2024-01-01' },
        { id: '2', name: 'Toalha de Banho', sku: 'TB001', unit: 'un', currentStock: 200, minimumStock: 100, clientId: '1', createdAt: '2024-01-01' },
        { id: '3', name: 'Cobertor', sku: 'CB001', unit: 'un', currentStock: 80, minimumStock: 30, clientId: '1', createdAt: '2024-01-01' }
      ]);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar setores por cliente selecionado
  const sectorsForClient = useMemo(() => {
    if (!selectedClient) return sectors;
    return sectors.filter(s => s.clientId === selectedClient.id);
  }, [sectors, selectedClient]);

  // Filtrar setores por filtro
  const filteredSectors = useMemo(() => {
    let filtered = sectorsForClient;
    
    if (sectorFilter) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(sectorFilter.toLowerCase()) ||
        s.description?.toLowerCase().includes(sectorFilter.toLowerCase())
      );
    }
    
    return filtered;
  }, [sectorsForClient, sectorFilter]);

  // Agrupar itens distribuídos por setor e leito
  const groupedItems = useMemo(() => {
    const grouped: Record<string, Record<string, DistributedItem[]>> = {};
    
    distributedItems.forEach(item => {
      if (!grouped[item.sectorId]) {
        grouped[item.sectorId] = {};
      }
      if (!grouped[item.sectorId][item.bedId]) {
        grouped[item.sectorId][item.bedId] = [];
      }
      grouped[item.sectorId][item.bedId].push(item);
    });
    
    return grouped;
  }, [distributedItems]);

  const toggleExpanded = (sectorId: string) => {
    setExpanded(prev => ({
      ...prev,
      [sectorId]: !prev[sectorId]
    }));
  };

  const handleStatusChange = async (itemId: string, status: 'allocated' | 'collected' | 'in_transit') => {
    try {
      await updateItemStatus(itemId, status);
      await refreshData();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const handleCollectAll = async (bedId: string) => {
    try {
      await collectAllFromBed(bedId);
      await refreshData();
    } catch (err) {
      console.error('Erro ao coletar todos os itens:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'allocated': return 'bg-blue-100 text-blue-800';
      case 'collected': return 'bg-green-100 text-green-800';
      case 'in_transit': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'allocated': return 'Alocado';
      case 'collected': return 'Coletado';
      case 'in_transit': return 'Em Trânsito';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={onBack} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white/60">
                Voltar
              </Button>
              <h1 className="text-2xl md:text-3xl font-bold tracking-wide bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                Distribuição de Enxoval
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8">
        {!selectedClient && (
          <div className="flex items-center justify-center min-h-[400px]">
            <Card className="max-w-md w-full text-center p-8">
              <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-800 mb-2">Cliente não configurado</h2>
              <p className="text-gray-600 mb-6">
                Configure o cliente nas configurações para usar a funcionalidade de distribuição.
              </p>
              <Button 
                onClick={() => onNavigate?.('settings')} 
                variant="primary"
                className="w-full"
              >
                Ir para Configurações
              </Button>
            </Card>
          </div>
        )}

        {selectedClient && (
          <div className="space-y-6">
            {/* Informações do Cliente */}
            <Card>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{selectedClient.name}</h2>
                  <p className="text-gray-600">Gestão de distribuição de enxoval</p>
                </div>
                <Button
                  onClick={refreshData}
                  variant="secondary"
                  size="sm"
                  disabled={distributionLoading}
                >
                  {distributionLoading ? 'Atualizando...' : 'Atualizar'}
                </Button>
              </div>
            </Card>

            {/* Filtros */}
            <Card>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Filtrar Setor</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="Digite o nome do setor..."
                      value={sectorFilter}
                      onChange={(e) => setSectorFilter(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="showCollected"
                      checked={showCollected}
                      onChange={(e) => setShowCollected(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="showCollected" className="text-sm text-gray-700">
                      Mostrar coletados
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="onlySectorVirtual"
                      checked={onlySectorVirtual}
                      onChange={(e) => setOnlySectorVirtual(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="onlySectorVirtual" className="text-sm text-gray-700">
                      Apenas setor virtual
                    </label>
                  </div>
                </div>
              </div>
            </Card>

            {/* Lista de Setores e Leitos */}
            <div className="space-y-4">
              {filteredSectors.map(sector => {
                const sectorBeds = beds.filter(bed => bed.sectorId === sector.id);
                const hasItems = sectorBeds.some(bed => groupedItems[sector.id]?.[bed.id]?.length > 0);
                
                return (
                  <Card key={sector.id}>
                    <div className="p-4">
                      <button
                        onClick={() => toggleExpanded(sector.id)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{sector.name}</h3>
                          {sector.description && (
                            <p className="text-sm text-gray-600">{sector.description}</p>
                          )}
                          <p className="text-sm text-gray-500">
                            {sectorBeds.length} leitos • {sectorBeds.filter(b => b.status === 'occupied').length} ocupados
                          </p>
                        </div>
                        {expanded[sector.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </button>
                    </div>

                    {expanded[sector.id] && (
                      <div className="border-t border-gray-200">
                        <div className="p-4 space-y-4">
                          {sectorBeds.map(bed => {
                            const bedItems = groupedItems[sector.id]?.[bed.id] || [];
                            const hasAllocatedItems = bedItems.some(item => item.status === 'allocated');
                            
                            return (
                              <div key={bed.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <h4 className="font-semibold text-gray-800">Leito {bed.number}</h4>
                                    <p className="text-sm text-gray-600">Token: {bed.token}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      bed.status === 'occupied' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                    }`}>
                                      {bed.status === 'occupied' ? 'Ocupado' : 'Livre'}
                                    </span>
                                    {hasAllocatedItems && (
                                      <Button
                                        onClick={() => handleCollectAll(bed.id)}
                                        variant="secondary"
                                        size="sm"
                                      >
                                        Coletar Todos
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {bedItems.length > 0 ? (
                                  <div className="space-y-2">
                                    {bedItems.map(item => (
                                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div>
                                          <p className="font-medium text-gray-800">{item.linenItem.name}</p>
                                          <p className="text-sm text-gray-600">
                                            SKU: {item.linenItem.sku} • Quantidade: {item.quantity}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                                            {getStatusLabel(item.status)}
                                          </span>
                                          {item.status === 'allocated' && (
                                            <Button
                                              onClick={() => handleStatusChange(item.id, 'collected')}
                                              variant="success"
                                              size="sm"
                                            >
                                              Coletar
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 text-center py-4">
                                    Nenhum item distribuído neste leito
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Resumo */}
            <Card className="bg-gradient-to-r from-blue-50 to-emerald-50">
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo da Distribuição</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">
                      {distributedItems.length}
                    </div>
                    <div className="text-sm text-gray-600">Total de Itens</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {distributedItems.filter(item => item.status === 'allocated').length}
                    </div>
                    <div className="text-sm text-gray-600">Alocados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {distributedItems.filter(item => item.status === 'collected').length}
                    </div>
                    <div className="text-sm text-gray-600">Coletados</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {distributedItems.filter(item => item.status === 'in_transit').length}
                    </div>
                    <div className="text-sm text-gray-600">Em Trânsito</div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};