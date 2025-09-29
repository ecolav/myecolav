import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scale } from 'lucide-react';
import { Button } from '../ui/Button';
import { WeighingFormView } from '../weighing/WeighingFormView';
import { useScaleReader } from '../../hooks/useScaleReader';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';

interface WeighingScreenProps {
  onBack: () => void;
}

export const WeighingScreen: React.FC<WeighingScreenProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const { clients } = useClients();
  const [step, setStep] = useState<'weighing' | 'confirmation'>('weighing');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [clothingType, setClothingType] = useState<'limpa' | 'suja' | null>(null);
  
  const { 
    weight, 
    isStable, 
    connected, 
    cages
  } = useScaleReader({ 
    mode: 'mock',
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

  // Estados para controle de pesagem
  // const [currentControl, setCurrentControl] = useState<WeighingControl | null>(null);
  // const [controlKind, setControlKind] = useState<'limpa' | 'suja'>('suja');
  // const [grossWeight, setGrossWeight] = useState(0);
  // const [expectedDate, setExpectedDate] = useState('');
  // const [selectedCageId, setSelectedCageId] = useState<string>('');
  const [manualTare, setManualTare] = useState(0);
  const [useManualTare, setUseManualTare] = useState(false);

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

  // Não há seleção de limpa/suja na UI — vem das configurações

  // Sem carregamento de controle via API nesta tela

  // Início de pesagem ocorre diretamente na UI

  // Função para submeter pesagem: registra entrada local e confirma
  const handleSubmitWeighing = () => {
    const tareUsed = useManualTare ? manualTare : cageTare;
    const net = Math.max(0, weight - tareUsed);
    const newEntry = {
      id: `${Date.now()}`,
      category: selectedType,
      pieceCount: Object.values(rfidCounts).reduce((a, b) => a + b, 0),
      timestamp: new Date(),
      tare: tareUsed,
      gross: weight,
      net,
      cageCode: cageBarcode || 'MANUAL',
    };
    setEntries((prev) => [newEntry, ...prev]);
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
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-10">
        <div className="p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="secondary" size="sm" icon={ArrowLeft} className="bg-white/60">
            Voltar
          </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-wide bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent">
                {selectedClient ? selectedClient.name : 'Cliente não selecionado'}
                {clothingType && ` - ${clothingType === 'limpa' ? 'Entrega' : 'Coleta'}`}
            </h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm text-gray-600 font-semibold bg-white/60 rounded-full px-4 py-2 border border-white/20">
              {now.toLocaleDateString('pt-BR')} • {now.toLocaleTimeString('pt-BR')}
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold ${
                connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <Scale size={16} />
                {connected ? 'Balança Conectada' : 'Balança Desconectada'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <WeighingFormView
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
        onCageTareChange={(v) => setCageTare(v)}
        onUseManualTareChange={(v) => setUseManualTare(v)}
        onManualTareChange={(v) => setManualTare(v)}
        onSubmitWeighing={handleSubmitWeighing}
        onSimulateRfid={simulateRfidReading}
        onNewWeighing={() => setStep('weighing')}
        onBack={onBack}
        entries={entries}
        cages={cages}
      />
    </div>
  );
};