import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { WeighingFormView } from '../weighing/WeighingFormView';
import { useScaleReader } from '../../hooks/useScaleReader';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface WeighingScreenProps {
  onBack: () => void;
}

export const WeighingScreen: React.FC<WeighingScreenProps> = ({ onBack }) => {
  const WeighingFormViewAny: any = WeighingFormView;
  const { settings } = useSettings();
  const { clients } = useClients();
  const [step, setStep] = useState<'weighing' | 'confirmation'>('weighing');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [clothingType, setClothingType] = useState<'limpa' | 'suja' | null>(null);
  
  const { 
    weight, 
    isStable, 
    connected, 
    cages,
    startControl,
    submitWeighing
  } = useScaleReader({ 
    mode: settings.scale.mode as any,
    port: settings.scale.port,
    baudRate: settings.scale.baudRate,
    parity: settings.scale.parity as any,
    vendorId: settings.scale.vendorId,
    productId: settings.scale.productId,
    modelLabel: settings.scale.model,
    apiBaseUrl: settings.server.baseUrl,
    clientId: selectedClient?.id
  });

  // Leitura RFID por contagem agregada por tipo
  const [isRfidReading, setIsRfidReading] = useState<boolean>(false);
  const [rfidCounts, setRfidCounts] = useState<Record<string, number>>({});
  const rfidTotal = Object.values(rfidCounts).reduce((a, b) => a + b, 0);
  const [cageTare, setCageTare] = useState(0);
  const [cageBarcode, setCageBarcode] = useState('');
  
  // Relógio e status
  const [now, setNow] = useState<Date>(new Date());
  // const [antennaOnline] = useState<boolean>(true);
  
  // Tipo de roupa (categoria) usado nas entradas
  const [selectedType] = useState<'MISTO' | 'LENÇÓIS' | 'TOALHAS' | 'COBERTORES'>('MISTO');
  const [entries, setEntries] = useState<Array<{
    id: string;
    category: 'MISTO' | 'LENÇÓIS' | 'TOALHAS' | 'COBERTORES';
    pieceCount: number;
    timestamp: Date;
    tare: number;
    gross: number;
    net: number;
    cageCode: string;
  }>>([]);
  const [yesterdayTargetKg, setYesterdayTargetKg] = useState<number>(0);

  // Estados para controle de pesagem
  // const [currentControl, setCurrentControl] = useState<WeighingControl | null>(null);
  // const [controlKind, setControlKind] = useState<'limpa' | 'suja'>('suja');
  // const [grossWeight, setGrossWeight] = useState(0);
  // const [expectedDate, setExpectedDate] = useState('');
  // const [selectedCageId, setSelectedCageId] = useState<string>('');
  const [manualTare, setManualTare] = useState(0);
  const [useManualTare, setUseManualTare] = useState(false);
  const [controlId, setControlId] = useState<string | null>(null);
  const [selectedCageId, setSelectedCageId] = useState<string | undefined>(undefined);

  // Atualizar relógio
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Carregar cliente das configurações
  useEffect(() => {
    if (settings.totem.clientId && clients.length > 0) {
      const client = clients.find(c => c.id === settings.totem.clientId);
      if (client) {
        setSelectedClient({ id: client.id, name: client.name });
      }
    }
  }, [settings.totem.clientId, clients]);

  // Ajustar tipo limpa/suja conforme configuração e ir direto para pesagem
  useEffect(() => {
    const configuredType = settings.totem.type === 'clean' ? 'limpa' : 'suja';
    setClothingType(configuredType);
    // setControlKind(configuredType);
    setStep('weighing');
  }, [settings.totem.type]);

  // Criar/garantir controle ao abrir (usa meta de ontem para limpa)
  useEffect(() => {
    const init = async () => {
      if (!settings.server.baseUrl || !selectedClient?.id || !clothingType) return;
      if (controlId) return;
      const gross = clothingType === 'limpa' ? yesterdayTargetKg : undefined;
      const ctrl = await startControl(clothingType as any, gross);
      if (ctrl?.id) setControlId(ctrl.id);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.server.baseUrl, selectedClient?.id, clothingType, yesterdayTargetKg]);

  // Meta do dia baseada na entrega (limpa) do dia anterior (endpoint público)
  useEffect(() => {
    const base = settings.server.baseUrl;
    const clientId = selectedClient?.id;
    if (!base || !clientId) return;
    try {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.toISOString().slice(0,10);
      const url = `${base}/api/public/totem/pesagens/relatorio?start=${y}&end=${y}&clientId=${encodeURIComponent(clientId)}`;
      fetch(url, { headers: { 'x-api-key': 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea' } })
        .then(r => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const row = data.find((x: any) => x.date === y) || data[0];
            const target = Number(row?.peso_limpa ?? 0);
            setYesterdayTargetKg(Number.isFinite(target) ? target : 0);
          } else {
            setYesterdayTargetKg(0);
          }
        })
        .catch(() => setYesterdayTargetKg(0));
    } catch {
      setYesterdayTargetKg(0);
    }
  }, [settings.server.baseUrl, selectedClient?.id]);

  // Não há seleção de limpa/suja na UI — vem das configurações

  // Sem carregamento de controle via API nesta tela

  // Início de pesagem ocorre diretamente na UI

  // Função para submeter pesagem: registra entrada local e confirma
  const handleCapture = async () => {
    const tareUsed = useManualTare ? manualTare : (selectedCageId ? 0 : cageTare);
    const net = Math.max(0, weight - tareUsed);
    const rfidSummary = Object.entries(rfidCounts).map(([k,v]) => `${k}:${v}`).join(', ');
    const newEntry = {
      id: `${Date.now()}`,
      category: selectedType,
      pieceCount: Object.values(rfidCounts).reduce((a, b) => a + b, 0),
      timestamp: new Date(),
      tare: tareUsed,
      gross: weight,
      net,
      cageCode: cageBarcode || (selectedCageId ? 'GAIOLA' : 'MANUAL'),
      rfidSummary
    } as any;
    setEntries((prev) => [newEntry, ...prev]);
  };

  const handleFinalize = async () => {
    if (!controlId) return;
    for (const e of entries) {
      const cageId = selectedCageId; // por entrada futura: armazenar cageId no item
      const ok = await submitWeighing(controlId, { cageId, tareWeight: e.tare, totalWeight: e.gross });
      if (!ok) break;
    }
    setEntries([]);
    setStep('confirmation');
  };

  // Função para simular leitura RFID
  const simulateRfidReading = () => {
    setIsRfidReading(true);
    setTimeout(() => {
      const newCounts = {
        'MISTO': Math.floor(Math.random() * 10) + 1,
        'LENÇÓIS': Math.floor(Math.random() * 5) + 1,
        'TOALHAS': Math.floor(Math.random() * 8) + 1,
        'COBERTORES': Math.floor(Math.random() * 3) + 1
      };
      setRfidCounts(newCounts);
    setIsRfidReading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-sm border-b-4 border-white/20 sticky top-0 z-10 shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button onClick={onBack} variant="secondary" size="md" icon={ArrowLeft}>
                Voltar
              </Button>
              <div>
                <h1 className="text-4xl font-bold tracking-wide bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                  {selectedClient ? selectedClient.name : 'Cliente não selecionado'}
                </h1>
                <p className="text-xl font-semibold text-gray-600 mt-1">
                  {clothingType && `${clothingType === 'limpa' ? '🟢 Entrega (Limpa)' : '🟠 Coleta (Suja)'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-xl text-gray-700 font-bold bg-white rounded-2xl px-6 py-3 border-4 border-gray-200 shadow-md">
                {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-xl font-bold border-4 ${
                connected 
                  ? 'bg-green-100 text-green-900 border-green-300' 
                  : 'bg-red-100 text-red-900 border-red-300'
              }`}>
                {connected ? <Wifi size={28} /> : <WifiOff size={28} />}
                {connected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <WeighingFormViewAny
        step={step}
        weight={weight}
        isStable={isStable}
        connected={connected}
        selectedType={selectedType}
        rfidCounts={rfidCounts}
        rfidTotal={rfidTotal}
        isRfidReading={isRfidReading}
        cageBarcode={cageBarcode}
        cageTare={cageTare}
        manualTare={manualTare}
        useManualTare={useManualTare}
        onCageBarcodeChange={setCageBarcode}
        onCageTareChange={(v: number) => setCageTare(v)}
        onUseManualTareChange={(v: boolean) => setUseManualTare(v)}
        onManualTareChange={(v: number) => setManualTare(v)}
        onCaptureWeighing={handleCapture}
        onFinalize={handleFinalize}
        onSimulateRfid={simulateRfidReading}
        onNewWeighing={() => setStep('weighing')}
        onBack={onBack}
        entries={entries}
        cages={cages}
        targetKg={yesterdayTargetKg}
        progressPercent={(yesterdayTargetKg > 0 ? (entries.reduce((s, e) => s + e.net, 0) / yesterdayTargetKg) * 100 : 0)}
        onCageSelected={(id: string) => setSelectedCageId(id)}
      />
    </div>
  );
};