import React, { useState, useEffect } from 'react';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { WeighingFormView } from '../weighing/WeighingFormView';
import { useScaleReader } from '../../hooks/useScaleReader';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';
import { useToast } from '../../hooks/useToast';

interface WeighingScreenProps {
  onBack: () => void;
}

export const WeighingScreen: React.FC<WeighingScreenProps> = ({ onBack }) => {
  const WeighingFormViewAny: any = WeighingFormView;
  const { settings } = useSettings();
  const { clients } = useClients();
  const { addToast } = useToast();
  const [step, setStep] = useState<'weighing' | 'confirmation'>('weighing');
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>({ id: "cmeti8brb0000ngpxg05nf3pc", name: "FIOCRUZ" });
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
  
  // ✅ Chave única do cache por cliente + tipo de roupa
  const getCacheKey = () => `weighing_entries_${selectedClient?.id}_${clothingType}`;
  
  // Estado de pesagens com cache persistente
  const [entries, setEntries] = useState<Array<{
    id: string;
    category: 'MISTO' | 'LENÇÓIS' | 'TOALHAS' | 'COBERTORES';
    pieceCount: number;
    timestamp: Date;
    tare: number;
    gross: number;
    net: number;
    cageCode: string;
    cageId?: string; // Armazenar cageId específico de cada entrada
  }>>([]);
  const [yesterdayTargetKg, setYesterdayTargetKg] = useState<number>(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // Modal de confirmação

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
  const [isSubmitting, setIsSubmitting] = useState(false); // Flag para evitar envios duplicados

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
    setStep('weighing');
  }, [settings.totem.type]);

  // ✅ CARREGAR CACHE: Recupera pesagens do localStorage ao iniciar
  useEffect(() => {
    if (!selectedClient?.id || !clothingType) return;
    
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const entriesWithDates = parsed.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        }));
        setEntries(entriesWithDates);
        console.log(`✅ Cache carregado: ${entriesWithDates.length} pesagens`);
      }
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    }
  }, [selectedClient?.id, clothingType]);

  // ✅ SALVAR CACHE: Persiste pesagens no localStorage sempre que mudar
  useEffect(() => {
    if (!selectedClient?.id || !clothingType) return;
    if (entries.length === 0) return;
    
    try {
      const cacheKey = getCacheKey();
      localStorage.setItem(cacheKey, JSON.stringify(entries));
      console.log(`💾 Cache salvo: ${entries.length} pesagens`);
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  }, [entries, selectedClient?.id, clothingType]);

  // Criar/garantir controle ao abrir (usa meta de ontem para limpa)
  useEffect(() => {
    // Evita criação duplicada: só cria se não existe controlId
    if (controlId) {
      console.log('✅ ControlId já existe:', controlId);
      return;
    }
    if (!settings.server.baseUrl || !selectedClient?.id || !clothingType) {
      console.warn('⚠️  Faltam dados para criar controle:', {
        baseUrl: settings.server.baseUrl,
        clientId: selectedClient?.id,
        clothingType
      });
      return;
    }
    
    console.log('🔄 Criando controle...');
    const init = async () => {
      try {
        const gross = clothingType === 'limpa' ? yesterdayTargetKg : undefined;
        const ctrl = await startControl(clothingType as any, gross);
        if (ctrl?.id) {
          setControlId(ctrl.id);
          console.log('✅ Controle criado com sucesso!', ctrl.id);
        } else {
          console.error('❌ Falha ao criar controle!');
        }
      } catch (error) {
        console.error('❌ Erro ao criar controle:', error);
        // Se falhar, permite continuar sem controlId
        console.log('⚠️  Continuando sem controlId...');
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.server.baseUrl, selectedClient?.id, clothingType]);
  // ✅ CORREÇÃO: Removido yesterdayTargetKg das dependências para evitar recriação do controle

  // Meta do dia: Roupa LIMPA hoje compara com roupa SUJA de ontem
  // (o que foi coletado ontem volta limpo hoje)
  useEffect(() => {
    const base = settings.server.baseUrl;
    const clientId = selectedClient?.id;
    if (!base || !clientId || clothingType !== 'limpa') return;
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
            // Para roupa LIMPA de hoje, compara com roupa SUJA de ontem
            const target = Number(row?.peso_suja ?? 0);
            setYesterdayTargetKg(Number.isFinite(target) ? target : 0);
          } else {
            setYesterdayTargetKg(0);
          }
        })
        .catch(() => setYesterdayTargetKg(0));
    } catch {
      setYesterdayTargetKg(0);
    }
  }, [settings.server.baseUrl, selectedClient?.id, clothingType]);

  // Não há seleção de limpa/suja na UI — vem das configurações

  // Sem carregamento de controle via API nesta tela

  // Início de pesagem ocorre diretamente na UI

  // Função para submeter pesagem: registra entrada local e confirma
  const handleCapture = async () => {
    console.log('━━━ CAPTURANDO PESAGEM ━━━');
    console.log('📊 Estados antes de capturar:', {
      weight,
      selectedCageId,
      cageTare,
      cageBarcode,
      useManualTare,
      manualTare
    });
    
    // ⚠️ PROBLEMA IDENTIFICADO: selectedCageId era limpo antes!
    // Vou usar cageTare diretamente se for > 0
    let tareUsed = 0;
    const usedCageId = selectedCageId || undefined;
    const hasCageTare = cageTare > 0;
    const hasManualTare = useManualTare && manualTare > 0;
    
    if (hasCageTare) {
      tareUsed += cageTare;
      console.log('✅ Usando tara da gaiola:', cageTare.toFixed(2), 'kg', 'cageId:', usedCageId ?? 'N/A');
    }
    if (hasManualTare) {
      tareUsed += manualTare;
      console.log('✅ Usando tara manual adicional:', manualTare.toFixed(2), 'kg');
    }
    if (!hasCageTare && !hasManualTare) {
      console.log('⚠️  Sem tara aplicada (peso bruto = líquido)');
    }
    
    const net = Math.max(0, weight - tareUsed);
    const rfidSummary = Object.entries(rfidCounts).map(([k,v]) => `${k}:${v}`).join(', ');
    const cageLabel = (() => {
      if (cageBarcode) return cageBarcode;
      if (usedCageId && hasManualTare) return 'GAIOLA + MANUAL';
      if (usedCageId) return 'GAIOLA';
      if (hasManualTare) return 'MANUAL';
      return 'LIVRE';
    })();
    console.log('⚖️  Tara total aplicada:', tareUsed.toFixed(2), 'kg');
    const newEntry = {
      id: `${Date.now()}`,
      category: selectedType,
      pieceCount: Object.values(rfidCounts).reduce((a, b) => a + b, 0),
      timestamp: new Date(),
      tare: tareUsed,
      gross: weight,
      net,
      cageCode: cageLabel,
      cageId: usedCageId, // ⚠️ CORREÇÃO: usar variável local
      rfidSummary
    } as any;
    
    console.log('🎯 ENTRADA CRIADA:', {
      gross: newEntry.gross,
      tare: newEntry.tare,
      net: newEntry.net,
      cageCode: newEntry.cageCode
    });
    
    setEntries((prev) => {
      const updated = [newEntry, ...prev];
      console.log(`💾 Total de pesagens agora: ${updated.length}`);
      console.log(`📊 Total de taras: ${updated.reduce((s, e) => s + e.tare, 0).toFixed(2)} kg`);
      return updated;
    });
    
    // ⚠️ CORREÇÃO: NÃO limpa selectedCageId nem cageTare aqui
    // Permite usar a mesma gaiola várias vezes seguidas
    // Só limpa o código de barras
    setCageBarcode('');
    console.log('━━━ FIM DA CAPTURA ━━━');
    console.log('ℹ️  Gaiola mantida para próxima pesagem (mesma gaiola)');
  };

  // ✅ Abre modal de confirmação antes de finalizar
  const handleRequestFinalize = () => {
    console.log('🔵 FINALIZAR clicado! Abrindo modal...');
    console.log('📊 Pesagens:', entries.length);
    if (entries.length === 0) {
      console.warn('⚠️  Sem pesagens para finalizar!');
      return;
    }
    setShowConfirmModal(true);
    console.log('✅ Modal aberto!');
  };

  // ✅ Confirmação do usuário: envia para API e limpa cache
  const handleConfirmFinalize = async () => {
    console.log('🚀 handleConfirmFinalize chamado!');
    console.log('📊 Estado:', {
      controlId,
      isSubmitting,
      entriesCount: entries.length,
      entries: entries.map(e => ({
        gross: e.gross,
        tare: e.tare,
        net: e.net,
        cageCode: e.cageCode
      }))
    });
    
    if (!controlId) {
      console.log('⚠️  Sem controlId - tentando criar um novo...');
      try {
        if (!selectedClient?.id || !clothingType) {
          addToast({ type: 'error', message: 'Selecione cliente e tipo de roupa primeiro' });
          return;
        }
        
        const gross = clothingType === 'limpa' ? yesterdayTargetKg : undefined;
        const ctrl = await startControl(clothingType as any, gross);
        if (ctrl?.id) {
          setControlId(ctrl.id);
          console.log('✅ Novo controle criado:', ctrl.id);
        } else {
          console.log('⚠️  Continuando sem controlId...');
        }
      } catch (error) {
        console.error('❌ Erro ao criar controle:', error);
        console.log('⚠️  Continuando sem controlId...');
      }
    }
    
    if (isSubmitting) {
      console.warn('⚠️  Já está enviando...');
      return;
    }
    
    setShowConfirmModal(false);
    
    try {
      setIsSubmitting(true);
      console.log('🔒 isSubmitting = true');
      
      // ✅ Verificar se tem controlId antes de tentar enviar
      if (!controlId) {
        console.error('❌ Sem controlId - não é possível enviar!');
        addToast({ type: 'error', message: 'Erro: Controle não encontrado. Tente novamente.' });
        setIsSubmitting(false);
        return;
      }
      
      // 🔍 DEBUG: Mostrar início do envio
      addToast({ type: 'info', message: `🚀 Iniciando envio de ${entries.length} pesagens...` });
      
      // ✅ CORREÇÃO: Usar ID único para evitar deduplicação incorreta
      const uniqueEntries = entries.filter((entry, index, arr) => {
        // Usar ID + timestamp para garantir unicidade real
        const key = `${entry.id}|${entry.timestamp.getTime()}`;
        return index === arr.findIndex(e => `${e.id}|${e.timestamp.getTime()}` === key);
      });
      console.log(`📊 Entradas para envio: ${uniqueEntries.length} de ${entries.length} total`);

      let allSuccess = true;
      let successCount = 0;
      
      console.log(`🚀 ENVIANDO TODAS AS ${uniqueEntries.length} PESAGENS SIMULTANEAMENTE`);
      
      // ✅ Preparar todos os payloads
      const payloads = uniqueEntries.map((e, i) => {
        console.log(`\n📤 === PESAGEM ${i + 1}/${uniqueEntries.length} ===`);
        console.log(`ID: ${e.id}`);
        console.log(`Timestamp: ${e.timestamp}`);
        console.log(`Gross: ${e.gross}kg, Tare: ${e.tare}kg, Net: ${e.net}kg`);
        
        const payload: { cageId?: string; tareWeight: number; totalWeight: number } = {
          totalWeight: e.gross,
          tareWeight: e.tare
        };
        
        if (e.cageId) {
          payload.cageId = e.cageId;
        }
        
        console.log('📤 Payload para API:', JSON.stringify(payload, null, 2));
        return { entry: e, payload, index: i };
      });
      
      // 🔍 DEBUG: Mostrar progresso na tela
      addToast({ type: 'info', message: `🚀 Enviando ${uniqueEntries.length} pesagens sequencialmente...` });
      
      // ✅ Enviar uma por vez para evitar deadlock no servidor
      const results = [];
      for (let i = 0; i < payloads.length; i++) {
        const { entry, payload, index } = payloads[i];
        try {
          console.log(`📤 Enviando pesagem ${index + 1}/${payloads.length}...`);
          const ok = await submitWeighing(controlId, payload);
          console.log(`${ok ? '✅' : '❌'} Pesagem ${index + 1}: ${ok ? 'Sucesso' : 'Falha'}`);
          results.push({ success: ok, entry, index });
          
          // ⏱️ Pequena pausa entre envios para evitar conflitos
          if (i < payloads.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`❌ Erro na pesagem ${index + 1}:`, error);
          results.push({ success: false, entry, index });
        }
      }
      
      // ✅ Contar sucessos
      successCount = results.filter(r => r.success).length;
      allSuccess = successCount === uniqueEntries.length;
      
      console.log(`\n🏁 ENVIO SEQUENCIAL FINALIZADO! Sucessos: ${successCount}/${uniqueEntries.length}`);
      
      // 🔍 DEBUG: Mostrar resultado na tela
      results.forEach(({ success, index }) => {
        addToast({ 
          type: success ? 'success' : 'error', 
          message: success ? `✅ Pesagem ${index + 1} enviada!` : `❌ Falha na pesagem ${index + 1}!` 
        });
      });
      
      console.log('📊 Resultado final:', { allSuccess, successCount, total: uniqueEntries.length });
      
      // 🔍 DEBUG: Mostrar resultado final na tela
      if (allSuccess) {
        addToast({ type: 'success', message: `✅ Todas as ${uniqueEntries.length} pesagens enviadas!` });
      } else {
        addToast({ type: 'error', message: `❌ Apenas ${successCount} de ${uniqueEntries.length} pesagens enviadas!` });
      }
      
      // ✅ CORREÇÃO: Limpar apenas as pesagens que foram enviadas com sucesso
      if (successCount > 0) {
        console.log(`🗑️  Removendo ${successCount} pesagens enviadas com sucesso do cache`);
        
        // Remove apenas as pesagens que foram enviadas com sucesso
        setEntries((prev) => {
          const remaining = prev.filter((entry, index) => index >= successCount);
          console.log(`📊 Restam ${remaining.length} pesagens no cache`);
          return remaining;
        });
        
        // Se todas foram enviadas, limpa tudo
        if (successCount === uniqueEntries.length) {
          const cacheKey = getCacheKey();
          localStorage.removeItem(cacheKey);
          console.log('🗑️  Cache limpo - todas as pesagens enviadas');
          
          setControlId(null);
          setCageBarcode('');
          setCageTare(0);
          setSelectedCageId(undefined);
          setStep('confirmation');
          console.log('✅ Finalizado! Indo para tela de confirmação');
        }
      } else {
        console.error('❌ Nenhuma pesagem foi enviada com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao finalizar pesagem:', error);
    } finally {
      setIsSubmitting(false);
      console.log('🔓 isSubmitting = false');
    }
  };

  // ✅ Deleta entrada e atualiza cache automaticamente
  const handleDeleteEntry = (entryId: string) => {
    setEntries((prev) => {
      const updated = prev.filter((e) => e.id !== entryId);
      
      if (updated.length === 0) {
        const cacheKey = getCacheKey();
        localStorage.removeItem(cacheKey);
        console.log('🗑️  Cache limpo (todas as pesagens foram deletadas)');
      }
      
      return updated;
    });
  };

  // ✅ Volta para nova pesagem e reseta TODOS os estados
  const handleNewWeighing = () => {
    console.log('🔄 Nova pesagem - resetando estados...');
    setStep('weighing');
    setControlId(null);
    setCageBarcode('');
    setCageTare(0);
    setSelectedCageId(undefined);
    setUseManualTare(false);
    setManualTare(0);
    console.log('✅ Estados resetados');
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
        onCageBarcodeChange={(v: string) => {
          console.log('📝 Código da gaiola alterado:', v);
          setCageBarcode(v);
        }}
        onCageTareChange={(v: number) => {
          console.log('⚖️  Tara da gaiola setada:', v);
          setCageTare(v);
        }}
        onUseManualTareChange={(v: boolean) => setUseManualTare(v)}
        onManualTareChange={(v: number) => setManualTare(v)}
        onCaptureWeighing={handleCapture}
        onFinalize={handleRequestFinalize}
        onSimulateRfid={simulateRfidReading}
        onNewWeighing={handleNewWeighing}
        onBack={onBack}
        entries={entries}
        cages={cages}
        clothingType={clothingType}
        targetKg={yesterdayTargetKg}
        progressPercent={(yesterdayTargetKg > 0 ? (entries.reduce((s, e) => s + e.net, 0) / yesterdayTargetKg) * 100 : 0)}
        onCageSelected={(id: string) => {
          console.log('🎯 Gaiola selecionada! ID:', id);
          setSelectedCageId(id);
        }}
        onDeleteEntry={handleDeleteEntry}
        isSubmitting={isSubmitting}
      />

      {/* ✅ MODAL DE CONFIRMAÇÃO */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border-4 border-blue-200">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
              ⚖️ Confirmar Pesagem
            </h2>
            
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-xl p-4 border-2 border-blue-200 text-center">
                  <div className="text-xs text-blue-700 font-semibold mb-1">PESAGENS</div>
                  <div className="text-2xl font-bold text-blue-900">{entries.length}</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-200 text-center">
                  <div className="text-xs text-orange-700 font-semibold mb-1">COM GAIOLAS</div>
                  <div className="text-2xl font-bold text-orange-900">
                    {entries.reduce((s, e) => s + e.gross, 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-orange-600">kg (bruto)</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-300 text-center">
                  <div className="text-xs text-gray-700 font-semibold mb-1">TARAS</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {entries.reduce((s, e) => s + e.tare, 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-600">kg</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200 text-center">
                  <div className="text-xs text-green-700 font-semibold mb-1">SEM GAIOLAS</div>
                  <div className="text-2xl font-bold text-green-900">
                    {entries.reduce((s, e) => s + e.net, 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-green-600">kg (líquido)</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200 max-h-64 overflow-y-auto">
                <div className="text-sm font-bold text-gray-700 mb-3">Detalhes das Pesagens:</div>
                <div className="space-y-2">
                  {entries.map((e, idx) => (
                    <div key={e.id} className="flex justify-between items-center bg-white rounded-lg p-3 border border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-600">#{idx + 1}</span>
                        <span className="font-semibold text-gray-800">{e.cageCode}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">Tara: {e.tare.toFixed(2)} kg</span>
                        <span className="text-lg font-bold text-blue-700">{e.net.toFixed(2)} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 px-6 py-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xl font-bold transition-colors"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={() => {
                  console.log('🖱️  BOTÃO CONFIRMAR CLICADO!');
                  handleConfirmFinalize();
                }}
                disabled={isSubmitting}
                className="flex-1 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl text-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isSubmitting ? '⏳ ENVIANDO...' : '✅ CONFIRMAR E ENVIAR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};