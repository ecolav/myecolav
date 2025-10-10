import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Package, ShoppingCart, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSettings } from '../../hooks/useSettings';
import { useSectors } from '../../hooks/useSectors';
import { useRequests } from '../../hooks/useRequests';
import { API_CONFIG } from '../../config/api';

interface Props {
  onBack: () => void;
  selectedClient?: { id: string; name: string };
}

interface Bed {
  id: string;
  number: string;
  status: string;
  sectorId: string;
}

interface LinenItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  currentStock: number;
}

type Mode = 'distribute' | 'order';
type InputMode = 'manual' | 'rfid';

export function DistributionAndOrdersScreen({ onBack, selectedClient }: Props) {
  const { settings } = useSettings();
  const clientId = selectedClient?.id || settings.totem.clientId;

  // Modo principal
  const [mode, setMode] = useState<Mode>('distribute');
  const [inputMode, setInputMode] = useState<InputMode>('manual');

  // Dados
  const { sectors, loading: loadingSectors } = useSectors({ clientId, autoLoad: true });
  const [beds, setBeds] = useState<Bed[]>([]);
  const [items, setItems] = useState<LinenItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Seleção para distribuição
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [selectedBedId, setSelectedBedId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Seleção para pedido
  const [orderItems, setOrderItems] = useState<Array<{ itemId: string; quantity: number }>>([]);
  const [observations, setObservations] = useState('');

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { createRequest } = useRequests({ clientId });

  // Carregar leitos e itens
  useEffect(() => {
    const loadData = async () => {
      if (!clientId) return;

      setLoadingData(true);
      try {
        const headers = { 'x-api-key': API_CONFIG.API_KEY };

        // Carregar leitos
        const bedsRes = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.BEDS}?clientId=${clientId}&pageSize=500`,
          { headers }
        );
        if (bedsRes.ok) {
          const bedsData = await bedsRes.json();
          setBeds(bedsData.data || bedsData || []);
        }

        // Carregar itens
        const itemsRes = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.LINENS}?clientId=${clientId}&pageSize=200`,
          { headers }
        );
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
  }, [clientId]);

  // Filtrar leitos por setor
  const filteredBeds = useMemo(() => {
    if (!selectedSectorId) return beds;
    return beds.filter(b => b.sectorId === selectedSectorId);
  }, [beds, selectedSectorId]);

  // Handlers
  const handleDistribute = async () => {
    if (!selectedBedId || !selectedItemId || quantity <= 0) {
      setError('Preencha todos os campos');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.DISTRIBUTE}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_CONFIG.API_KEY
          },
          body: JSON.stringify({
            linenItemId: selectedItemId,
            bedId: selectedBedId,
            quantity,
            reason: 'Distribuição via Totem'
          })
        }
      );

      if (!response.ok) throw new Error('Erro ao distribuir');

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setSelectedSectorId('');
        setSelectedBedId('');
        setSelectedItemId('');
        setQuantity(1);
      }, 2000);
    } catch (err) {
      console.error(err);
      setError('Erro ao distribuir item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!selectedBedId || orderItems.length === 0) {
      setError('Selecione o leito e adicione ao menos um item');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const result = await createRequest(selectedBedId, orderItems, observations);
      if (result) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setSelectedSectorId('');
          setSelectedBedId('');
          setOrderItems([]);
          setObservations('');
        }, 2000);
      } else {
        setError('Erro ao criar pedido');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao criar pedido');
    } finally {
      setSubmitting(false);
    }
  };

  const addItemToOrder = () => {
    if (!selectedItemId || quantity <= 0) return;
    setOrderItems(prev => {
      const existing = prev.find(i => i.itemId === selectedItemId);
      if (existing) {
        return prev.map(i =>
          i.itemId === selectedItemId ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { itemId: selectedItemId, quantity }];
    });
    setSelectedItemId('');
    setQuantity(1);
  };

  const removeItemFromOrder = (itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  if (loadingSectors || loadingData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button onClick={onBack} variant="secondary" size="sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Distribuição & Pedidos
                </h1>
                <p className="text-sm text-gray-600">
                  {selectedClient ? selectedClient.name : 'Sistema'}
                </p>
              </div>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setMode('distribute')}
              className={`flex-1 py-4 px-6 rounded-lg border-2 transition-colors ${
                mode === 'distribute'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <Package className="w-6 h-6 mx-auto mb-2" />
              <div className="font-semibold">Distribuir Enxoval</div>
              <div className="text-xs mt-1 opacity-75">Alocar itens aos leitos</div>
            </button>
            <button
              onClick={() => setMode('order')}
              className={`flex-1 py-4 px-6 rounded-lg border-2 transition-colors ${
                mode === 'order'
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <ShoppingCart className="w-6 h-6 mx-auto mb-2" />
              <div className="font-semibold">Solicitar Itens</div>
              <div className="text-xs mt-1 opacity-75">Criar pedido extra</div>
            </button>
          </div>

          {/* Input Mode */}
          <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={inputMode === 'manual'}
                onChange={() => setInputMode('manual')}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Manual</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={inputMode === 'rfid'}
                onChange={() => setInputMode('rfid')}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">RFID Automático</span>
            </label>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {inputMode === 'manual' ? (
            <div className="space-y-6">
              {/* Setor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  1️⃣ Setor
                </label>
                <select
                  value={selectedSectorId}
                  onChange={e => {
                    setSelectedSectorId(e.target.value);
                    setSelectedBedId('');
                  }}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um setor...</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Leito */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2️⃣ Leito
                </label>
                <select
                  value={selectedBedId}
                  onChange={e => setSelectedBedId(e.target.value)}
                  disabled={!selectedSectorId}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Selecione um leito...</option>
                  {filteredBeds.map(b => (
                    <option key={b.id} value={b.id}>
                      Leito {b.number} ({b.status === 'free' ? 'Livre' : 'Ocupado'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  3️⃣ Item de Enxoval
                </label>
                <select
                  value={selectedItemId}
                  onChange={e => setSelectedItemId(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um item...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} - Estoque: {item.currentStock} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantidade */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  4️⃣ Quantidade
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-12 h-12 text-2xl font-bold border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 px-4 py-3 text-center text-2xl font-bold border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-12 h-12 text-2xl font-bold border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Mode-specific controls */}
              {mode === 'order' && (
                <>
                  <Button onClick={addItemToOrder} variant="secondary" fullWidth>
                    ➕ Adicionar Item ao Pedido
                  </Button>

                  {orderItems.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">Itens do Pedido:</h3>
                      {orderItems.map(oi => {
                        const item = items.find(i => i.id === oi.itemId);
                        return (
                          <div
                            key={oi.itemId}
                            className="flex justify-between items-center py-2 border-b last:border-0"
                          >
                            <span>
                              {item?.name} x {oi.quantity}
                            </span>
                            <button
                              onClick={() => removeItemFromOrder(oi.itemId)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remover
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Observações
                    </label>
                    <textarea
                      value={observations}
                      onChange={e => setObservations(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none"
                      placeholder="Observações sobre o pedido (opcional)..."
                    />
                  </div>
                </>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    {mode === 'distribute' ? 'Distribuído com sucesso!' : 'Pedido criado com sucesso!'}
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={mode === 'distribute' ? handleDistribute : handleCreateOrder}
                disabled={submitting}
                variant="primary"
                size="lg"
                fullWidth
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Processando...
                  </>
                ) : mode === 'distribute' ? (
                  '✅ CONFIRMAR DISTRIBUIÇÃO'
                ) : (
                  '✅ CONFIRMAR PEDIDO'
                )}
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                Modo RFID Automático
              </h3>
              <p className="text-gray-600">
                Aproxime o item do leitor RFID para leitura automática
              </p>
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg inline-block">
                📡 Aguardando leitura...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

