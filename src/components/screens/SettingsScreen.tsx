import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useSettings } from '../../hooks/useSettings';

interface SettingsScreenProps {
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { settings, setSettings } = useSettings();
  const [tab, setTab] = React.useState<'balanca' | 'impressoras' | 'rfid' | 'servidor'>('balanca');
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


