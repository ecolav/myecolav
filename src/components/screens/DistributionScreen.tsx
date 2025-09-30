import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useDistribution, DistributedItem } from '../../hooks/useDistribution';
import { API_CONFIG } from '../../config/api';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface DistributionScreenProps {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

// Client type not used directly (kept via hook)

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
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [linenItems, setLinenItems] = useState<LinenItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [showCollected, setShowCollected] = useState<boolean>(false);
  const [onlySectorVirtual, setOnlySectorVirtual] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDistributeOpen, setIsDistributeOpen] = useState<boolean>(false);
  const [distributeBedId, setDistributeBedId] = useState<string>('');
  const [distributeItemId, setDistributeItemId] = useState<string>('');
  const [distributeQty, setDistributeQty] = useState<number>(1);
  const [distributeBusy, setDistributeBusy] = useState<boolean>(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient?.id, settings.totem.clientId]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const clientId = selectedClient?.id || settings.totem.clientId;
      const headers: HeadersInit = { 'x-api-key': API_CONFIG.API_KEY };
      // Carregar itens do cliente
      const itemsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.LINENS}?clientId=${encodeURIComponent(clientId || '')}`, { headers });
      if (!itemsRes.ok) throw new Error('Falha ao carregar itens');
      const itemsJson = await itemsRes.json();
      const items: LinenItem[] = (itemsJson?.data ?? itemsJson ?? []) as LinenItem[];
      setLinenItems(items);

      // Carregar leitos do cliente
      const bedsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.BEDS}?clientId=${encodeURIComponent(clientId || '')}`, { headers });
      if (!bedsRes.ok) throw new Error('Falha ao carregar leitos');
      const bedsJson = await bedsRes.json();
      const bedsList: Bed[] = (bedsJson?.data ?? bedsJson ?? []) as Bed[];
      setBeds(bedsList);

      // Derivar setores a partir dos leitos (se setor vier aninhado, usar; senão, agrupar por sectorId)
      const sectorMap = new Map<string, Sector>();
      bedsList.forEach(b => {
        const s = (b as any).sector as Sector | undefined;
        if (s && !sectorMap.has(s.id)) sectorMap.set(s.id, s);
        if (!s && b.sectorId && !sectorMap.has(b.sectorId)) {
          sectorMap.set(b.sectorId, { id: b.sectorId, name: `Setor ${b.sectorId.substring(0,4)}` , createdAt: new Date().toISOString() } as Sector);
        }
      });
      setSectors(Array.from(sectorMap.values()));
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Expandir todos os setores ao carregar
  useEffect(() => {
    if (sectors.length > 0) {
      setExpanded(sectors.reduce((acc, s) => { acc[s.id] = true; return acc; }, {} as Record<string, boolean>));
    }
  }, [sectors]);

  const openDistribute = (bedId: string) => {
    setDistributeBedId(bedId);
    setDistributeItemId(linenItems[0]?.id || '');
    setDistributeQty(1);
    setIsDistributeOpen(true);
  };

  const submitDistribute = async () => {
    try {
      if (!distributeBedId || !distributeItemId || distributeQty <= 0) return;
      setDistributeBusy(true);
      const body = {
        linenItemId: distributeItemId,
        bedId: distributeBedId,
        quantity: distributeQty,
        reason: 'Totem'
      };
      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.DISTRIBUTE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_CONFIG.API_KEY },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setIsDistributeOpen(false);
      await refreshData();
    } catch (e) {
      console.error('Erro ao distribuir:', e);
      alert('Erro ao distribuir.');
    } finally {
      setDistributeBusy(false);
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
      const sectorId = item.bed?.sectorId || 'unknown';
      const bedId = item.bedId;
      if (!grouped[sectorId]) grouped[sectorId] = {};
      if (!grouped[sectorId][bedId]) grouped[sectorId][bedId] = [];
      grouped[sectorId][bedId].push(item);
    });
    return grouped;
  }, [distributedItems]);

  const toggleExpanded = (sectorId: string) => {
    setExpanded(prev => ({
      ...prev,
      [sectorId]: !prev[sectorId]
    }));
  };

  const handleStatusChange = async (itemId: string, status: 'allocated' | 'collected' | 'pendingCollection') => {
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
        {!selectedClient && !settings.totem.clientId && (
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

        {(selectedClient || settings.totem.clientId) && (
          <div className="space-y-6">
            {/* Informações do Cliente */}
            <Card>
              <div className="p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{selectedClient?.name || 'Cliente configurado no totem'}</h2>
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
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <span className="mr-4">Itens: {linenItems.length}</span>
                    <span>Leitos: {beds.length}</span>
                  </div>
                  <Button onClick={loadInitialData} size="sm" variant="secondary">Recarregar dados</Button>
                </div>
                {(linenItems.length === 0 || beds.length === 0) && (
                  <div className="mt-3 text-xs text-orange-600">
                    {linenItems.length === 0 && 'Nenhum item encontrado para o cliente informado. '}
                    {beds.length === 0 && 'Nenhum leito encontrado para o cliente informado.'}
                  </div>
                )}
              </div>
            </Card>

            {/* Itens do Cliente */}
            <Card>
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Itens do Cliente</h3>
                {linenItems.length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhum item encontrado.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {linenItems.map(item => (
                      <div key={item.id} className="border rounded-lg p-3 bg-white">
                        <div className="font-semibold text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-600">SKU: {item.sku} • Unidade: {item.unit}</div>
                        <div className="mt-1 text-sm"><span className="text-gray-500">Estoque:</span> <span className="font-semibold">{item.currentStock}</span></div>
                      </div>
                    ))}
                  </div>
                )}
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
                                    <Button
                                      onClick={() => openDistribute(bed.id)}
                                      variant="secondary"
                                      size="sm"
                                    >
                                      Distribuir
                                    </Button>
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
                                          <p className="font-medium text-gray-800">{item.linenItem?.name || 'Item'}</p>
                                          <p className="text-sm text-gray-600">
                                            SKU: {item.linenItem?.sku || '-'}
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
                  
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>
      {isDistributeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsDistributeOpen(false)}></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Distribuir Enxoval</h3>
              <Button variant="secondary" size="sm" onClick={() => setIsDistributeOpen(false)}>Fechar</Button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Item</label>
                <select
                  value={distributeItemId}
                  onChange={(e) => setDistributeItemId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {linenItems.map(it => (
                    <option key={it.id} value={it.id}>{it.name} — {it.sku} (Estoque: {it.currentStock})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={distributeQty}
                  onChange={(e) => setDistributeQty(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="p-4 border-t flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsDistributeOpen(false)}>Cancelar</Button>
              <Button onClick={submitDistribute} disabled={distributeBusy || !distributeItemId}>Confirmar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};