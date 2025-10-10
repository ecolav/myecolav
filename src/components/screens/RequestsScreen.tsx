import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingCart, Plus, Package, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useRequests } from '../../hooks/useRequests';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';
import { API_CONFIG } from '../../config/api';

interface RequestsScreenProps {
  onBack: () => void;
}

interface RequestItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

export const RequestsScreen: React.FC<RequestsScreenProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const { selectedClient, clients } = useClients();
  const { orders, loading, createRequest, refreshData, getPendingOrders } = useRequests({
    clientId: selectedClient?.id || settings.totem.clientId
  });

  const [showForm, setShowForm] = useState(false);
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedBed, setSelectedBed] = useState('');
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [observations, setObservations] = useState('');

  // Dados REAIS da API
  const [sectors, setSectors] = useState<Array<{ id: string; name: string; clientId?: string }>>([]);
  const [beds, setBeds] = useState<Array<{ id: string; number: string; sectorId: string; status: string; token: string }>>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string; sku: string; currentStock: number; unit: string }>>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Carregar dados reais da API
  useEffect(() => {
    const loadData = async () => {
      const clientId = selectedClient?.id || settings.totem.clientId;
      if (!clientId) return;

      setLoadingData(true);
      try {
        const headers = { 'x-api-key': API_CONFIG.API_KEY };
        
        // Buscar leitos do cliente
        const bedsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.BEDS}?clientId=${clientId}&pageSize=500`, { headers });
        if (bedsRes.ok) {
          const bedsData = await bedsRes.json();
          const bedsList = bedsData.data || bedsData || [];
          setBeds(bedsList);
        }

        // Buscar setores REAIS da API
        const sectorsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SECTORS}?clientId=${clientId}&pageSize=500`, { headers });
        if (sectorsRes.ok) {
          const sectorsData = await sectorsRes.json();
          const sectorsList = sectorsData.data || sectorsData || [];
          setSectors(sectorsList);
        } else {
          // Fallback: extrair setores únicos dos leitos
          const sectorIds = Array.from(new Set(beds.map((bed: any) => bed.sectorId).filter(Boolean)));
          const sectorsFallback = sectorIds.map(id => ({ id, name: `Setor ${id.substring(0, 6)}`, clientId }));
          setSectors(sectorsFallback);
        }

        // Buscar itens do cliente
        const itemsRes = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.LINENS}?clientId=${clientId}&pageSize=200`, { headers });
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(itemsData.data || itemsData || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [selectedClient, settings.totem.clientId, beds]);

  const pendingOrders = getPendingOrders();
  const bedsForSector = beds.filter(b => b.sectorId === selectedSector);

  const addItemToRequest = () => {
    if (!selectedItemId || !quantity || parseInt(quantity) <= 0) return;
    
    const item = items.find(i => i.id === selectedItemId);
    if (!item) return;

    const existingItem = requestItems.find(ri => ri.itemId === selectedItemId);
    if (existingItem) {
      setRequestItems(requestItems.map(ri =>
        ri.itemId === selectedItemId
          ? { ...ri, quantity: ri.quantity + parseInt(quantity) }
          : ri
      ));
    } else {
      setRequestItems([...requestItems, {
        itemId: selectedItemId,
        itemName: item.name,
        quantity: parseInt(quantity)
      }]);
    }

    setSelectedItemId('');
    setQuantity('1');
  };

  const removeItem = (itemId: string) => {
    setRequestItems(requestItems.filter(ri => ri.itemId !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBed || requestItems.length === 0) {
      alert('Selecione um leito e adicione ao menos um item');
      return;
    }

    const success = await createRequest(
      selectedBed,
      requestItems.map(ri => ({ itemId: ri.itemId, quantity: ri.quantity })),
      observations || undefined
    );

    if (success) {
      alert('✓ Solicitação enviada com sucesso!');
      setShowForm(false);
      setSelectedSector('');
      setSelectedBed('');
      setRequestItems([]);
      setObservations('');
      await refreshData();
    } else {
      alert('✗ Erro ao enviar solicitação');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'preparing': return 'Em Separação';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - ESTILO ECOLAV */}
      <header className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={onBack} variant="secondary" size="md" icon={ArrowLeft}>
                Voltar
              </Button>
              <h1 className="text-3xl font-bold text-gray-800">
                Solicitações de Enxoval
              </h1>
            </div>
            <Button onClick={() => setShowForm(true)} variant="primary" size="md" icon={Plus}>
              Nova Solicitação
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-6 bg-white border-2 border-yellow-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pendentes</p>
                <p className="text-3xl font-bold text-yellow-700">{pendingOrders.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6 bg-white border-2 border-blue-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Em Separação</p>
                <p className="text-3xl font-bold text-blue-700">
                  {orders.filter(o => o.status === 'preparing').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6 bg-white border-2 border-green-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Entregues</p>
                <p className="text-3xl font-bold text-green-700">
                  {orders.filter(o => o.status === 'delivered').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Lista de Solicitações */}
        <Card className="bg-white border-2 border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Minhas Solicitações</h2>
            
            {orders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="mx-auto mb-4 text-gray-400" size={48} />
                <p>Nenhuma solicitação registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">
                          {order.bed?.sector?.name} - Leito {order.bed?.number}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')} às {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm text-gray-700">
                          • {item.quantity}x {item.item?.name || 'Item'}
                        </div>
                      ))}
                    </div>
                    {order.observations && (
                      <p className="text-sm text-gray-600 mt-2 italic">
                        Obs: {order.observations}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Modal de Nova Solicitação - ESTILO ECOLAV */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl bg-white max-h-[90vh] overflow-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Nova Solicitação de Enxoval</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Seleção de Leito */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Setor *
                    </label>
                    <select
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                      value={selectedSector}
                      onChange={(e) => {
                        setSelectedSector(e.target.value);
                        setSelectedBed('');
                      }}
                    >
                      <option value="">Selecione o setor...</option>
                      {sectors.map(sector => (
                        <option key={sector.id} value={sector.id}>{sector.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Leito *
                    </label>
                    <select
                      required
                      disabled={!selectedSector}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                      value={selectedBed}
                      onChange={(e) => setSelectedBed(e.target.value)}
                    >
                      <option value="">Selecione o leito...</option>
                      {bedsForSector.map(bed => (
                        <option key={bed.id} value={bed.id}>Leito {bed.number}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Adicionar Itens */}
                <div className="border-2 border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-800 mb-4">Itens Solicitados</h3>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Item
                      </label>
                      <select
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                      >
                        <option value="">Selecione um item...</option>
                        {items.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {item.sku} (Estoque: {item.currentStock})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quantidade
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                        <Button
                          type="button"
                          onClick={addItemToRequest}
                          variant="secondary"
                          size="md"
                          disabled={!selectedItemId}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Lista de itens adicionados */}
                  {requestItems.length > 0 ? (
                    <div className="space-y-2">
                      {requestItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
                        >
                          <div>
                            <p className="font-semibold text-gray-800">{item.itemName}</p>
                            <p className="text-sm text-gray-600">Quantidade: {item.quantity}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.itemId)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Nenhum item adicionado. Selecione um item acima.
                    </p>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Observações (opcional)
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                    rows={3}
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Informações adicionais sobre a solicitação..."
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setShowForm(false);
                      setRequestItems([]);
                      setSelectedSector('');
                      setSelectedBed('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={!selectedBed || requestItems.length === 0}
                  >
                    Enviar Solicitação
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};


