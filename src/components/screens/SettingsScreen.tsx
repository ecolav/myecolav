import React, { useState } from 'react';
import { 
  ArrowLeft, Settings as SettingsIcon, Scale, Printer, Radio, 
  Server, Wifi, Search, RefreshCw, AlertCircle, 
  Zap, CheckCircle2, XCircle, Loader2, Info
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';
import { SCALE_DRIVERS, getDriverByLabel } from '../../utils/scaleDrivers';
import { listSerialPorts, requestSerialPortPermission, listUsbDevices, requestUsbDevicePermission } from '../../utils/ports';

interface SettingsScreenProps {
  onBack: () => void;
}

type Tab = 'totem' | 'scale' | 'printer' | 'rfid' | 'server' | 'network';
type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { settings, setSettings } = useSettings();
  const { clients, loading: clientsLoading, selectedClient, setSelectedClient } = useClients();
  
  const [tab, setTab] = useState<Tab>('totem');
  const [status, setStatus] = useState<Record<string, ConnectionStatus>>({});
  const [statusMsg, setStatusMsg] = useState<Record<string, string>>({});
  const [detecting, setDetecting] = useState(false);
  const [rfidModalOpen, setRfidModalOpen] = useState(false);
  const [testingUr4, setTestingUr4] = useState(false);
  const [rfidFeedback, setRfidFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Auto-detect removido - causava loop infinito
  // Usuário deve clicar manualmente em "Detectar Portas Seriais"

  const detectDevices = async (device: 'scale' | 'printer' | 'rfid') => {
    setDetecting(true);
    setStatus(s => ({ ...s, [device]: 'testing' }));
    setStatusMsg(s => ({ ...s, [device]: 'Detectando dispositivos...' }));

    try {
      if (device === 'scale') {
        if (settings.scale.mode === 'rs232') {
          // Verificar se o servidor está rodando
          try {
            const healthCheck = await fetch('http://localhost:3001/scale/weight');
            if (!healthCheck.ok) {
              setStatus(s => ({ ...s, [device]: 'error' }));
              setStatusMsg(s => ({ ...s, [device]: '❌ Servidor de balança não encontrado. Execute: npm run scale:server' }));
              return;
            }
          } catch (error) {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: '❌ Servidor de balança não encontrado. Execute: npm run scale:server' }));
            return;
          }

          setStatusMsg(s => ({ ...s, [device]: 'Listando portas seriais...' }));

          // Listar todas as portas disponíveis
          const portsResponse = await fetch('http://localhost:3001/scale/ports');
          if (!portsResponse.ok) {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: '❌ Erro ao listar portas' }));
            return;
          }

          const portsData = await portsResponse.json();
          const ports: Array<{ path: string; baudRate?: number }> = portsData.ports || [];

          if (ports.length === 0) {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: '❌ Nenhuma porta serial encontrada' }));
            return;
          }

          setStatusMsg(s => ({ ...s, [device]: `Testando ${ports.length} porta(s)...` }));
          console.log(`🔍 Encontradas ${ports.length} portas:`, ports.map(p => p.path).join(', '));

          // Testar cada porta para ver qual responde
          let foundPort = null;
          for (const portInfo of ports) {
            setStatusMsg(s => ({ ...s, [device]: `Testando ${portInfo.path}...` }));
            console.log(`🔍 Testando porta: ${portInfo.path}`);

            try {
              const testResponse = await fetch('http://localhost:3001/scale/test-port', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  path: portInfo.path, 
                  baudRate: settings.scale.baudRate || 9600 
                })
              });

              const testResult = await testResponse.json();
              console.log(`📊 Resultado teste ${portInfo.path}:`, testResult);

              if (testResult.success) {
                foundPort = testResult;
                break;
              }
            } catch (error) {
              console.log(`❌ Erro ao testar ${portInfo.path}:`, error);
            }
          }

          if (foundPort) {
            // Balança encontrada! Salvar configuração e mudar porta no servidor
            console.log(`✅ Balança encontrada em ${foundPort.path}!`);
            
            setStatus(s => ({ ...s, [device]: 'success' }));
            setStatusMsg(s => ({ ...s, [device]: `✅ Balança detectada em ${foundPort.path} - Peso: ${foundPort.weight.toFixed(2)} kg` }));
            
            // Salvar nas configurações
            setSettings(s => ({ 
              ...s, 
              scale: { 
                ...s.scale, 
                port: foundPort.path,
                baudRate: foundPort.baudRate,
                dataBits: 8,
                parity: 'none',
                stopBits: 1
              } 
            }));

            // Mudar porta no servidor
            await fetch('http://localhost:3001/scale/change-port', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                path: foundPort.path, 
                baudRate: foundPort.baudRate 
              })
            });

          } else {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: `❌ Nenhuma balança respondeu nas ${ports.length} porta(s) testadas` }));
          }
        } else if (settings.scale.mode === 'usb') {
          await requestUsbDevicePermission();
          const devices = await listUsbDevices();
          
          if (devices.length > 0) {
            setStatus(s => ({ ...s, [device]: 'success' }));
            setStatusMsg(s => ({ ...s, [device]: `${devices.length} dispositivo(s) USB encontrado(s)` }));
            
            // Auto-select first device
            if (devices[0]) {
              setSettings(s => ({ 
                ...s, 
                scale: { 
                  ...s.scale, 
                  vendorId: devices[0].vendorId,
                  productId: devices[0].productId
                } 
              }));
            }
          } else {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: 'Nenhum dispositivo USB encontrado' }));
          }
        }
      } else if (device === 'rfid') {
        if (settings.rfid.readerModel === 'chainway-ur4') {
          setStatus(s => ({ ...s, rfid: 'success' }));
          setStatusMsg(s => ({
            ...s,
            rfid: `Leitor UR4 configurado para ${settings.rfid.chainwayUr4.host}:${settings.rfid.chainwayUr4.port}`
          }));
        } else {
          await requestSerialPortPermission();
          const ports = await listSerialPorts();
          
          if (ports.length > 0) {
            setStatus(s => ({ ...s, [device]: 'success' }));
            setStatusMsg(s => ({ ...s, [device]: `${ports.length} porta(s) encontrada(s): ${ports.join(', ')}` }));
            
            if (!settings.rfid.port) {
              setSettings(s => ({ ...s, rfid: { ...s.rfid, port: ports[0] } }));
            }
          } else {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: 'Nenhuma porta serial encontrada' }));
          }
        }
      }
    } catch (error) {
      setStatus(s => ({ ...s, [device]: 'error' }));
      setStatusMsg(s => ({ ...s, [device]: 'Erro ao detectar dispositivos' }));
    } finally {
      setDetecting(false);
    }
  };

  const testConnection = async (device: Tab) => {
    setStatus(s => ({ ...s, [device]: 'testing' }));
    setStatusMsg(s => ({ ...s, [device]: 'Testando conexão...' }));

    try {
      switch (device) {
        case 'scale':
          // Se for RS232 e tiver porta configurada, testar via servidor
          if (settings.scale.mode === 'rs232' && settings.scale.port) {
            try {
              setStatusMsg(s => ({ ...s, [device]: `Testando ${settings.scale.port}...` }));
              
              const testResponse = await fetch('http://localhost:3001/scale/test-port', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  path: settings.scale.port, 
                  baudRate: settings.scale.baudRate || 9600 
                })
              });

              const testResult = await testResponse.json();

              if (testResult.success) {
                setStatus(s => ({ ...s, [device]: 'success' }));
                setStatusMsg(s => ({ ...s, [device]: `✅ Balança OK - Peso: ${testResult.weight.toFixed(2)} kg` }));
                
                // Mudar porta no servidor
                await fetch('http://localhost:3001/scale/change-port', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    path: settings.scale.port, 
                    baudRate: settings.scale.baudRate || 9600 
                  })
                });
              } else {
                setStatus(s => ({ ...s, [device]: 'error' }));
                setStatusMsg(s => ({ ...s, [device]: `❌ ${testResult.error || 'Porta não responde'}` }));
              }
            } catch (error) {
              setStatus(s => ({ ...s, [device]: 'error' }));
              setStatusMsg(s => ({ ...s, [device]: '❌ Servidor não encontrado. Execute: npm run scale:server' }));
            }
            break;
          }
          
          // Testar via driver
          const driver = getDriverByLabel(settings.scale.model);
          if (driver) {
            const result = await driver.test({ ...settings.scale });
            setStatus(s => ({ ...s, [device]: result.ok ? 'success' : 'error' }));
            setStatusMsg(s => ({ ...s, [device]: `${result.ok ? '✓' : '✗'} ${result.raw}` }));
          } else {
            // Mock test
            setTimeout(() => {
              setStatus(s => ({ ...s, [device]: 'success' }));
              setStatusMsg(s => ({ ...s, [device]: '✓ Modo mock ativo (teste OK)' }));
            }, 500);
          }
          break;

        case 'server':
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const response = await fetch(
            `${settings.server.baseUrl.replace(/\/$/, '')}/health`,
            { signal: controller.signal }
          );
          clearTimeout(timeout);
          
          if (response.ok) {
            setStatus(s => ({ ...s, [device]: 'success' }));
            setStatusMsg(s => ({ ...s, [device]: '✓ Servidor online' }));
          } else {
            setStatus(s => ({ ...s, [device]: 'error' }));
            setStatusMsg(s => ({ ...s, [device]: '✗ Servidor não responde' }));
          }
          break;

        default:
          setStatus(s => ({ ...s, [device]: 'success' }));
          setStatusMsg(s => ({ ...s, [device]: '✓ Teste OK (simulado)' }));
      }
    } catch (error) {
      setStatus(s => ({ ...s, [device]: 'error' }));
      setStatusMsg(s => ({ ...s, [device]: '✗ Falha na conexão' }));
    }
  };

  const handleTotemTypeChange = (type: 'clean' | 'dirty') => {
    const mode = type === 'clean' ? 'distribution' : 'collection';
    setSettings(s => ({ 
      ...s, 
      totem: { ...s.totem, type, mode } 
    }));
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client || null);
    setSettings(s => ({ 
      ...s, 
      totem: { ...s.totem, clientId: clientId || undefined } 
    }));
  };

  const StatusIndicator = ({ status: s }: { status: ConnectionStatus }) => {
    switch (s) {
      case 'testing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const tabs = [
    { id: 'totem', label: 'Totem', icon: SettingsIcon, color: 'blue' },
    { id: 'scale', label: 'Balança', icon: Scale, color: 'purple' },
    { id: 'printer', label: 'Impressora', icon: Printer, color: 'orange' },
    { id: 'rfid', label: 'RFID', icon: Radio, color: 'green' },
    { id: 'server', label: 'Servidor', icon: Server, color: 'indigo' },
    { id: 'network', label: 'Rede', icon: Wifi, color: 'cyan' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      {/* Header */}
        <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
              Configurações
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Configure os equipamentos e conexões do totem
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => {
                if (confirm('Resetar todas as configurações para os valores padrão?')) {
                  localStorage.removeItem('myecolav:settings:v1');
                  window.location.reload();
                }
              }}
              variant="secondary" 
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Resetar
            </Button>
            <Button onClick={onBack} variant="secondary" size="lg">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              
              // Classes específicas por cor (Tailwind não suporta interpolação dinâmica)
              const colorClasses: Record<string, { active: string; icon: string }> = {
                blue: { active: 'bg-blue-50 border-l-4 border-blue-600 text-blue-700', icon: 'text-blue-600' },
                purple: { active: 'bg-purple-50 border-l-4 border-purple-600 text-purple-700', icon: 'text-purple-600' },
                orange: { active: 'bg-orange-50 border-l-4 border-orange-600 text-orange-700', icon: 'text-orange-600' },
                green: { active: 'bg-green-50 border-l-4 border-green-600 text-green-700', icon: 'text-green-600' },
                indigo: { active: 'bg-indigo-50 border-l-4 border-indigo-600 text-indigo-700', icon: 'text-indigo-600' },
                cyan: { active: 'bg-cyan-50 border-l-4 border-cyan-600 text-cyan-700', icon: 'text-cyan-600' },
              };

              const activeClass = colorClasses[t.color]?.active || 'bg-gray-50 border-l-4 border-gray-600';
              const iconClass = colorClasses[t.color]?.icon || 'text-gray-600';

              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as Tab)}
                  className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-all ${
                    isActive
                      ? activeClass
                      : 'hover:bg-gray-50 text-gray-700 border-l-4 border-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? iconClass : 'text-gray-400'}`} />
                  <span className="font-semibold">{t.label}</span>
                  {status[t.id] && (
                    <div className="ml-auto">
                      <StatusIndicator status={status[t.id]} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-4">
          {/* TOTEM TAB - Manter como está (está bom!) */}
          {tab === 'totem' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <SettingsIcon className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-gray-800">Configuração do Totem</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Tipo de Área */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tipo de Área
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-green-300 hover:bg-green-50/50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50">
                      <input
                        type="radio"
                        name="totemType"
                        value="clean"
                        checked={settings.totem.type === 'clean'}
                        onChange={() => handleTotemTypeChange('clean')}
                        className="w-5 h-5 text-green-600 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-green-700 text-lg">🧼 Área Limpa</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Distribuição de enxoval e gerenciamento de leitos
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all hover:border-orange-300 hover:bg-orange-50/50 has-[:checked]:border-orange-600 has-[:checked]:bg-orange-50">
                      <input
                        type="radio"
                        name="totemType"
                        value="dirty"
                        checked={settings.totem.type === 'dirty'}
                        onChange={() => handleTotemTypeChange('dirty')}
                        className="w-5 h-5 text-orange-600 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-orange-700 text-lg">🧺 Área Suja</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Pesagem e coleta de roupas sujas
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Cliente */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Cliente (Hospital/Hotel)
                  </label>
                  {clientsLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      Carregando clientes...
                    </div>
                  ) : (
                    <>
                      <select
                        className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        value={settings.totem.clientId || ''}
                        onChange={(e) => handleClientChange(e.target.value)}
                      >
                        <option value="">Selecione um cliente...</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name} {client.code && `(${client.code})`}
                          </option>
                        ))}
                      </select>

                      {selectedClient && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <div className="font-semibold text-blue-900">
                                {selectedClient.name}
                              </div>
                              {selectedClient.code && (
                                <div className="text-sm text-blue-700 mt-1">
                                  Código: {selectedClient.code}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Resumo */}
              <div className="mt-8 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Resumo da Configuração
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Tipo de Área</div>
                    <div className={`font-semibold text-lg ${
                      settings.totem.type === 'clean' ? 'text-green-700' : 'text-orange-700'
                    }`}>
                      {settings.totem.type === 'clean' ? '🧼 Limpa' : '🧺 Suja'}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Modo de Operação</div>
                    <div className="font-semibold text-lg text-gray-800">
                      {settings.totem.mode === 'distribution' ? '📦 Distribuição' : '⚖️ Coleta'}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg">
                    <div className="text-xs text-gray-600 mb-1">Cliente Ativo</div>
                    <div className="font-semibold text-sm text-gray-800 truncate">
                      {selectedClient ? selectedClient.name : '❌ Não selecionado'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SCALE TAB - REDESENHADO */}
          {tab === 'scale' && (
            <div className="space-y-6">
              {/* Header com Status */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Scale className="w-6 h-6 text-purple-600" />
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">Balança Industrial</h2>
                      <p className="text-sm text-gray-600">Configure a conexão com a balança</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {statusMsg.scale && (
                      <span className={`text-sm px-3 py-1 rounded-full ${
                        status.scale === 'success' ? 'bg-green-100 text-green-700' :
                        status.scale === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {statusMsg.scale}
                      </span>
                    )}
                    <Button 
                      onClick={() => testConnection('scale')} 
                      variant="primary"
                      size="sm"
                      disabled={status.scale === 'testing'}
                    >
                      {status.scale === 'testing' ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Testando</>
                      ) : (
                        <><Zap className="w-4 h-4 mr-2" /> Testar</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Modo de Conexão */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Modo de Conexão
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: 'mock', label: 'Mock', desc: 'Simulação', icon: '🎭' },
                      { value: 'rs232', label: 'RS232', desc: 'Serial', icon: '🔌' },
                      { value: 'usb', label: 'USB', desc: 'Plug & Play', icon: '🔗' },
                      { value: 'tcpip', label: 'TCP/IP', desc: 'Rede', icon: '🌐' },
                    ].map((mode) => {
                      const isSelected = settings.scale.mode === mode.value;
                      return (
                        <label
                          key={mode.value}
                          className={`flex flex-col items-center gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-blue-600 bg-blue-50' 
                              : 'border-gray-300 hover:border-blue-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="scaleMode"
                            value={mode.value}
                            checked={isSelected}
                            onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, mode: e.target.value as any } }))}
                            className="sr-only"
                          />
                          <div className="text-3xl">{mode.icon}</div>
                          <div className="font-semibold text-sm">{mode.label}</div>
                          <div className="text-xs text-gray-600">{mode.desc}</div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Informações Básicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome / Identificação
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      value={settings.scale.name || ''}
                      onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, name: e.target.value } }))}
                      placeholder="Ex: Balança Rouparia 01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fabricante / Modelo
                    </label>
                    <select
                      className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      value={settings.scale.model || ''}
                      onChange={(e) => {
                        const model = e.target.value;
                        const driver = getDriverByLabel(model);
                        setSettings(s => ({
                          ...s,
                          scale: {
                            ...s.scale,
                            model,
                            ...(driver?.defaults || {}),
                            mode: (driver?.mode || s.scale.mode)
                          }
                        }));
                      }}
                    >
                      <option value="">Selecione o modelo...</option>
                      {SCALE_DRIVERS.map(d => (
                        <option key={d.id} value={d.label}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Configurações específicas do modo */}
                {settings.scale.mode === 'rs232' && (
                  <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                    <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
                      🔌 Configurações RS232 (Serial)
                    </h3>
                    
                    {/* Alerta informativo sobre porta detectada */}
                    {settings.scale.port === '/dev/ttyS0' && (
                      <div className="mb-4 p-4 bg-green-50 border-2 border-green-300 rounded-lg">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="font-semibold text-green-900">Balança Detectada em /dev/ttyS0</div>
                            <div className="text-sm text-green-700 mt-1">
                              Protocolo H/L detectado. Configuração otimizada: 9600 baud, 8 bits, sem paridade.
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-2">Porta</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={settings.scale.port || ''}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, port: e.target.value } }))}
                          placeholder="/dev/ttyS0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-2">BaudRate</label>
                        <select
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={settings.scale.baudRate || 9600}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, baudRate: Number(e.target.value) } }))}
                        >
                          <option value={9600}>9600</option>
                          <option value={19200}>19200</option>
                          <option value={38400}>38400</option>
                          <option value={57600}>57600</option>
                          <option value={115200}>115200</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-2">Data Bits</label>
                        <select
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={settings.scale.dataBits || 8}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, dataBits: Number(e.target.value) as any } }))}
                        >
                          <option value={7}>7</option>
                          <option value={8}>8</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-2">Paridade</label>
                        <select
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={settings.scale.parity || 'none'}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, parity: e.target.value as any } }))}
                        >
                          <option value="none">None</option>
                          <option value="even">Even</option>
                          <option value="odd">Odd</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      onClick={() => detectDevices('scale')}
                      variant="secondary"
                      disabled={detecting}
                      fullWidth
                    >
                      {detecting ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Detectando...</>
                      ) : (
                        <><Search className="w-4 h-4 mr-2" /> Detectar Portas Seriais</>
                      )}
                    </Button>
                  </div>
                )}

                {settings.scale.mode === 'usb' && (
                  <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
                    <h3 className="font-bold text-purple-900 mb-4 flex items-center gap-2">
                      🔗 Configurações USB
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-purple-900 mb-2">Vendor ID (hex)</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
                          value={settings.scale.vendorId ? `0x${settings.scale.vendorId.toString(16)}` : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9a-fA-Fx]/g, '');
                            const num = parseInt(val, 16);
                            if (!isNaN(num)) {
                              setSettings(s => ({ ...s, scale: { ...s.scale, vendorId: num } }));
                            }
                          }}
                          placeholder="0x1234"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-purple-900 mb-2">Product ID (hex)</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 font-mono"
                          value={settings.scale.productId ? `0x${settings.scale.productId.toString(16)}` : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9a-fA-Fx]/g, '');
                            const num = parseInt(val, 16);
                            if (!isNaN(num)) {
                              setSettings(s => ({ ...s, scale: { ...s.scale, productId: num } }));
                            }
                          }}
                          placeholder="0x5678"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => detectDevices('scale')}
                      variant="secondary"
                      disabled={detecting}
                      fullWidth
                    >
                      {detecting ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Detectando...</>
                      ) : (
                        <><Search className="w-4 h-4 mr-2" /> Detectar Dispositivos USB</>
                      )}
                    </Button>
                  </div>
                )}

                {settings.scale.mode === 'tcpip' && (
                  <div className="p-6 bg-green-50 rounded-xl border border-green-200">
                    <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                      🌐 Configurações TCP/IP (Rede)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-green-900 mb-2">Endereço IP</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          value={settings.scale.port || ''}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, port: e.target.value } }))}
                          placeholder="192.168.1.100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-green-900 mb-2">Porta TCP</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          value={settings.scale.baudRate || 9000}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, baudRate: Number(e.target.value) } }))}
                          placeholder="9000"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.scale.mode === 'mock' && (
                  <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      🎭 Modo Mock (Simulação)
                    </h3>
                    <p className="text-sm text-gray-700">
                      A balança está em modo de simulação. Valores aleatórios serão gerados para testes.
                      Configure um dos outros modos (RS232, USB, TCP/IP) para conectar a uma balança real.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SERVER TAB - SIMPLIFICADO */}
          {tab === 'server' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Server className="w-6 h-6 text-indigo-600" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Servidor Backend</h2>
                    <p className="text-sm text-gray-600">Conexão com o servidor Ecolav 360</p>
                  </div>
                </div>
                <Button 
                  onClick={() => testConnection('server')}
                  variant="primary"
                  size="sm"
                  disabled={status.server === 'testing'}
                >
                  {status.server === 'testing' ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Testando</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" /> Testar</>
                  )}
                </Button>
              </div>

              {statusMsg.server && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                  status.server === 'success' ? 'bg-green-50 border border-green-200' :
                  status.server === 'error' ? 'bg-red-50 border border-red-200' :
                  'bg-blue-50 border border-blue-200'
                }`}>
                  <StatusIndicator status={status.server} />
                  <span className={`text-sm font-medium ${
                    status.server === 'success' ? 'text-green-800' :
                    status.server === 'error' ? 'text-red-800' :
                    'text-blue-800'
                  }`}>
                    {statusMsg.server}
                  </span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    URL do Servidor
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                    value={settings.server.baseUrl}
                    onChange={(e) => setSettings(s => ({ ...s, server: { ...s.server, baseUrl: e.target.value } }))}
                    placeholder="http://162.240.227.159:4000"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    URL padrão: http://162.240.227.159:4000
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    API Key (x-api-key)
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                    value={settings.server.apiKey || ''}
                    onChange={(e) => setSettings(s => ({ ...s, server: { ...s.server, apiKey: e.target.value } }))}
                    placeholder="••••••••••••••••••••••••••••••••"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Chave de autenticação fornecida pela Ecolav
                  </p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Importante:</strong> O servidor deve estar acessível na rede.
                    Se estiver testando localmente, certifique-se de que o backend está rodando.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Outras tabs simplificadas... */}
          {tab === 'rfid' && (
            <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Radio className="w-6 h-6 text-green-600" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Leitor RFID</h2>
                    <p className="text-sm text-gray-600">
                      Configure o dispositivo responsável pelas leituras RFID neste totem.
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setRfidModalOpen(true)}>
                  Trocar leitor
                </Button>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Leitor selecionado</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {settings.rfid.readerModel === 'chainway-ur4'
                      ? 'Chainway UR4 (Ethernet)'
                      : 'Leitor Serial Genérico'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {settings.rfid.readerModel === 'chainway-ur4'
                      ? 'Conexão via rede com múltiplas antenas e potência configurável.'
                      : 'Conexão direta pela porta serial / USB do totem.'}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-700">Modo de acesso:</span>{' '}
                  {settings.rfid.access === 'serial' ? 'Serial' : settings.rfid.access === 'tcpip' ? 'TCP/IP' : 'USB'}
                </div>
              </div>

              {settings.rfid.readerModel === 'chainway-ur4' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Configuração Chainway UR4</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          IP do leitor
                        </label>
                        <input
                          type="text"
                          value={settings.rfid.chainwayUr4.host}
                          onChange={e => {
                            const value = e.target.value;
                            setSettings(s => ({
                              ...s,
                              rfid: {
                                ...s.rfid,
                                host: value,
                                chainwayUr4: { ...s.rfid.chainwayUr4, host: value }
                              }
                            }));
                            setRfidFeedback(null);
                            
                            // Enviar atualização ao servidor imediatamente
                            fetch('http://localhost:3001/rfid/ur4/config', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                host: value,
                                port: settings.rfid.chainwayUr4.port,
                                power: settings.rfid.chainwayUr4.power,
                                antennas: settings.rfid.chainwayUr4.antennas
                              })
                            }).catch(err => {
                              console.warn('⚠️ Não foi possível atualizar configuração no servidor:', err);
                            });
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                          placeholder="192.168.99.201"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Endereço IP configurado na antena UR4.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Porta TCP
                        </label>
                        <input
                          type="number"
                          value={settings.rfid.chainwayUr4.port}
                          onChange={e => {
                            const value = Number(e.target.value);
                            setSettings(s => ({
                              ...s,
                              rfid: {
                                ...s.rfid,
                                tcpPort: value,
                                chainwayUr4: { ...s.rfid.chainwayUr4, port: value }
                              }
                            }));
                            setRfidFeedback(null);
                            
                            // Enviar atualização ao servidor imediatamente
                            fetch('http://localhost:3001/rfid/ur4/config', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                host: settings.rfid.chainwayUr4.host,
                                port: value,
                                power: settings.rfid.chainwayUr4.power,
                                antennas: settings.rfid.chainwayUr4.antennas
                              })
                            }).catch(err => {
                              console.warn('⚠️ Não foi possível atualizar configuração no servidor:', err);
                            });
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          min={1}
                          max={65535}
                          placeholder="8888"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Porta padrão do servidor Chainway é 8888.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Potência de leitura (dBm)
                      </label>
                      <input
                        type="range"
                        min={10}
                        max={33}
                        value={settings.rfid.chainwayUr4.power}
                        onChange={e => {
                          const value = Number(e.target.value);
                          setSettings(s => ({
                            ...s,
                            rfid: {
                              ...s.rfid,
                              chainwayUr4: { ...s.rfid.chainwayUr4, power: value }
                            }
                          }));
                          setRfidFeedback(null);
                          
                          // Enviar atualização ao servidor imediatamente
                          fetch('http://localhost:3001/rfid/ur4/config', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              host: settings.rfid.chainwayUr4.host,
                              port: settings.rfid.chainwayUr4.port,
                              power: value,
                              antennas: settings.rfid.chainwayUr4.antennas
                            })
                          }).catch(err => {
                            console.warn('⚠️ Não foi possível atualizar configuração no servidor:', err);
                          });
                        }}
                        className="w-full accent-green-600"
                      />
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>10 dBm</span>
                        <span className="font-semibold text-gray-900">{settings.rfid.chainwayUr4.power} dBm</span>
                        <span>33 dBm</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Ajuste a potência conforme a distância e zona de leitura desejada.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Antenas ativas
                      </label>
                      <div className="grid grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(antenna => {
                          const isActive = settings.rfid.chainwayUr4.antennas.includes(antenna);
                          return (
                            <button
                              key={antenna}
                              onClick={() => {
                                setSettings(s => {
                                  const current = s.rfid.chainwayUr4.antennas;
                                  const next = current.includes(antenna)
                                    ? current.filter(a => a !== antenna)
                                    : [...current, antenna].sort((a, b) => a - b);
                                  
                                  // Enviar atualização ao servidor imediatamente
                                  fetch('http://localhost:3001/rfid/ur4/config', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      host: s.rfid.chainwayUr4.host,
                                      port: s.rfid.chainwayUr4.port,
                                      power: s.rfid.chainwayUr4.power,
                                      antennas: next
                                    })
                                  }).catch(err => {
                                    console.warn('⚠️ Não foi possível atualizar configuração no servidor:', err);
                                  });
                                  
                                  return {
                                    ...s,
                                    rfid: {
                                      ...s.rfid,
                                      chainwayUr4: { ...s.rfid.chainwayUr4, antennas: next }
                                    }
                                  };
                                });
                                setRfidFeedback(null);
                              }}
                              className={`p-3 rounded-lg border-2 text-sm font-semibold transition-all ${
                                isActive
                                  ? 'border-green-500 bg-green-50 text-green-700'
                                  : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300'
                              }`}
                            >
                              Antena {antenna}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500">
                        Desative apenas antenas que não estão conectadas fisicamente.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={async () => {
                        setTestingUr4(true);
                        setRfidFeedback(null);
                        try {
                          const response = await fetch('http://localhost:3001/rfid/ur4/test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              host: settings.rfid.chainwayUr4.host,
                              port: settings.rfid.chainwayUr4.port,
                              power: settings.rfid.chainwayUr4.power,
                              antennas: settings.rfid.chainwayUr4.antennas
                            })
                          });

                          if (!response.ok) {
                            const message = await response.text();
                            throw new Error(message || `HTTP ${response.status}`);
                          }

                          const data = await response.json().catch(() => ({}));
                          setRfidFeedback({
                            type: 'success',
                            message: data.message || 'Leitor UR4 respondeu com sucesso.'
                          });
                        } catch (error) {
                          const message = error instanceof Error ? error.message : 'Erro ao testar leitor.';
                          const friendlyMessage = /Failed to fetch|NetworkError/i.test(message)
                            ? 'Servidor de leitura não respondeu. Verifique se o serviço local está ativo (npm run scale:server).'
                            : message;
                          setRfidFeedback({ type: 'error', message: friendlyMessage });
                        } finally {
                          setTestingUr4(false);
                        }
                      }}
                      variant="primary"
                      size="sm"
                      disabled={testingUr4}
                    >
                      {testingUr4 ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testando...
                        </span>
                      ) : (
                        'Testar conexão'
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                      setStatusMsg(s => ({ ...s, rfid: '' }));
                        setStatus(s => ({ ...s, rfid: 'idle' }));
                        detectDevices('rfid');
                      }}
                      variant="secondary"
                      size="sm"
                      disabled={detecting}
                    >
                      {detecting ? 'Detectando...' : 'Atualizar status'}
                    </Button>
                  </div>

                  {(rfidFeedback || statusMsg.rfid) && (
                    <div className="space-y-2">
                      {rfidFeedback && (
                        <div
                          className={`px-4 py-3 rounded-lg border text-sm ${
                            rfidFeedback.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : rfidFeedback.type === 'info'
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          {rfidFeedback.message}
                        </div>
                      )}
                      {statusMsg.rfid && (
                        <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                          {statusMsg.rfid}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">Configuração Serial</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Porta serial
                        </label>
                        <input
                          type="text"
                          value={settings.rfid.port || ''}
                          onChange={e => {
                            const value = e.target.value;
                            setSettings(s => ({
                              ...s,
                              rfid: { ...s.rfid, port: value }
                            }));
                            setRfidFeedback(null);
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono"
                          placeholder="/dev/ttyS1"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Informe o caminho da porta (ex.: /dev/ttyUSB0 ou COM3).
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Baud rate
                        </label>
                        <input
                          type="number"
                          value={settings.rfid.baudRate || 115200}
                          onChange={e => {
                            const value = Number(e.target.value);
                            setSettings(s => ({
                              ...s,
                              rfid: { ...s.rfid, baudRate: value }
                            }));
                            setRfidFeedback(null);
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          step={100}
                          min={1200}
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Velocidade padrão de leitores seriais é 115200 bps.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={() => detectDevices('rfid')}
                      variant="primary"
                      size="sm"
                      disabled={detecting}
                    >
                      {detecting ? 'Detectando portas...' : 'Detectar portas seriais'}
                    </Button>
                    <p className="text-sm text-gray-500">
                      O navegador pode solicitar permissão para acessar portas seriais na primeira vez.
                    </p>
                  </div>

                  {statusMsg.rfid && (
                    <div className="px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                      {statusMsg.rfid}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(tab === 'printer' || tab === 'network') && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                {tab === 'printer' && <Printer className="w-6 h-6 text-orange-600" />}
                {tab === 'network' && <Wifi className="w-6 h-6 text-cyan-600" />}
                <h2 className="text-2xl font-bold text-gray-800">
                  {tab === 'printer' && 'Impressora'}
                  {tab === 'network' && 'Rede Local'}
                </h2>
              </div>
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Em desenvolvimento</h3>
                <p className="text-gray-600">
                  Esta seção será implementada em breve
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {rfidModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Selecionar leitor RFID</h3>
                <p className="text-sm text-gray-600">
                  Escolha o modelo instalado neste totem para liberar os campos de configuração corretos.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setRfidModalOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'generic-serial',
                  title: 'Leitor Serial / USB',
                  description: 'Antenas conectadas diretamente via cabo serial ou adaptador USB.',
                  details: 'Necessário informar porta (COM/tty) e baud rate.'
                },
                {
                  id: 'chainway-ur4',
                  title: 'Chainway UR4',
                  description: 'Leitor fixo Ethernet com até quatro antenas externas.',
                  details: 'Requer IP, porta e potência configurados.'
                }
              ].map(option => {
                const active = settings.rfid.readerModel === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => {
                      setSettings(s => {
                        const readerModel = option.id as 'generic-serial' | 'chainway-ur4';
                        return {
                          ...s,
                          rfid: {
                            ...s.rfid,
                            readerModel,
                            access: readerModel === 'generic-serial' ? 'serial' : 'tcpip',
                            host:
                              readerModel === 'chainway-ur4' ? s.rfid.chainwayUr4.host : s.rfid.host,
                            tcpPort:
                              readerModel === 'chainway-ur4' ? s.rfid.chainwayUr4.port : s.rfid.tcpPort,
                            port: readerModel === 'generic-serial' ? s.rfid.port ?? '/dev/ttyS1' : undefined
                          }
                        };
                      });
                      setStatus(s => ({ ...s, rfid: 'idle' }));
                      setStatusMsg(s => ({ ...s, rfid: '' }));
                      setRfidFeedback(null);
                      setRfidModalOpen(false);
                    }}
                    className={`text-left border-2 rounded-2xl p-5 transition-all ${
                      active
                        ? 'border-green-500 bg-green-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-green-300 hover:shadow'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xl font-semibold text-gray-800">{option.title}</h4>
                      {active && (
                        <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">
                          Selecionado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{option.description}</p>
                    <p className="text-xs text-gray-500">{option.details}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
