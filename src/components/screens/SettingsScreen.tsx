import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { settings, setSettings } = useSettings();
  const { clients, loading: clientsLoading, selectedClient, setSelectedClient } = useClients();
  const [tab, setTab] = React.useState<'totem' | 'balanca' | 'impressoras' | 'rfid' | 'servidor'>('totem');
  const [testMsg, setTestMsg] = React.useState<Record<string, string>>({});

  const testScale = () => {
    const weight = (Math.random() * 5 + 0.5).toFixed(2);
    setTestMsg(prev => ({ ...prev, balanca: `OK • peso simulado ${weight} kg (${settings.scale.mode.toUpperCase()})` }));
  };

  const testPrinter = () => {
    setTestMsg(prev => ({ ...prev, impressoras: `Cupom de teste enviado (simulado) para ${settings.printer.defaultPrinter || 'Padrão do sistema'}` }));
  };

  const testRfid = () => {
    const types = ['MISTO', 'LENÇÓIS', 'TOALHAS', 'COBERTORES'];
    const counts = types.map(() => Math.floor(Math.random() * 5));
    const total = counts.reduce((a, b) => a + b, 0);
    setTestMsg(prev => ({ ...prev, rfid: `Leitura simulada: ${total} peças (${types.map((t, i) => `${t}:${counts[i]}`).join(', ')})` }));
  };

  const testServer = async () => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      await fetch((settings.server.baseUrl || '').replace(/\/$/, '') + '/ping', { signal: controller.signal, method: 'GET' });
      clearTimeout(id);
      setTestMsg(prev => ({ ...prev, servidor: 'Conexão OK (GET /ping)' }));
    } catch {
      setTestMsg(prev => ({ ...prev, servidor: 'Falha ao conectar (GET /ping)' }));
    }
  };

  const handleTotemTypeChange = (type: 'clean' | 'dirty') => {
    const mode = type === 'clean' ? 'distribution' : 'collection';
    setSettings(s => ({ 
      ...s, 
      totem: { 
        ...s.totem, 
        type, 
        mode 
      } 
    }));
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client || null);
    setSettings(s => ({ 
      ...s, 
      totem: { 
        ...s.totem, 
        clientId: clientId || undefined 
      } 
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">Configurações</h1>
        <Button variant="secondary" size="sm" onClick={onBack}>Voltar</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Tabs list */}
        <Card className="md:col-span-1 p-0">
          <nav className="divide-y divide-gray-100">
            {[
              { id: 'totem', label: 'Totem' },
              { id: 'balanca', label: 'Balança' },
              { id: 'impressoras', label: 'Impressoras' },
              { id: 'rfid', label: 'Leitor RFID' },
              { id: 'servidor', label: 'Servidor' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`w-full text-left px-4 py-3 font-semibold ${tab === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </Card>

        {/* Tab content */}
        <div className="md:col-span-4 space-y-6">
          {tab === 'totem' && (
            <Card>
              <h2 className="text-xl font-bold mb-4">Configuração do Totem</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-semibold mb-2 block">Tipo de Área</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="totemType"
                        value="clean"
                        checked={settings.totem.type === 'clean'}
                        onChange={() => handleTotemTypeChange('clean')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-green-700">Área Limpa</div>
                        <div className="text-sm text-gray-600">Distribuição de enxoval</div>
                      </div>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="totemType"
                        value="dirty"
                        checked={settings.totem.type === 'dirty'}
                        onChange={() => handleTotemTypeChange('dirty')}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div>
                        <div className="font-medium text-orange-700">Área Suja</div>
                        <div className="text-sm text-gray-600">Pesagem e coleta</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">Cliente</label>
                  {clientsLoading ? (
                    <div className="text-sm text-gray-500">Carregando clientes...</div>
                  ) : (
                    <select
                      className="w-full px-3 py-2 border rounded"
                      value={settings.totem.clientId || ''}
                      onChange={(e) => handleClientChange(e.target.value)}
                    >
                      <option value="">Selecione um cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.code && `(${client.code})`}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedClient && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <div className="text-sm font-medium text-blue-800">
                        Cliente selecionado: {selectedClient.name}
                      </div>
                      {selectedClient.code && (
                        <div className="text-xs text-blue-600">Código: {selectedClient.code}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Resumo da Configuração</h3>
                <div className="text-sm space-y-1">
                  <div>
                    <span className="font-medium">Tipo:</span> 
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      settings.totem.type === 'clean' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {settings.totem.type === 'clean' ? 'Área Limpa' : 'Área Suja'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Modo:</span> 
                    <span className="ml-2 text-gray-700">
                      {settings.totem.mode === 'distribution' ? 'Distribuição' : 'Coleta'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Cliente:</span> 
                    <span className="ml-2 text-gray-700">
                      {selectedClient ? selectedClient.name : 'Não selecionado'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {tab === 'balanca' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Balança</h2>
                <div className="flex items-center gap-3">
                  {testMsg.balanca && <span className="text-sm text-gray-600">{testMsg.balanca}</span>}
                  <Button variant="secondary" size="sm" onClick={testScale}>Testar</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-semibold">Modo</label>
                  <select
                    className="w-full px-3 py-2 border rounded"
                    value={settings.scale.mode}
                    onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, mode: e.target.value as any } }))}
                  >
                    <option value="rs232">RS232</option>
                    <option value="usb">USB</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">Porta</label>
                  <input className="w-full px-3 py-2 border rounded" value={settings.scale.port || ''}
                    onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, port: e.target.value } }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold">BaudRate</label>
                  <input type="number" className="w-full px-3 py-2 border rounded" value={settings.scale.baudRate || 0}
                    onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, baudRate: Number(e.target.value) } }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Paridade</label>
                  <select className="w-full px-3 py-2 border rounded" value={settings.scale.parity || 'none'}
                    onChange={(e) => setSettings(s => ({ ...s, scale: { ...s.scale, parity: e.target.value as any } }))}>
                    <option value="none">none</option>
                    <option value="even">even</option>
                    <option value="odd">odd</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {tab === 'impressoras' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Impressoras</h2>
                <div className="flex items-center gap-3">
                  {testMsg.impressoras && <span className="text-sm text-gray-600">{testMsg.impressoras}</span>}
                  <Button variant="secondary" size="sm" onClick={testPrinter}>Testar</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold">Padrão</label>
                  <input className="w-full px-3 py-2 border rounded" value={settings.printer.defaultPrinter || ''}
                    onChange={(e) => setSettings(s => ({ ...s, printer: { ...s.printer, defaultPrinter: e.target.value } }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Endereço (IP/Host)</label>
                  <input className="w-full px-3 py-2 border rounded" value={settings.printer.address || ''}
                    onChange={(e) => setSettings(s => ({ ...s, printer: { ...s.printer, address: e.target.value } }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Porta</label>
                  <input type="number" className="w-full px-3 py-2 border rounded" value={settings.printer.port || 9100}
                    onChange={(e) => setSettings(s => ({ ...s, printer: { ...s.printer, port: Number(e.target.value) } }))} />
                </div>
              </div>
            </Card>
          )}

          {tab === 'rfid' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Leitor RFID</h2>
                <div className="flex items-center gap-3">
                  {testMsg.rfid && <span className="text-sm text-gray-600">{testMsg.rfid}</span>}
                  <Button variant="secondary" size="sm" onClick={testRfid}>Testar</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-semibold">Acesso</label>
                  <select className="w-full px-3 py-2 border rounded" value={settings.rfid.access}
                    onChange={(e) => setSettings(s => ({ ...s, rfid: { ...s.rfid, access: e.target.value as any } }))}>
                    <option value="serial">Serial</option>
                    <option value="tcpip">TCP/IP</option>
                    <option value="usb">USB</option>
                  </select>
                </div>
                {settings.rfid.access === 'serial' && (
                  <>
                    <div>
                      <label className="text-sm font-semibold">Porta</label>
                      <input className="w-full px-3 py-2 border rounded" value={settings.rfid.port || ''}
                        onChange={(e) => setSettings(s => ({ ...s, rfid: { ...s.rfid, port: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">BaudRate</label>
                      <input type="number" className="w-full px-3 py-2 border rounded" value={settings.rfid.baudRate || 115200}
                        onChange={(e) => setSettings(s => ({ ...s, rfid: { ...s.rfid, baudRate: Number(e.target.value) } }))} />
                    </div>
                  </>
                )}
                {settings.rfid.access === 'tcpip' && (
                  <>
                    <div>
                      <label className="text-sm font-semibold">IP/Host</label>
                      <input className="w-full px-3 py-2 border rounded" value={settings.rfid.host || ''}
                        onChange={(e) => setSettings(s => ({ ...s, rfid: { ...s.rfid, host: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="text-sm font-semibold">Porta</label>
                      <input type="number" className="w-full px-3 py-2 border rounded" value={settings.rfid.tcpPort || 0}
                        onChange={(e) => setSettings(s => ({ ...s, rfid: { ...s.rfid, tcpPort: Number(e.target.value) } }))} />
                    </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {tab === 'servidor' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Servidor</h2>
                <div className="flex items-center gap-3">
                  {testMsg.servidor && <span className="text-sm text-gray-600">{testMsg.servidor}</span>}
                  <Button variant="secondary" size="sm" onClick={testServer}>Testar</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-semibold">Base URL</label>
                  <input className="w-full px-3 py-2 border rounded" value={settings.server.baseUrl}
                    onChange={(e) => setSettings(s => ({ ...s, server: { ...s.server, baseUrl: e.target.value } }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold">API Key</label>
                  <input className="w-full px-3 py-2 border rounded" value={settings.server.apiKey || ''}
                    onChange={(e) => setSettings(s => ({ ...s, server: { ...s.server, apiKey: e.target.value } }))} />
                </div>
                <div>
                  <label className="text-sm font-semibold">Empresa/Filial</label>
                  <input className="w-full px-3 py-2 border rounded" value={settings.server.companyId || ''}
                    onChange={(e) => setSettings(s => ({ ...s, server: { ...s.server, companyId: e.target.value } }))} />
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};


