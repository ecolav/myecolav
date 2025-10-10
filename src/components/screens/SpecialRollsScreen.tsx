import React, { useState } from 'react';
import { ArrowLeft, Package, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useSpecialRolls } from '../../hooks/useSpecialRolls';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface SpecialRollsScreenProps {
  onBack: () => void;
}

// Hook simples de toast para o totem
const useToast = () => {
  const addToast = (msg: { type: string; message: string }) => {
    if (msg.type === 'success') {
      alert(`✓ ${msg.message}`);
    } else if (msg.type === 'error') {
      alert(`✗ ${msg.message}`);
    } else {
      alert(msg.message);
    }
  };
  return { addToast };
};

const COMMON_ITEMS = [
  'Lençol Hospitalar',
  'Cobertor',
  'Toalha de Banho',
  'Fronha',
  'Jaleco',
  'Uniforme Completo',
  'Cortina Hospitalar',
  'Tapete',
  'Outros'
];

const STATUS_LABELS: Record<string, string> = {
  received: 'Recebido',
  in_process: 'Em Processo',
  ready: 'Pronto',
  dispatched: 'Despachado',
  returned: 'Devolvido'
};

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800',
  in_process: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  dispatched: 'bg-gray-100 text-gray-800',
  returned: 'bg-purple-100 text-purple-800'
};

export const SpecialRollsScreen: React.FC<SpecialRollsScreenProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const { selectedClient } = useClients();
  const { rolls, loading, createRoll, addEvent, refreshData } = useSpecialRolls({
    apiBaseUrl: settings.server.baseUrl,
    clientId: selectedClient?.id || settings.totem.clientId
  });
  const { addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    number: '',
    itemName: '',
    quantity: '1',
    priority: '1'
  });

  const activeRolls = rolls.filter(r => r.status !== 'dispatched' && r.status !== 'returned');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.number || !formData.itemName) {
      addToast({ type: 'error', message: 'Preencha o número e o item' });
      return;
    }

    try {
      const result = await createRoll({
        number: formData.number,
        itemName: formData.itemName,
        quantity: parseInt(formData.quantity) || 1,
        priority: parseInt(formData.priority),
        status: 'received',
        currentLocation: 'Totem Recepção',
        clientId: selectedClient?.id || settings.totem.clientId
      });

      if (result) {
        await addEvent(result.id, {
          eventType: 'received',
          note: 'Recebido no totem',
          location: 'Totem Recepção'
        });

        addToast({ type: 'success', message: `Rolo #${formData.number} cadastrado!` });
        setIsModalOpen(false);
        setFormData({ number: '', itemName: '', quantity: '1', priority: '1' });
        await refreshData();
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Erro ao cadastrar rolo' });
    }
  };

  if (loading) {
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
                Rolos Especiais
              </h1>
            </div>
            <Button onClick={() => setIsModalOpen(true)} variant="primary" size="md" icon={Plus}>
              Novo Rolo
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Resumo - ESTILO ECOLAV */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-6 bg-white border-2 border-blue-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Rolos Ativos</p>
                <p className="text-3xl font-bold text-blue-700">{activeRolls.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-6 bg-white border-2 border-green-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Prontos</p>
                <p className="text-3xl font-bold text-green-700">
                  {rolls.filter(r => r.status === 'ready').length}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-6 bg-white border-2 border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Package className="text-gray-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Despachados</p>
                <p className="text-3xl font-bold text-gray-700">
                  {rolls.filter(r => r.status === 'dispatched').length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Lista - ESTILO ECOLAV */}
        <Card className="bg-white border-2 border-gray-200">
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Rolos Cadastrados</h2>
            
            {rolls.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="mx-auto mb-4 text-gray-400" size={48} />
                <p>Nenhum rolo cadastrado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rolls.map(roll => (
                  <div
                    key={roll.id}
                    className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-800">#{roll.number}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[roll.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[roll.status] || roll.status}
                          </span>
                          {roll.priority && roll.priority >= 3 && (
                            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
                              Alta Prioridade
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Item:</span>
                            <span className="ml-2 font-semibold text-gray-900">{roll.itemName}</span>
                          </div>
                          {roll.quantity && (
                            <div>
                              <span className="text-gray-600">Quantidade:</span>
                              <span className="ml-2 font-semibold text-gray-900">{roll.quantity}</span>
                            </div>
                          )}
                          {roll.currentLocation && (
                            <div>
                              <span className="text-gray-600">Local:</span>
                              <span className="ml-2 font-semibold text-gray-900">{roll.currentLocation}</span>
                            </div>
                          )}
                        </div>
                        {roll.description && (
                          <p className="text-sm text-gray-600 mt-2">{roll.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Modal - ESTILO ECOLAV SIMPLES */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-white">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Cadastrar Rolo Especial</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Número do Rolo *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      placeholder="Ex: R-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Item *
                    </label>
                    <select
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                      value={formData.itemName}
                      onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                    >
                      <option value="">Selecione...</option>
                      {COMMON_ITEMS.map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Quantidade
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Prioridade
                    </label>
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:border-blue-500 focus:outline-none"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="1">1 - Normal</option>
                      <option value="2">2 - Média</option>
                      <option value="3">3 - Alta</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" size="md">
                    Cadastrar
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
