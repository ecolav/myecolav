import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, Printer, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useScaleReader } from '../../hooks/useScaleReader';
// Tipos por roupa foram removidos do fluxo; seleção é por cliente via modal

interface WeighingScreenProps {
  onBack: () => void;
}

interface RFIDTag {
  id: string;
  status: 'conforme' | 'costura' | 'manchado' | 'descarte';
  weight: number;
}

interface ServiceOrder {
  id: string;
  title: string;
  collectDate: string;
  deliveryDate: string;
  priority: 'normal' | 'alta';
}

interface WeighingEntry {
  id: string;
  cageId: string;
  clothingType: string;
  tare: number;
  total: number;
  net: number;
  pieceCount: number;
  timestamp: Date;
}

export const WeighingScreen: React.FC<WeighingScreenProps> = ({ onBack }) => {
  const [step, setStep] = useState<'select-client' | 'select-os' | 'weighing' | 'confirmation'>('select-client');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [clientQuery, setClientQuery] = useState('');
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [osQuery, setOsQuery] = useState('');
  const { weight, isStable, connected, zero } = useScaleReader({ mode: 'mock' });
  const [rfidTags, setRfidTags] = useState<RFIDTag[]>([]);
  const [cageTare, setCageTare] = useState(0);
  const [cageBarcode, setCageBarcode] = useState('');
  const [weighings, setWeighings] = useState<WeighingEntry[]>([]);
  // Timer removido; estabilidade vem do hook de balança
  // const stableTimer = useRef<number | null>(null);
  // Estado para controlar abas no painel esquerdo (layout semelhante ao print)
  const [activeTab, setActiveTab] = useState<'gaiolas' | 'quantidade' | 'pesagem'>('pesagem');
  // Relógio e status
  const [now, setNow] = useState<Date>(new Date());
  const [antennaOnline] = useState<boolean>(true);
  // Tipo de roupa e modal
  const [selectedType, setSelectedType] = useState<'MISTO' | 'LENÇÓIS' | 'TOALHAS' | 'COBERTORES'>('MISTO');
  const [showTypeModal, setShowTypeModal] = useState<boolean>(false);

  // Tipos removidos neste layout; fluxo é por cliente/OS

  const clients = [
    { id: 'cli-001', name: 'Hospital São Lucas' },
    { id: 'cli-002', name: 'Indústria MetalWorks' },
    { id: 'cli-003', name: 'Clínica Vida' },
    { id: 'cli-004', name: 'Hotel Primavera' }
  ];

  // Ordens de serviço abertas simuladas por cliente
  const openOrdersByClient: Record<string, ServiceOrder[]> = {
    'cli-001': [
      { id: 'os-1001', title: 'Coleta diária', collectDate: '2025-08-21', deliveryDate: '2025-08-23', priority: 'normal' },
      { id: 'os-1002', title: 'Extra UTIs', collectDate: '2025-08-21', deliveryDate: '2025-08-22', priority: 'alta' }
    ],
    'cli-002': [
      { id: 'os-2001', title: 'Turno A', collectDate: '2025-08-21', deliveryDate: '2025-08-22', priority: 'normal' }
    ],
    'cli-003': [],
    'cli-004': [
      { id: 'os-4001', title: 'Hotelaria', collectDate: '2025-08-20', deliveryDate: '2025-08-22', priority: 'normal' },
    ]
  };

  // Mapeamento simulado: código de barras -> tara da gaiola (kg)
  const barcodeToTare: Record<string, number> = {
    'GAI-001': 5,
    'GAI-002': 7.5,
    'GAI-003': 6.2,
  };

  // Atualiza tara ao ler código
  const onChangeBarcode = (value: string) => {
    setCageBarcode(value.toUpperCase());
    const found = barcodeToTare[value.toUpperCase()];
    setCageTare(typeof found === 'number' ? found : 0);
  };

  // Estabilidade agora vem do hook da balança

  // Atualiza o relógio a cada segundo para refletir o cabeçalho da tela clássica
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const registerWeighing = () => {
    if (!isStable || !selectedClient) return;
    const entry: WeighingEntry = {
      id: `W${Date.now()}`,
      cageId: cageBarcode || 'SEM-CODIGO',
      clothingType: selectedType,
      tare: cageTare,
      total: weight,
      net: Math.max(0, weight - cageTare),
      pieceCount: rfidTags.length,
      timestamp: new Date(),
    };
    setWeighings(prev => [entry, ...prev]);
    // Reseta para próxima pesagem
    zero();
    setRfidTags([]);
    // estabilidade é recalculada pelo hook
    setCageBarcode('');
    // Mantém a tara para próxima leitura da mesma gaiola somente se código for o mesmo
  };

  const statusColors = {
    conforme: 'bg-emerald-500',
    costura: 'bg-yellow-500',
    manchado: 'bg-orange-500',
    descarte: 'bg-red-500'
  };

  const statusLabels = {
    conforme: 'Conforme',
    costura: 'Problema Costura',
    manchado: 'Manchado',
    descarte: 'Descarte'
  };

  // Paginação da lista de clientes no modal
  const pageSize = 10;
  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientQuery.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const visibleClients = filteredClients.slice(page * pageSize, page * pageSize + pageSize);

  useEffect(() => {
    setPage(0);
  }, [clientQuery]);

  const handleClientSelect = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    // Após escolher cliente, abrir modal de OS
    setSelectedOrder(null);
    setOsQuery('');
    setStep('select-os');
  };

  const handleOrderSelect = (order: ServiceOrder) => {
    setSelectedOrder(order);
    setStep('weighing');
  };

  // Leitura RFID simulada foi removida neste layout

  // Confirmação passa a ser acionada por ações de rodapé (se necessário)

  const getStatusCounts = () => {
    return rfidTags.reduce((acc, tag) => {
      acc[tag.status] = (acc[tag.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  // Resumos para layout estilo solicitado
  const typeSummary = weighings.reduce((acc, w) => {
    acc[w.clothingType] = (acc[w.clothingType] || 0) + w.pieceCount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header inspirado na UI clássica: área de título e relógio */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-white/20 px-4 md:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white/60">
              Voltar
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              {selectedClient ? selectedClient.name : 'Cliente não selecionado'}{selectedOrder ? ` - ${selectedOrder.collectDate}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm text-gray-600 font-semibold bg-white/60 rounded-full px-4 py-2 border border-white/20">
              {now.toLocaleDateString('pt-BR')} • {now.toLocaleTimeString('pt-BR')}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8">
        {step === 'select-client' && null}

        {step === 'weighing' && (
          <div className="space-y-4">
            {/* Barra superior com peso, tipo e status */}
            <Card className="border-white/20">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="text-gray-700 font-bold uppercase tracking-widest">PESO</div>
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-emerald-400 font-mono text-4xl px-8 py-3 rounded-2xl shadow-2xl border-4 border-emerald-300">
                    {weight.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </div>
                  {/* Botão de tipo de roupa com modal */}
                  <button
                    onClick={() => setShowTypeModal(true)}
                    className="px-4 py-2 min-w-[100px] rounded-xl bg-white/80 border border-gray-200 font-semibold hover:bg-white"
                  >
                    {selectedType}
                  </button>
                  <div className="text-gray-700">Peça: <span className="font-bold">{rfidTags.length}</span></div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 bg-white/60 rounded-full px-3 py-1 border border-white/20">
                    <span className="text-sm text-gray-700">Antena</span>
                    <span className={`w-3 h-3 rounded-full ${antennaOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/60 rounded-full px-3 py-1 border border-white/20">
                    <span className="text-sm text-gray-700">Balança</span>
                    <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Conteúdo em duas colunas: abas à esquerda e tabela à direita */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1">
                <Card>
                  <div className="flex gap-2 mb-4">
                    {['gaiolas','quantidade','pesagem'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-3 py-1.5 rounded-xl border ${activeTab === tab ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/70 text-gray-700 border-gray-200 hover:bg-white'}`}
                      >
                        {tab === 'gaiolas' && 'Gaiolas'}
                        {tab === 'quantidade' && 'Quantidade'}
                        {tab === 'pesagem' && 'Pesagem'}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'gaiolas' && (
                    <div className="h-64 flex items-center justify-center text-gray-500">Não há valores</div>
                  )}
                  {activeTab === 'quantidade' && (
                    <div className="h-64 overflow-y-auto">
                      {Object.keys(typeSummary).length === 0 && (
                        <div className="h-full flex items-center justify-center text-gray-500">Não há valores</div>
                      )}
                      {Object.entries(typeSummary).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between border-b py-2">
                          <span className="text-gray-700">{type}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeTab === 'pesagem' && (
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700">Código da Gaiola</label>
                      <input
                        type="text"
                        value={cageBarcode}
                        onChange={(e) => onChangeBarcode(e.target.value)}
                        placeholder="GAI-001"
                        className="w-full px-3 py-2 border rounded"
                      />
                      <label className="block text-sm font-semibold text-gray-700">Tara (kg)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={cageTare}
                        onChange={(e) => setCageTare(Number.isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border rounded"
                      />
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded ${isStable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{isStable ? 'Peso estável' : 'Aguardando...'}</span>
                        <Button onClick={registerWeighing} variant="success" size="sm" disabled={!isStable || weight <= 0}>Registrar</Button>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              <div className="lg:col-span-2">
                <Card>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="text-sm text-gray-700 bg-gradient-to-r from-blue-50 to-emerald-50 border-y border-gray-200">
                          <th className="px-3 py-2">Gaiola</th>
                          <th className="px-3 py-2">Tipo de roupa</th>
                          <th className="px-3 py-2">Peso (Kg)</th>
                          <th className="px-3 py-2">Peça</th>
                          <th className="px-3 py-2">Hora</th>
                          <th className="px-3 py-2">...</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weighings.length === 0 && (
                          <tr>
                            <td className="px-3 py-4 text-gray-500" colSpan={6}>Nenhuma pesagem registrada.</td>
                          </tr>
                        )}
                        {weighings.map((w) => (
                          <tr key={w.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono">{w.cageId}</td>
                            <td className="px-3 py-2">{w.clothingType}</td>
                            <td className="px-3 py-2">{w.net.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2">{w.pieceCount}</td>
                            <td className="px-3 py-2">{w.timestamp.toLocaleTimeString('pt-BR')}</td>
                            <td className="px-3 py-2">
                              <input type="checkbox" className="w-4 h-4" />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>

            {/* Rodapé com totais e ações */}
            <Card>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                <div className="text-lg">Total lidas: <span className="font-bold">{rfidTags.length}</span></div>
                <div className="text-sm text-gray-600">
                  <div>Total cliente inválido:</div>
                  <div>Total sem cadastro:</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                    {weighings.reduce((a, b) => a + b.net, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <Button variant="secondary" size="md" className="bg-white/80">Iniciar</Button>
                  <Button variant="success" size="md">Finalizar</Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="max-w-4xl mx-auto">
            <Card>
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={40} className="text-white" />
                </div>
                <h2 className="text-4xl font-bold text-gray-800 mb-4">Pesagem Confirmada</h2>
                <p className="text-xl text-gray-600">Dados registrados com sucesso no sistema</p>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Resumo da Pesagem</h3>
                  <div className="space-y-3">
                    {selectedClient && (
                    <div className="flex justify-between">
                        <span className="text-gray-600">Cliente:</span>
                        <span className="font-semibold">{selectedClient.name}</span>
                    </div>
                    )}
                    {/* Tipo removido do fluxo; mantemos apenas cliente e dados de pesagem */}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peso Total:</span>
                      <span className="font-bold text-2xl text-blue-800">{weight.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peças:</span>
                      <span className="font-semibold">{rfidTags.length} unidades</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Horário:</span>
                      <span className="font-semibold">{new Date().toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-2xl">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Análise de Conformidade</h3>
                  <div className="space-y-3">
                    {Object.entries(getStatusCounts()).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 ${statusColors[status as keyof typeof statusColors]} rounded-full`}></div>
                          <span className="text-gray-600">{statusLabels[status as keyof typeof statusLabels]}:</span>
                        </div>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taxa de Conformidade:</span>
                      <span className="font-bold text-emerald-700">
                        {((getStatusCounts().conforme || 0) / rfidTags.length * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center mb-8">
                <div className="inline-block bg-white p-6 border-4 border-gray-200 rounded-2xl shadow-lg">
                  <div className="w-48 h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white text-lg font-mono rounded-xl">
                    <div className="text-center">
                      <div className="text-2xl mb-2">📱</div>
                      <div>QR CODE</div>
                      <div className="text-sm mt-2">#{Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
                    </div>
                  </div>
                </div>
                <p className="text-lg text-gray-600 mt-4">Escaneie para acompanhar o processamento</p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-6">
                <Button
                  onClick={() => {
                    setStep('select-client');
                    zero();
                    setRfidTags([]);
                  }}
                  variant="secondary"
                  size="lg"
                >
                  Nova Pesagem
                </Button>
                <Button
                  onClick={() => alert('Gerando relatório de conformidade...')}
                  variant="success"
                  size="lg"
                  icon={Printer}
                >
                  Gerar Relatório
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Modal de Tipo de Roupa */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTypeModal(false)}></div>
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Selecionar Tipo de Roupa</h3>
              <button onClick={() => setShowTypeModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-3">
              {(['MISTO','LENÇÓIS','TOALHAS','COBERTORES'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => { setSelectedType(type); setShowTypeModal(false); }}
                  className={`px-4 py-3 rounded-xl border text-lg font-semibold ${selectedType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/80 text-gray-800 border-gray-200 hover:bg-white'}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setShowTypeModal(false)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Cliente */}
      {step === 'select-client' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStep('weighing')}></div>
          <div className="relative w-full max-w-2xl md:max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Selecionar Cliente</h3>
              <button onClick={() => setStep('weighing')} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar</label>
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2">
                  <Search size={18} className="text-gray-500" />
                  <input
                    type="text"
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                    placeholder="Digite o nome do cliente..."
                    className="w-full outline-none"
                  />
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
                {visibleClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">{client.name}</div>
                      <div className="text-xs text-gray-500">{client.id}</div>
                    </div>
                    <span className="text-gray-400">Selecionar</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  icon={ChevronLeft}
                >
                  Anterior
                </Button>
                <div className="text-sm text-gray-600">
                  Página {page + 1} de {totalPages}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  icon={ChevronRight}
                >
                  Próxima
                </Button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setStep('weighing')}>Fechar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de OS */}
      {step === 'select-os' && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStep('weighing')}></div>
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">Selecionar OS - {selectedClient.name}</h3>
              <button onClick={() => setStep('weighing')} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar</label>
                <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2">
                  <Search size={18} className="text-gray-500" />
                  <input
                    type="text"
                    value={osQuery}
                    onChange={(e) => setOsQuery(e.target.value)}
                    placeholder="Digite título ou código da OS..."
                    className="w-full outline-none"
                  />
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 rounded-xl border border-gray-200">
                {(openOrdersByClient[selectedClient.id] || [])
                  .filter(o => (o.title + o.id).toLowerCase().includes(osQuery.toLowerCase()))
                  .map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleOrderSelect(order)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-800">{order.title} <span className="text-xs text-gray-500">({order.id})</span></div>
                          <div className="text-xs text-gray-500">Coleta: {order.collectDate} • Entrega: {order.deliveryDate}</div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${order.priority === 'alta' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                          {order.priority === 'alta' ? 'Alta' : 'Normal'}
                        </span>
                      </div>
                    </button>
                ))}
                {openOrdersByClient[selectedClient.id] && openOrdersByClient[selectedClient.id].length === 0 && (
                  <div className="px-4 py-6 text-center text-gray-500">Nenhuma OS aberta para este cliente.</div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={() => setStep('weighing')}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};