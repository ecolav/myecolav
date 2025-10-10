import React, { useState, useEffect } from 'react';
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

  // Auto-detect devices on mount
  useEffect(() => {
    if (tab === 'scale' && settings.scale.mode !== 'mock') {
      detectDevices('scale');
    }
  }, [tab, settings.scale.mode]);

  const detectDevices = async (device: 'scale' | 'printer' | 'rfid') => {
    setDetecting(true);
    setStatus(s => ({ ...s, [device]: 'testing' }));
    setStatusMsg(s => ({ ...s, [device]: 'Detectando dispositivos...' }));

    try {
      if (settings.scale.mode === 'rs232' || settings.rfid.access === 'serial') {
        await requestSerialPortPermission();
        const ports = await listSerialPorts();
        
        if (ports.length > 0) {
          setStatus(s => ({ ...s, [device]: 'success' }));
          setStatusMsg(s => ({ ...s, [device]: `${ports.length} porta(s) encontrada(s): ${ports.join(', ')}` }));
          
          // Auto-select first port
          if (device === 'scale' && !settings.scale.port) {
            setSettings(s => ({ ...s, scale: { ...s.scale, port: ports[0] } }));
          }
          if (device === 'rfid' && !settings.rfid.port) {
            setSettings(s => ({ ...s, rfid: { ...s.rfid, port: ports[0] } }));
          }
        } else {
          setStatus(s => ({ ...s, [device]: 'error' }));
          setStatusMsg(s => ({ ...s, [device]: 'Nenhuma porta serial encontrada' }));
        }
      } else if (settings.scale.mode === 'usb') {
        await requestUsbDevicePermission();
        const devices = await listUsbDevices();
        
        if (devices.length > 0) {
          setStatus(s => ({ ...s, [device]: 'success' }));
          setStatusMsg(s => ({ ...s, [device]: `${devices.length} dispositivo(s) USB encontrado(s)` }));
          
          // Auto-select first device
          if (device === 'scale' && devices[0]) {
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
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold text-blue-900 mb-2">Porta</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          value={settings.scale.port || ''}
                          onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, port: e.target.value } }))}
                          placeholder="COM1"
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
          {(tab === 'printer' || tab === 'rfid' || tab === 'network') && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                {tab === 'printer' && <Printer className="w-6 h-6 text-orange-600" />}
                {tab === 'rfid' && <Radio className="w-6 h-6 text-green-600" />}
                {tab === 'network' && <Wifi className="w-6 h-6 text-cyan-600" />}
                <h2 className="text-2xl font-bold text-gray-800">
                  {tab === 'printer' && 'Impressora'}
                  {tab === 'rfid' && 'Leitor RFID'}
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
    </div>
  );
};
