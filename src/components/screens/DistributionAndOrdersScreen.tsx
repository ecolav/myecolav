import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, Package, ShoppingCart, Loader2, CheckCircle2, Radio, Bed, AlertCircle, MapPin } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSettings } from '../../hooks/useSettings';
import { useSectors } from '../../hooks/useSectors';
import { useRequests } from '../../hooks/useRequests';
import { useRFIDReader } from '../../hooks/useRFIDReader';
import { useRfidItem } from '../../hooks/useRfidItem';
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

type DistributionMode = 'manual' | 'rfid';
type DistributionView = 'modeSelection' | 'sectorSelection';

export function DistributionAndOrdersScreen({ onBack, selectedClient }: Props) {
  const { settings } = useSettings();
  const clientId = selectedClient?.id || settings.totem.clientId;
  
  // Hook para leitura real do UR4
  const {
    status: rfidStatus,
    startContinuousReading: startRealRFIDReading,
    stopContinuousReading: stopRealRFIDReading,
    connectToReader: connectRFIDReader,
    readings: rfidReadings
  } = useRFIDReader();

  // Controle principal: alternar entre distribuição e pedidos
  const [mainView, setMainView] = useState<'distribution' | 'orders'>('distribution');

  // Fluxo de distribuição
  const [distributionView, setDistributionView] = useState<DistributionView>('modeSelection');
  const [selectedMode, setSelectedMode] = useState<DistributionMode | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState('');
  const [showManualModal, setShowManualModal] = useState(false);
  const [showRfidModal, setShowRfidModal] = useState(false);

  // Estados do modal manual
  const [manualScope, setManualScope] = useState<'bed' | 'sector'>('bed');
  const [manualSelectedBedId, setManualSelectedBedId] = useState('');
  const [manualQuantities, setManualQuantities] = useState<Record<string, number>>({});
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [manualBedPage, setManualBedPage] = useState(0);

  // Estados do modal RFID (entrada manual de tags)
  const [rfidScope, setRfidScope] = useState<'bed' | 'sector'>('bed');
  const [rfidSelectedBedId, setRfidSelectedBedId] = useState('');
  const [rfidEntries, setRfidEntries] = useState<
    Array<{ 
      tag: string; 
      tid?: string; 
      linenItemId?: string; 
      name: string; 
      sku?: string; 
      notFound?: boolean;
      fullNumber?: string;
      batchNumber?: number;
      pieceNumber?: number;
      status?: string;
      clientName?: string;
    }>
  >([]);
  const [rfidFeedback, setRfidFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rfidSubmitting, setRfidSubmitting] = useState(false);
  const [rfidDraft, setRfidDraft] = useState('');
  const [rfidLookupLoading, setRfidLookupLoading] = useState(false);
  const [rfidReadingActive, setRfidReadingActive] = useState(false);
  const [rfidBedPage, setRfidBedPage] = useState(0);
  const [rfidEntriesPage, setRfidEntriesPage] = useState(0);
  const hiddenRfidInputRef = useRef<HTMLInputElement>(null);
  const processedTagsRef = useRef<Set<string>>(new Set());
  const lastProcessedReadingIdRef = useRef<number>(0);
  
  // Hook para consultar tags RFID no servidor
  const { lookupTag: lookupRfidItem } = useRfidItem();

  const BED_PAGE_SIZE = 4;
  const RFID_ENTRIES_PAGE_SIZE = 8;

  // Dados
  const { sectors, loading: loadingSectors } = useSectors({ clientId, autoLoad: true });
  const [beds, setBeds] = useState<Bed[]>([]);
  const [items, setItems] = useState<LinenItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Estados do módulo de pedidos
  const [orderSelectedSectorId, setOrderSelectedSectorId] = useState('');
  const [orderSelectedBedId, setOrderSelectedBedId] = useState('');
  const [orderSelectedItemId, setOrderSelectedItemId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderItems, setOrderItems] = useState<Array<{ itemId: string; quantity: number }>>([]);
  const [observations, setObservations] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState('');

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

  // Comentário: filtramos leitos para o formulário de pedidos (mantendo comportamento anterior).
  const orderFilteredBeds = useMemo(() => {
    if (!orderSelectedSectorId) return beds;
    return beds.filter(b => b.sectorId === orderSelectedSectorId);
  }, [beds, orderSelectedSectorId]);

  // Comentário: utilitário para obter nome do setor rapidamente.
  const getSectorName = (sectorId: string) =>
    sectors.find(s => s.id === sectorId)?.name || 'Setor';

  // Comentário: utilitário para obter nome do leito.
  const getBedName = (bedId: string) =>
    beds.find(b => b.id === bedId)?.number || 'Leito';

  // ============
  // Fluxo Distribution
  // ============

  const resetDistributionFlow = () => {
    setSelectedMode(null);
    setSelectedSectorId('');
    setDistributionView('modeSelection');
    setShowManualModal(false);
    setShowRfidModal(false);
    setManualBedPage(0);
    setRfidBedPage(0);
  };

  const handleModeSelect = (mode: DistributionMode) => {
    // Comentário: primeiro passo - o usuário escolhe manual ou RFID.
    setSelectedMode(mode);
    setDistributionView('sectorSelection');
  };

  const prepareManualModal = (sectorId: string) => {
    setManualScope('bed');
    setManualSelectedBedId('');
    setManualQuantities({});
    setManualFeedback(null);
     setManualBedPage(0);
    setShowManualModal(true);
  };

  const focusHiddenRfidInput = () => {
    requestAnimationFrame(() => {
      hiddenRfidInputRef.current?.focus();
    });
  };

  const prepareRfidModal = (sectorId: string) => {
    setRfidScope('bed');
    setRfidSelectedBedId('');
    setRfidEntries([]);
    setRfidFeedback(null);
    setRfidDraft('');
    setRfidLookupLoading(false);
    setRfidReadingActive(false);
    setRfidBedPage(0);
    setShowRfidModal(true);
  };

  const startRfidReading = async () => {
    setRfidReadingActive(true);
    setRfidFeedback(null);
    setRfidDraft('');
    
    // Conectar e iniciar leitura real do UR4
    try {
      if (!rfidStatus.isConnected) {
        await connectRFIDReader();
      }
      startRealRFIDReading();
      // Também manter input escondido para compatibilidade com emulação de teclado
      focusHiddenRfidInput();
    } catch (error) {
      console.error('Erro ao iniciar leitura RFID:', error);
      setRfidFeedback({ 
        type: 'error', 
        message: 'Erro ao conectar ao leitor RFID. Verifique se o servidor está rodando.' 
      });
      setRfidReadingActive(false);
    }
  };

  const stopRfidReading = () => {
    setRfidReadingActive(false);
    stopRealRFIDReading();
    hiddenRfidInputRef.current?.blur();
  };

  useEffect(() => {
    if (!showRfidModal) {
      stopRfidReading();
      setRfidDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRfidModal]);

  // Processar tags recebidas via Socket.IO do UR4 - PROCESSAR TODAS AS NOVAS LEITURAS
  useEffect(() => {
    if (!rfidReadingActive || !rfidReadings.length) return;
    
    // Processar TODAS as leituras novas (não apenas a última)
    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedReadingIdRef.current);
    
    if (newReadings.length === 0) return;
    
    console.log(`📡 [RFID] Processando ${newReadings.length} nova(s) leitura(s) de ${rfidReadings.length} total`);
    
    // Processar todas as tags de uma vez para evitar problemas de batch do React
    const tagsToAdd: Array<{ tag: string; tid?: string; epc?: string; readingId: number }> = [];
    
    newReadings.forEach(reading => {
      // Normalizar TID e EPC
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      
      // Priorizar TID por ser único por peça; usar EPC apenas como fallback
      const tag = tid || epc;
      
      if (tag && !processedTagsRef.current.has(tag)) {
        console.log('📡 [RFID] Nova tag detectada:', {
          id: reading.id,
          tag,
          tid: reading.tid,
          epc: reading.epc,
          normalizedTid: tid,
          normalizedEpc: epc,
          antenna: reading.antenna,
          using: tid ? 'TID' : 'EPC'
        });
        processedTagsRef.current.add(tag);
        
        tagsToAdd.push({
          tag,
          tid: tid || undefined,
          epc: epc || undefined,
          readingId: reading.id
        });
        
        // Limpar tag processada após 5 segundos para permitir reprocessamento se necessário
        setTimeout(() => {
          processedTagsRef.current.delete(tag);
        }, 5000);
      }
    });
    
    // Adicionar todas as tags de uma vez
    if (tagsToAdd.length > 0) {
      console.log(`✅ [RFID] Adicionando ${tagsToAdd.length} tag(s) ao estado`);
      
      setRfidEntries(prev => {
        const existingTags = new Set(prev.map(e => e.tag));
        const newEntries = tagsToAdd
          .filter(t => !existingTags.has(t.tag))
          .map(t => ({
            tag: t.tag,
            tid: t.tid,
            name: 'Buscando informações...',
            notFound: false  // Inicialmente false, será atualizado depois
          }));
        
        if (newEntries.length > 0) {
          console.log(`✅ [RFID] ${newEntries.length} tag(s) nova(s) adicionada(s) ao estado`);
          return [...prev, ...newEntries];
        }
        return prev;
      });
      
      // Buscar na API em background para cada tag (sem bloquear)
      tagsToAdd.forEach(({ tag, tid, epc }) => {
        lookupRfidTag(tag, { tid, epc });
      });
    }
    
    // Atualizar último ID processado
    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedReadingIdRef.current = maxId;
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfidReadings, rfidReadingActive]);

  // Limpar tags processadas ao fechar modal ou parar leitura
  useEffect(() => {
    if (!rfidReadingActive) {
      processedTagsRef.current.clear();
      lastProcessedReadingIdRef.current = 0;
    }
  }, [rfidReadingActive]);

  const handleSectorSelection = (sectorId: string) => {
    if (!selectedMode) return;
    setSelectedSectorId(sectorId);
    if (selectedMode === 'manual') {
      prepareManualModal(sectorId);
    } else {
      prepareRfidModal(sectorId);
    }
  };

  const closeModals = () => {
    setShowManualModal(false);
    setShowRfidModal(false);
    setManualFeedback(null);
    setRfidFeedback(null);
    setRfidDraft('');
    stopRfidReading();
    setSelectedSectorId('');
  };

  const manualItemsArray = useMemo(
    () => Object.entries(manualQuantities).filter(([, qty]) => qty > 0),
    [manualQuantities]
  );

  const manualTotalPieces = useMemo(
    () => manualItemsArray.reduce((sum, [, qty]) => sum + qty, 0),
    [manualItemsArray]
  );

  const manualSectorBed = useMemo(
    () => beds.find(b => b.sectorId === selectedSectorId && b.number === 'Sem leito (Setor)'),
    [beds, selectedSectorId]
  );

  const manualBedsForSector = useMemo(
    () => beds.filter(b => b.sectorId === selectedSectorId),
    [beds, selectedSectorId]
  );

  const manualTotalPages = Math.max(
    1,
    Math.ceil(manualBedsForSector.length / BED_PAGE_SIZE)
  );

  useEffect(() => {
    setManualBedPage(0);
  }, [selectedSectorId, manualScope]);

  useEffect(() => {
    if (manualBedPage > manualTotalPages - 1) {
      setManualBedPage(Math.max(manualTotalPages - 1, 0));
    }
  }, [manualTotalPages, manualBedPage]);

  const manualBedsPageItems = useMemo(() => {
    const start = manualBedPage * BED_PAGE_SIZE;
    return manualBedsForSector.slice(start, start + BED_PAGE_SIZE);
  }, [manualBedsForSector, manualBedPage]);

  const rfidBedsForSector = useMemo(
    () => beds.filter(b => b.sectorId === selectedSectorId),
    [beds, selectedSectorId]
  );

  const rfidTotalPages = Math.max(
    1,
    Math.ceil(rfidBedsForSector.length / BED_PAGE_SIZE)
  );

  useEffect(() => {
    setRfidBedPage(0);
  }, [selectedSectorId, rfidScope]);

  useEffect(() => {
    if (rfidBedPage > rfidTotalPages - 1) {
      setRfidBedPage(Math.max(rfidTotalPages - 1, 0));
    }
  }, [rfidTotalPages, rfidBedPage]);

  const rfidBedsPageItems = useMemo(() => {
    const start = rfidBedPage * BED_PAGE_SIZE;
    return rfidBedsForSector.slice(start, start + BED_PAGE_SIZE);
  }, [rfidBedsForSector, rfidBedPage]);

  const rfidEntriesTotalPages = Math.max(
    1,
    Math.ceil(rfidEntries.length / RFID_ENTRIES_PAGE_SIZE)
  );

  const rfidEntriesPageItems = useMemo(() => {
    if (rfidEntries.length === 0) return [];
    const start = rfidEntriesPage * RFID_ENTRIES_PAGE_SIZE;
    return rfidEntries.slice(start, start + RFID_ENTRIES_PAGE_SIZE);
  }, [rfidEntries, rfidEntriesPage]);

  useEffect(() => {
    if (rfidEntriesPage > rfidEntriesTotalPages - 1) {
      setRfidEntriesPage(Math.max(rfidEntriesTotalPages - 1, 0));
    }
  }, [rfidEntriesTotalPages, rfidEntriesPage]);

  const handleManualQuantityChange = (itemId: string, delta: number) => {
    // Comentário: ajusta quantidade respeitando estoque atual do item.
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    setManualQuantities(prev => {
      const next = { ...prev };
      const current = next[itemId] || 0;
      const newValue = Math.max(0, Math.min(item.currentStock, current + delta));
      if (newValue === 0) {
        delete next[itemId];
      } else {
        next[itemId] = newValue;
      }
      return next;
    });
  };

  const handleManualDistribution = async () => {
    if (!selectedSectorId || manualItemsArray.length === 0) {
      setManualFeedback({ type: 'error', message: 'Selecione ao menos uma peça.' });
      return;
    }

    const targetBedId =
      manualScope === 'sector'
        ? manualSectorBed?.id
        : manualSelectedBedId || beds.find(b => b.sectorId === selectedSectorId)?.id;

    if (!targetBedId) {
      setManualFeedback({
        type: 'error',
        message:
          manualScope === 'sector'
            ? 'O setor selecionado não possui o leito virtual "Sem leito (Setor)".'
            : 'Escolha um leito para continuar.'
      });
      return;
    }

    setManualSubmitting(true);
    setManualFeedback(null);
    try {
      const sectorName = getSectorName(selectedSectorId);
      const bedName =
        manualScope === 'sector' ? 'Sem leito (Setor)' : getBedName(targetBedId);
      const reason =
        manualScope === 'sector'
          ? `Distribuição manual por setor - ${sectorName}`
          : `Distribuição manual para ${sectorName} - Leito ${bedName}`;

      for (const [itemId, quantity] of manualItemsArray) {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.DISTRIBUTE}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': API_CONFIG.API_KEY
            },
            body: JSON.stringify({
              linenItemId: itemId,
              bedId: targetBedId,
              quantity,
              reason
            })
          }
        );

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Erro ao registrar distribuição.');
        }

        const json = await response.json();
        setItems(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, currentStock: json.newStock ?? item.currentStock } : item
          )
        );
      }

      setManualFeedback({
        type: 'success',
        message: `Distribuição concluída – ${manualTotalPieces} peça(s) enviada(s) para ${bedName}.`
      });
      setManualQuantities({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao distribuir itens.';
      setManualFeedback({ type: 'error', message });
    } finally {
      setManualSubmitting(false);
    }
  };

  // Contar tags não cadastradas
  const rfidNotFoundCount = useMemo(() => {
    return rfidEntries.filter(entry => entry.notFound && !entry.fullNumber && !entry.name).length;
  }, [rfidEntries]);
  
  // Contar tags cadastradas (tem informações válidas)
  const rfidFoundCount = useMemo(() => {
    const count = rfidEntries.filter(entry => 
      (entry.fullNumber || (entry.name && entry.name !== 'Buscando informações...'))
    ).length;
    console.log('🔢 [RFID] rfidFoundCount:', count, 'Total entries:', rfidEntries.length);
    rfidEntries.forEach(entry => {
      console.log('  Tag:', entry.tag, '| name:', entry.name, '| fullNumber:', entry.fullNumber, '| notFound:', entry.notFound);
    });
    return count;
  }, [rfidEntries]);
  
  const rfidSummary = useMemo(() => {
    const map = new Map<
      string,
      { linenItemId: string | null; quantity: number; name: string; sku?: string; fullNumber?: string }
    >();
    // Filtrar apenas tags cadastradas (que têm fullNumber ou name)
    rfidEntries
      .filter(entry => entry.fullNumber || (entry.name && entry.name !== 'Buscando informações...'))
      .forEach(entry => {
        console.log('🔍 [RFID] Processing entry for summary:', {
          tag: entry.tag,
          linenItemId: entry.linenItemId,
          fullNumber: entry.fullNumber,
          name: entry.name
        });
        
        const catalogItem = items.find(i => i.id === entry.linenItemId);
        // Usar linenItemId como chave se disponível, senão usar o nome ou fullNumber
        const key = entry.linenItemId || entry.fullNumber || entry.name || entry.tag;
        const current = map.get(key);
        map.set(key, {
          linenItemId: entry.linenItemId || null,  // Não usar fallback - deixar null se não existir
          quantity: (current?.quantity || 0) + 1,
          name: entry.name || catalogItem?.name || 'Tag Associada',
          sku: entry.sku || catalogItem?.sku,
          fullNumber: entry.fullNumber
        });
      });
    return Array.from(map.values());
  }, [rfidEntries, items]);

  const rfidTotalPieces = useMemo(
    () => rfidEntries.length,
    [rfidEntries]
  );

  const rfidSectorBed = useMemo(
    () => beds.find(b => b.sectorId === selectedSectorId && b.number === 'Sem leito (Setor)'),
    [beds, selectedSectorId]
  );

  const handleRfidDistribution = async () => {
    // Filtrar apenas tags cadastradas para distribuição (excluir "Buscando informações...")
    const validEntries = rfidEntries.filter(entry => entry.fullNumber || (entry.name && entry.name !== 'Buscando informações...'));
    
    if (!selectedSectorId || validEntries.length === 0) {
      if (rfidNotFoundCount > 0) {
        setRfidFeedback({ 
          type: 'error', 
          message: `Nenhuma peça cadastrada para distribuir. ${rfidNotFoundCount} tag(s) não cadastrada(s) foram ignoradas.` 
        });
      } else {
        setRfidFeedback({ type: 'error', message: 'Nenhuma peça RFID informada.' });
      }
      return;
    }

    const targetBedId =
      rfidScope === 'sector'
        ? rfidSectorBed?.id
        : rfidSelectedBedId || beds.find(b => b.sectorId === selectedSectorId)?.id;

    if (!targetBedId) {
      setRfidFeedback({
        type: 'error',
        message:
          rfidScope === 'sector'
            ? 'O setor não possui leito virtual cadastrado.'
            : 'Selecione um leito para distribuir.'
      });
      return;
    }

    stopRfidReading();
    setRfidSubmitting(true);
    setRfidFeedback(null);
    try {
      const sectorName = getSectorName(selectedSectorId);
      const bedName =
        rfidScope === 'sector' ? 'Sem leito (Setor)' : getBedName(targetBedId);
      const reason = `Distribuição RFID para ${sectorName} - ${bedName}`;

      // Usar apenas tags cadastradas (rfidSummary já filtra)
      console.log('📦 [RFID] rfidSummary:', rfidSummary);
      console.log('🎯 [RFID] targetBedId:', targetBedId);
      console.log('📝 [RFID] reason:', reason);
      
      // Separar itens com e sem linenItemId
      const itemsWithLinenItemId = rfidSummary.filter(s => s.linenItemId);
      const itemsWithoutLinenItemId = rfidSummary.filter(s => !s.linenItemId);
      
      console.log(`📊 [RFID] ${itemsWithLinenItemId.length} item(s) com linenItemId, ${itemsWithoutLinenItemId.length} sem linenItemId`);
      
      // Avisar sobre peças sem linenItemId
      if (itemsWithoutLinenItemId.length > 0) {
        console.warn('⚠️ [RFID] Peças RFID sem linenItemId não podem ser distribuídas via API antiga:', itemsWithoutLinenItemId);
        
        const pieceList = itemsWithoutLinenItemId
          .map(item => `${item.name || item.fullNumber || 'Tag desconhecida'} (${item.quantity}x)`)
          .join(', ');
        
        setRfidFeedback({
          type: 'error',
          message: `❌ Não é possível distribuir estas ${itemsWithoutLinenItemId.length} peça(s): ${pieceList}.\n\n` +
                   `Motivo: As tags RFID estão registradas mas NÃO estão associadas a nenhum item do catálogo do sistema.\n\n` +
                   `✅ Solução: Na tela "RFID - Associar/Expurgo", vá em "Associar Tags" e associe estas tags a um lote/item do catálogo antes de distribuir.`
        });
        setRfidSubmitting(false);
        return;
      }
      
      for (const summary of itemsWithLinenItemId) {
        const payload = {
          linenItemId: summary.linenItemId,
          bedId: targetBedId,
          quantity: summary.quantity,
          reason
        };
        
        console.log('📤 [RFID] Enviando para API /distribute:', payload);
        
        const response = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.DISTRIBUTE}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': API_CONFIG.API_KEY
            },
            body: JSON.stringify(payload)
          }
        );

        if (!response.ok) {
          const message = await response.text();
          console.error('❌ [RFID] Erro na distribuição:', {
            status: response.status,
            statusText: response.statusText,
            message,
            payload
          });
          throw new Error(message || 'Erro ao distribuir peças RFID.');
        }

        const json = await response.json();
        setItems(prev =>
          prev.map(item =>
            item.id === summary.linenItemId
              ? { ...item, currentStock: json.newStock ?? item.currentStock }
              : item
          )
        );
      }

      // Parar a leitura RFID
      stopRfidReading();
      
      // Mostrar mensagem de sucesso
      setRfidFeedback({
        type: 'success',
        message: `✅ Distribuição concluída! ${rfidTotalPieces} peça(s) distribuída(s) com sucesso.`
      });
      
      // Limpar a tela após 3 segundos
      setTimeout(() => {
        setRfidEntries([]);
        setRfidFeedback(null);
        setRfidEntriesPage(0);
      }, 3000);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro na distribuição RFID.';
      setRfidFeedback({ type: 'error', message });
    } finally {
      setRfidSubmitting(false);
    }
  };

  const removeRfidEntry = (tag: string) => {
    setRfidEntries(prev => prev.filter(entry => entry.tag !== tag));
  };

  const addRfidEntry = (entry: { tag: string; tid?: string; linenItemId?: string; name: string; sku?: string; notFound?: boolean }) => {
    setRfidEntries(prev => {
      if (prev.some(existing => existing.tag === entry.tag)) {
        return prev;
      }
      return [...prev, entry];
    });
  };

  const lookupRfidTag = async (rawTag: string, options?: { tid?: string | null; epc?: string | null }) => {
    // Normalizar tag: remover espaços, converter para maiúsculas, remover caracteres especiais
    const tag = rawTag.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '');
    if (!tag || !rfidReadingActive) return;
    
    // Não mostrar feedback de loading para não interromper o fluxo
    setRfidLookupLoading(true);
    
    // Tentar primeiro com a tag fornecida, depois tentar alternativas se falhar
    const tagsToTry = [tag];
    if (options?.epc && options.epc !== tag) tagsToTry.push(options.epc);
    if (options?.tid && options.tid !== tag && options.tid !== options?.epc) tagsToTry.push(options.tid);
    
    for (const tagToTry of tagsToTry) {
      try {
        const url = new URL(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_LOOKUP}`
        );
        url.searchParams.set('tag', tagToTry);
        
        console.log('🔍 [RFID] Buscando tag na API:', {
          tag: tagToTry,
          url: url.toString(),
          originalTag: rawTag,
          attempt: tagsToTry.indexOf(tagToTry) + 1,
          totalAttempts: tagsToTry.length
        });
        
        const response = await fetch(url.toString(), {
          headers: { 'x-api-key': API_CONFIG.API_KEY }
        });
        
        console.log('📡 [RFID] Resposta da API:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          tag: tagToTry
        });
        
        if (!response.ok) {
          const text = await response.text();
          console.warn('⚠️ [RFID] Tag não encontrada, tentando próxima:', {
            tag: tagToTry,
            status: response.status,
            text,
            hasMoreAttempts: tagsToTry.indexOf(tagToTry) < tagsToTry.length - 1
          });
          
          // Se não for a última tentativa, continuar loop
          if (tagsToTry.indexOf(tagToTry) < tagsToTry.length - 1) {
            continue;
          }
          
          // Se for a última tentativa, lançar erro
          throw new Error(text || `Tag ${tagToTry} não encontrada na base de dados.`);
        }
        
        // Se chegou aqui, encontrou a tag - processar resposta
        const data = await response.json();
        
        console.log('✅ [RFID] Dados COMPLETOS recebidos da API:', {
          dataCompleto: data,
          tagUsada: tagToTry,
          camposDisponiveis: Object.keys(data || {})
        });
        
        // Tentar extrair linenItemId de várias formas possíveis
        const linenItemId =
          data?.linenItemId ||
          data?.linenItem?.id ||
          data?.rfidItem?.linenItemId ||
          data?.item?.linenItemId ||
          data?.item?.id ||  // Adicionar esta tentativa
          data?.itemId ||
          null;

        console.log('🔍 [RFID] Tentativa de extração do linenItemId:', {
          'data?.linenItemId': data?.linenItemId,
          'data?.linenItem?.id': data?.linenItem?.id,
          'data?.rfidItem?.linenItemId': data?.rfidItem?.linenItemId,
          'data?.item?.linenItemId': data?.item?.linenItemId,
          'data?.item?.id': data?.item?.id,
          'data?.itemId': data?.itemId,
          'resultado_final': linenItemId
        });

        const catalogItem = linenItemId ? items.find(i => i.id === linenItemId) : null;
        const name =
          data?.linenItemName ||
          data?.linenItem?.name ||
          data?.item?.name ||
          catalogItem?.name ||
          'Tag Associada';
        const sku =
          data?.linenItemSku ||
          data?.linenItem?.sku ||
          data?.item?.sku ||
          catalogItem?.sku;
        
        // Extrair informações adicionais da peça
        const fullNumber = data?.fullNumber || data?.pieceNumber || '';
        const batchNumber = data?.batchNumber || 0;
        const pieceNumber = data?.pieceNumber || 0;
        const status = data?.status || 'EM_USO';
        const clientName = data?.clientName || data?.client?.name || '';
        
        console.log('✅ [RFID] Tag processada com sucesso:', {
          tag,
          name,
          fullNumber,
          status,
          clientName,
          linenItemId,
          catalogItem: catalogItem ? { id: catalogItem.id, name: catalogItem.name } : null,
          notFound: false
        });

        // Atualizar entrada existente (a tag já foi adicionada como "Buscando informações...")
        setRfidEntries(prev => prev.map(entry => 
          entry.tag === tag 
            ? { 
                ...entry,
                tag, 
                tid: entry.tid, 
                linenItemId, 
                name, 
                sku, 
                notFound: false,
                fullNumber,
                batchNumber,
                pieceNumber,
                status,
                clientName
              }
            : entry
        ));
        
        // Sucesso - sair do loop
        break;
      } catch (error) {
        // Se for a última tentativa, marcar como "não cadastrada"
        if (tagsToTry.indexOf(tagToTry) === tagsToTry.length - 1) {
          console.log('⚠️ [RFID] Tag não encontrada após todas as tentativas:', tag);
          
          // Marcar como não cadastrada
          setRfidEntries(prev => prev.map(entry => 
            entry.tag === tag 
              ? { 
                  ...entry,
                  name: 'Não cadastrada',
                  notFound: true
                }
              : entry
          ));
        }
        // Caso contrário, continuar tentando outras tags
      }
    }
    
    setRfidLookupLoading(false);
    setRfidDraft('');
    focusHiddenRfidInput();
  };

  const handleRfidKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!rfidReadingActive) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = event.currentTarget.value;
      event.currentTarget.value = '';
      setRfidDraft('');
      const tag = value.trim();
      if (tag) lookupRfidTag(tag);
    } else if (event.key === 'Escape') {
      setRfidDraft('');
      event.preventDefault();
    }
  };

  // ============
  // Fluxo Orders
  // ============

  const addItemToOrder = () => {
    if (!orderSelectedItemId || orderQuantity <= 0) return;
    setOrderItems(prev => {
      const existing = prev.find(i => i.itemId === orderSelectedItemId);
      if (existing) {
        return prev.map(i =>
          i.itemId === orderSelectedItemId
            ? { ...i, quantity: i.quantity + orderQuantity }
            : i
        );
      }
      return [...prev, { itemId: orderSelectedItemId, quantity: orderQuantity }];
    });
    setOrderSelectedItemId('');
    setOrderQuantity(1);
  };

  const removeItemFromOrder = (itemId: string) => {
    setOrderItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const handleCreateOrder = async () => {
    if (!orderSelectedBedId || orderItems.length === 0) {
      setOrderError('Selecione o leito e adicione ao menos um item');
      return;
    }

    setOrderSubmitting(true);
    setOrderError('');

    try {
      const result = await createRequest(orderSelectedBedId, orderItems, observations);
      if (result) {
        setOrderSuccess(true);
        setTimeout(() => {
          setOrderSuccess(false);
          setOrderSelectedSectorId('');
          setOrderSelectedBedId('');
          setOrderItems([]);
          setObservations('');
        }, 2000);
      } else {
        setOrderError('Erro ao criar pedido');
      }
    } catch (err) {
      console.error(err);
      setOrderError('Erro ao criar pedido');
    } finally {
      setOrderSubmitting(false);
    }
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
                <h1 className="text-2xl font-bold text-gray-800">Distribuição & Pedidos</h1>
                <p className="text-sm text-gray-600">
                  {selectedClient ? selectedClient.name : 'Sistema'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => {
                setMainView('distribution');
                resetDistributionFlow();
              }}
              className={`flex-1 py-3 px-6 rounded-lg border-2 transition-colors ${
                mainView === 'distribution'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <Package className="w-6 h-6 mx-auto mb-1" />
              <div className="font-semibold text-sm">Distribuição</div>
            </button>
            <button
              onClick={() => setMainView('orders')}
              className={`flex-1 py-3 px-6 rounded-lg border-2 transition-colors ${
                mainView === 'orders'
                  ? 'border-green-600 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <ShoppingCart className="w-6 h-6 mx-auto mb-1" />
              <div className="font-semibold text-sm">Pedidos</div>
            </button>
          </div>
        </div>

        {mainView === 'distribution' ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            {distributionView === 'modeSelection' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                  onClick={() => handleModeSelect('manual')}
                  className="rounded-2xl border-2 border-blue-100 hover:border-blue-300 bg-blue-50/70 hover:bg-blue-50 transition-all p-8 text-left flex flex-col gap-6 min-h-[240px] shadow-sm hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                    <Package className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-blue-800">Distribuição Manual</h3>
                  <p className="text-base text-blue-700/80 leading-relaxed">
                    Informe quantidades por item e escolha se a entrega é por leito ou por setor.
                  </p>
                </button>
                <button
                  onClick={() => handleModeSelect('rfid')}
                  className="rounded-2xl border-2 border-purple-100 hover:border-purple-300 bg-purple-50/70 hover:bg-purple-50 transition-all p-8 text-left flex flex-col gap-6 min-h-[240px] shadow-sm hover:shadow-md"
                >
                  <div className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md">
                    <Radio className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-semibold text-purple-800">Distribuição RFID</h3>
                  <p className="text-base text-purple-700/80 leading-relaxed">
                    Lance peças individualmente (digitando o número) e acompanhe o total por item.
                  </p>
                </button>
              </div>
            )}

            {distributionView === 'sectorSelection' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800">
                      Selecione um setor para continuar
                    </h3>
                    <p className="text-base text-gray-600">
                      Modo escolhido: {selectedMode === 'rfid' ? 'Distribuição RFID' : 'Distribuição Manual'}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setDistributionView('modeSelection');
                      setSelectedMode(null);
                    }}
                  >
                    Voltar
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {sectors.map(sector => (
                    <button
                      key={sector.id}
                      onClick={() => handleSectorSelection(sector.id)}
                      className="rounded-2xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all px-5 py-6 flex items-center gap-4 text-left min-h-[160px] bg-white"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">{sector.name}</h4>
                        <p className="text-sm text-gray-500">
                          Clique para distribuir neste setor
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modal de Distribuição Manual */}
            {showManualModal && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">
                        Distribuição Manual · {getSectorName(selectedSectorId)}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Informe as quantidades por item e escolha o destino das peças.
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={closeModals}>
                      Fechar
                    </Button>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                    <div className="flex flex-wrap gap-4 items-center">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          className="w-4 h-4"
                          checked={manualScope === 'bed'}
                          onChange={() => {
                            setManualScope('bed');
                            setManualSelectedBedId('');
                            setManualBedPage(0);
                          }}
                        />
                        Distribuir por leito
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          className="w-4 h-4"
                          checked={manualScope === 'sector'}
                          onChange={() => {
                            setManualScope('sector');
                            setManualSelectedBedId('');
                            setManualBedPage(0);
                          }}
                        />
                        Distribuir por setor
                      </label>
                    </div>

                    {manualScope === 'bed' ? (
                      manualBedsForSector.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          Nenhum leito cadastrado para este setor.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {manualBedsPageItems.map(bed => (
                              <button
                                key={bed.id}
                                onClick={() => setManualSelectedBedId(bed.id)}
                                className={`border rounded-lg p-3 text-left flex items-center gap-3 transition-all ${
                                  manualSelectedBedId === bed.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-blue-300'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                  <Bed className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-800">Leito {bed.number}</h4>
                                  <p className="text-xs text-gray-500">
                                    {bed.status === 'free' ? 'Livre' : 'Ocupado'}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                          {manualBedsForSector.length > BED_PAGE_SIZE && (
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <button
                                className="px-3 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                                onClick={() => setManualBedPage(page => Math.max(page - 1, 0))}
                                disabled={manualBedPage === 0}
                              >
                                ◀ Anterior
                              </button>
                              <span>
                                Página {manualBedPage + 1} de {manualTotalPages}
                              </span>
                              <button
                                className="px-3 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                                onClick={() =>
                                  setManualBedPage(page =>
                                    page < manualTotalPages - 1 ? page + 1 : page
                                  )
                                }
                                disabled={manualBedPage >= manualTotalPages - 1}
                              >
                                Próxima ▶
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                        {manualSectorBed
                          ? `As peças serão registradas no leito virtual "${manualSectorBed.number}".`
                          : 'Este setor não possui o leito virtual "Sem leito (Setor)". Cadastre-o antes de distribuir por setor.'}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-800">Selecionar itens</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3"
                        >
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800">{item.name}</h4>
                            <p className="text-xs text-gray-500">
                              SKU {item.sku} · Estoque disponível: {item.currentStock}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="w-9 h-9 border border-gray-300 rounded-lg hover:bg-gray-50"
                              onClick={() => handleManualQuantityChange(item.id, -1)}
                              disabled={manualSubmitting}
                            >
                              −
                            </button>
                            <span className="w-14 text-center font-semibold">
                              {manualQuantities[item.id] || 0}
                            </span>
                            <button
                              className="w-9 h-9 border border-gray-300 rounded-lg hover:bg-gray-50"
                              onClick={() => handleManualQuantityChange(item.id, 1)}
                              disabled={manualSubmitting}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-800">
                      Resumo da seleção
                    </h4>
                    {manualItemsArray.length === 0 ? (
                      <p className="text-xs text-gray-500">Nenhum item selecionado ainda.</p>
                    ) : (
                      <ul className="text-xs text-gray-600 space-y-1">
                        {manualItemsArray.map(([itemId, qty]) => {
                          const item = items.find(i => i.id === itemId);
                          return (
                            <li key={itemId}>
                              {item?.name || 'Item'} · {qty} peça(s)
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="text-sm font-semibold text-gray-700">
                      Total: {manualTotalPieces} peça(s)
                    </p>
                  </div>

                  {manualFeedback && (
                    <div
                      className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                        manualFeedback.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      {manualFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <span>{manualFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleManualDistribution}
                      disabled={
                        manualSubmitting ||
                        manualItemsArray.length === 0 ||
                        (manualScope === 'bed' && !manualSelectedBedId) ||
                        (manualScope === 'sector' && !manualSectorBed)
                      }
                    >
                      {manualSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Distribuindo...
                        </>
                      ) : (
                        'Confirmar distribuição'
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => {
                        setManualQuantities({});
                        setManualFeedback(null);
                      }}
                      disabled={manualSubmitting}
                    >
                      Limpar seleção
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal de Distribuição RFID */}
            {showRfidModal && (
              <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">
                        Distribuição RFID · {getSectorName(selectedSectorId)}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Inicie a leitura e aproxime cada peça RFID do leitor. Os itens serão reconhecidos automaticamente.
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={closeModals}>
                      Fechar
                    </Button>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                    <div className="flex flex-wrap gap-4 items-center">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          className="w-4 h-4"
                          checked={rfidScope === 'bed'}
                          onChange={() => {
                            setRfidScope('bed');
                            setRfidSelectedBedId('');
                            setRfidBedPage(0);
                          }}
                        />
                        Distribuir por leito
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          className="w-4 h-4"
                          checked={rfidScope === 'sector'}
                          onChange={() => {
                            setRfidScope('sector');
                            setRfidSelectedBedId('');
                            setRfidBedPage(0);
                          }}
                        />
                        Distribuir por setor
                      </label>
                    </div>

                    {rfidScope === 'bed' ? (
                      rfidBedsForSector.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          Nenhum leito cadastrado para este setor.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {rfidBedsPageItems.map(bed => (
                              <button
                                key={bed.id}
                                onClick={() => setRfidSelectedBedId(bed.id)}
                                className={`border rounded-lg p-3 text-left flex items-center gap-3 transition-all ${
                                  rfidSelectedBedId === bed.id
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-gray-200 hover:border-purple-300'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                                  <Bed className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-800">
                                    Leito {bed.number}
                                  </h4>
                                  <p className="text-xs text-gray-500">
                                    {bed.status === 'free' ? 'Livre' : 'Ocupado'}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                          {rfidBedsForSector.length > BED_PAGE_SIZE && (
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <button
                                className="px-3 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                                onClick={() => setRfidBedPage(page => Math.max(page - 1, 0))}
                                disabled={rfidBedPage === 0}
                              >
                                ◀ Anterior
                              </button>
                              <span>
                                Página {rfidBedPage + 1} de {rfidTotalPages}
                              </span>
                              <button
                                className="px-3 py-1 rounded-md border border-gray-300 bg-white disabled:opacity-50"
                                onClick={() =>
                                  setRfidBedPage(page =>
                                    page < rfidTotalPages - 1 ? page + 1 : page
                                  )
                                }
                                disabled={rfidBedPage >= rfidTotalPages - 1}
                              >
                                Próxima ▶
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-800">
                        {rfidSectorBed
                          ? `As peças serão registradas no leito virtual "${rfidSectorBed.number}".`
                          : 'Este setor não possui o leito virtual "Sem leito (Setor)".'}
                      </div>
                    )}
                  </div>

                  <input
                    ref={hiddenRfidInputRef}
                    type="text"
                    value={rfidDraft}
                    onChange={e => setRfidDraft(e.target.value)}
                    onKeyDown={handleRfidKeyDown}
                    onBlur={() => {
                      if (rfidReadingActive) {
                        focusHiddenRfidInput();
                      }
                    }}
                    className="absolute w-0 h-0 opacity-0"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col sm:flex-row gap-3">
                    {!rfidReadingActive ? (
                      <Button
                        variant="primary"
                        size="lg"
                        className="sm:w-48"
                        onClick={startRfidReading}
                      >
                        Iniciar leitura
                      </Button>
                    ) : (
                      <div className="flex items-center gap-3 text-sm text-purple-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Leitura em andamento... aproxime as peças do leitor.
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 space-y-3 min-h-[220px]">
                    <h3 className="text-lg font-semibold text-gray-800">
                      Peças registradas ({rfidTotalPieces})
                    </h3>
                    {rfidEntries.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Nenhuma peça lida até o momento. Clique em "Iniciar leitura" e passe as peças pelo leitor RFID.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div className="max-h-[420px] overflow-y-auto pr-1">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              {rfidEntriesPageItems.map(entry => {
                            const isNotFound = entry.notFound && !entry.fullNumber && !entry.name;
                            const displayTid = entry.tid || entry.tag; // Mostrar TID se disponível, senão mostra a tag
                            return (
                              <div
                                key={entry.tag}
                                className={`border rounded-lg p-3 flex justify-between items-center ${
                                  isNotFound 
                                    ? 'border-orange-300 bg-orange-50' 
                                    : 'border-gray-200'
                                }`}
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className={`text-sm font-semibold font-mono ${
                                      isNotFound ? 'text-orange-800' : 'text-gray-800'
                                    }`}>
                                      {displayTid}
                                    </p>
                                    {isNotFound && (
                                      <span className="text-xs text-orange-600 font-medium">
                                        Não cadastrada
                                      </span>
                                    )}
                                  </div>
                                  {!isNotFound && (
                                    <div className="mt-1 space-y-0.5">
                                      <p className="text-xs font-semibold text-gray-700">
                                        {entry.name}
                                      </p>
                                      {entry.fullNumber && (
                                        <p className="text-xs text-gray-500">
                                          Peça: {entry.fullNumber}
                                        </p>
                                      )}
                                      {entry.clientName && (
                                        <p className="text-xs text-gray-500">
                                          Cliente: {entry.clientName}
                                        </p>
                                      )}
                                      {entry.status && (
                                        <p className={`text-xs font-medium ${
                                          entry.status === 'EM_USO' ? 'text-green-600' :
                                          entry.status === 'DISTRIBUIDO' ? 'text-blue-600' :
                                          entry.status === 'EXPURGO' ? 'text-orange-600' :
                                          'text-gray-600'
                                        }`}>
                                          Status: {entry.status.replace(/_/g, ' ')}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeRfidEntry(entry.tag)}
                                  className="text-xs text-red-600 hover:text-red-800 ml-2"
                                >
                                  remover
                                </button>
                              </div>
                            );
                              })}
                            </div>
                          </div>
                          {rfidEntries.length > RFID_ENTRIES_PAGE_SIZE && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
                              <span className="font-medium text-gray-700">
                                Página {rfidEntriesPage + 1} de {rfidEntriesTotalPages}
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-base font-semibold disabled:opacity-40"
                                  onClick={() => setRfidEntriesPage(page => Math.max(page - 1, 0))}
                                  disabled={rfidEntriesPage === 0}
                                >
                                  ◀ Anterior
                                </button>
                                <button
                                  className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-base font-semibold disabled:opacity-40"
                                  onClick={() =>
                                    setRfidEntriesPage(page =>
                                      page < rfidEntriesTotalPages - 1 ? page + 1 : page
                                    )
                                  }
                                  disabled={rfidEntriesPage >= rfidEntriesTotalPages - 1}
                                >
                                  Próxima ▶
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-sm font-semibold text-gray-800 text-center">
                            Total: {rfidTotalPieces} tag(s) lida(s)
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 space-y-2 min-h-[180px]">
                    <h4 className="text-sm font-semibold text-gray-800">Resumo</h4>
                    {rfidNotFoundCount > 0 ? (
                      <div className="space-y-2">
                        <p className="text-lg font-bold text-orange-800">
                          {rfidNotFoundCount} tag(s) não cadastrada(s)
                        </p>
                        {rfidFoundCount > 0 && (
                          <p className="text-xs text-gray-600">
                            {rfidFoundCount} tag(s) cadastrada(s) pronta(s) para distribuir.
                          </p>
                        )}
                      </div>
                    ) : rfidSummary.length > 0 ? (
                      <>
                        <p className="text-xs text-gray-600 mb-2">
                          {rfidFoundCount} tag(s) cadastrada(s) pronta(s) para distribuir:
                        </p>
                        <ul className="text-xs text-gray-600 space-y-1">
                          {rfidSummary.map(row => (
                            <li key={row.linenItemId}>
                              {row.name} · {row.quantity} peça(s){row.sku ? ` · SKU ${row.sku}` : ''}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Nenhuma tag lida ainda.
                      </p>
                    )}
                  </div>

                  {rfidFeedback && (
                    <div
                      className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                        rfidFeedback.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      {rfidFeedback.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      <span>{rfidFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="primary"
                      fullWidth
                      onClick={handleRfidDistribution}
                      disabled={
                        rfidSubmitting ||
                        rfidFoundCount === 0 ||
                        (rfidScope === 'bed' && !rfidSelectedBedId) ||
                        (rfidScope === 'sector' && !rfidSectorBed)
                      }
                    >
                      {rfidSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Distribuindo...
                        </>
                      ) : (
                        `Distribuir ${rfidTotalPieces} peça(s)`
                      )}
                    </Button>
                    <Button
                      variant="secondary"
                      fullWidth
                      onClick={() => {
                        setRfidEntries([]);
                        setRfidFeedback(null);
                        stopRfidReading();
                      }}
                      disabled={rfidSubmitting}
                    >
                      Reiniciar leitura
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Setor</label>
                <select
                  value={orderSelectedSectorId}
                  onChange={e => {
                    setOrderSelectedSectorId(e.target.value);
                    setOrderSelectedBedId('');
                  }}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Selecione um setor...</option>
                  {sectors.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Leito</label>
                <select
                  value={orderSelectedBedId}
                  onChange={e => setOrderSelectedBedId(e.target.value)}
                  disabled={!orderSelectedSectorId}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="">Selecione um leito...</option>
                  {orderFilteredBeds.map(b => (
                    <option key={b.id} value={b.id}>
                      Leito {b.number} ({b.status === 'free' ? 'Livre' : 'Ocupado'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item de Enxoval
                </label>
                <select
                  value={orderSelectedItemId}
                  onChange={e => setOrderSelectedItemId(e.target.value)}
                  className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Selecione um item...</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} - Estoque: {item.currentStock} {item.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantidade
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setOrderQuantity(q => Math.max(1, q - 1))}
                    className="w-12 h-12 text-2xl font-bold border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={e =>
                      setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="flex-1 px-4 py-3 text-center text-2xl font-bold border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => setOrderQuantity(q => q + 1)}
                    className="w-12 h-12 text-2xl font-bold border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

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

            {orderError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {orderError}
              </div>
            )}

            {orderSuccess && (
              <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <span>Pedido criado com sucesso!</span>
              </div>
            )}

            <Button
              onClick={handleCreateOrder}
              disabled={orderSubmitting}
              variant="primary"
              size="lg"
              fullWidth
            >
              {orderSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                '✅ CONFIRMAR PEDIDO'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

