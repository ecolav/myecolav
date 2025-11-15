import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Radio,
  Loader2,
  AlertCircle,
  Package,
  Play,
  Square,
  RefreshCw,
  MapPin,
  QrCode
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';
import { useRFIDReader } from '../../hooks/useRFIDReader';
import { API_CONFIG } from '../../config/api';

interface RfidOperationsScreenProps {
  onBack: () => void;
}

interface PendingBatch {
  batchNumber: string;
  itemId: string;
  itemName: string;
  sku?: string;
  quantity: number;
  associatedTags: number;
  clientName?: string;
  createdAt?: string;
}

interface ExpurgoEntry {
  id: string;
  fullNumber?: string;
  itemName?: string;
  createdAt?: string;
  linenItemName?: string;
  sectorName?: string;
}

export const RfidOperationsScreen: React.FC<RfidOperationsScreenProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const { selectedClient } = useClients();

  // Comentário: o modo (limpo/sujo) define qual experiência mostrar.
  const isCleanMode = settings.totem.type === 'clean';
  const clientId = selectedClient?.id || settings.totem.clientId;

  // Hook para leitor RFID real (UR4)
  const {
    readings: rfidReadings,
    status: rfidStatus,
    connectToReader,
    startContinuousReading,
    stopContinuousReading,
    disconnectFromReader
  } = useRFIDReader();

  // --------------------------
  // Estado – Associação RFID (modo limpo)
  // --------------------------
  const [pendingBatches, setPendingBatches] = useState<PendingBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<PendingBatch | null>(null);
  const [showAssociationModal, setShowAssociationModal] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [scannedTags, setScannedTags] = useState<string[]>([]);
  const [readingActive, setReadingActive] = useState(false);
  const [associationFeedback, setAssociationFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [associationSubmitting, setAssociationSubmitting] = useState(false);
  const hiddenCleanInputRef = useRef<HTMLInputElement>(null);

  // --------------------------
  // Estado – Expurgo (modo sujo)
  // --------------------------
  const [expurgoQueue, setExpurgoQueue] = useState<ExpurgoEntry[]>([]);
  const [loadingExpurgo, setLoadingExpurgo] = useState(false);
  const [expurgoError, setExpurgoError] = useState<string | null>(null);
  const [expurgoTags, setExpurgoTags] = useState<Array<{ tag: string; tid?: string }>>([]);
  const [expurgoReading, setExpurgoReading] = useState(false);
  const [expurgoFeedback, setExpurgoFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const hiddenExpurgoInputRef = useRef<HTMLInputElement>(null);
  const expurgoQueueTimer = useRef<NodeJS.Timeout | null>(null);
  const processedExpurgoTagsRef = useRef<Set<string>>(new Set());
  const lastProcessedExpurgoReadingIdRef = useRef<number>(0);
  const processedCleanTagsRef = useRef<Set<string>>(new Set());
  const lastProcessedCleanReadingIdRef = useRef<number>(0);

  // --------------------------
  // Funções auxiliares de fetch
  // --------------------------

  const fetchPendingBatches = useCallback(async () => {
    // Comentário: carrega lotes com peças ainda sem tags associadas no backend.
    if (!isCleanMode) return;

    const effectiveClientId = clientId?.trim();
    if (!effectiveClientId) {
      setPendingBatches([]);
      setBatchesError('Configure o cliente nas configurações do Totem para listar os lotes.');
      return;
    }

    setLoadingBatches(true);
    setBatchesError(null);
    try {
      const params = new URLSearchParams();
      params.append('clientId', effectiveClientId);
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_PENDING_BATCHES}${params.toString() ? `?${params.toString()}` : ''}`,
        {
          headers: {
            'x-api-key': API_CONFIG.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setPendingBatches([]);
          setBatchesError('Nenhum lote pendente para associar.');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const batches = Array.isArray(data)
        ? data
        : Array.isArray(data?.batches)
          ? data.batches
          : Array.isArray(data?.pending)
            ? data.pending
            : Array.isArray(data?.data)
              ? data.data
              : [];

      const mapped: PendingBatch[] = batches.map((batch: any, index: number) => {
        const quantity = Number(
          batch.quantity ??
          batch.expectedQuantity ??
          batch.totalPieces ??
          (batch.pendingPieces ? batch.pendingPieces + (batch.associatedPieces ?? batch.currentCount ?? 0) : undefined) ??
          0
        );
        const associated = Number(
          batch.associatedTags ??
          batch.currentCount ??
          batch.associatedPieces ??
          0
        );

        return {
          batchNumber: String(batch.batchNumber ?? batch.lote ?? index + 1),
          itemId: String(batch.itemId ?? batch.item?.id ?? ''),
          itemName: batch.itemName ?? batch.item?.name ?? 'Item sem nome',
          sku: batch.itemSku ?? batch.item?.sku,
          quantity,
          associatedTags: associated,
          clientName: batch.clientName ?? batch.client?.name,
          createdAt: batch.createdAt
        };
      });

      setPendingBatches(
        mapped
          .filter(batch => batch.quantity > batch.associatedTags)
          .filter(batch => !!batch.itemId)
      );
    } catch (error) {
      console.error('Erro ao carregar lotes pendentes:', error);
      setBatchesError('Não foi possível carregar os lotes pendentes.');
    } finally {
      setLoadingBatches(false);
    }
  }, [clientId, isCleanMode]);

  const fetchExpurgoQueue = useCallback(async () => {
    // Comentário: carrega a fila atual de peças que já foram lidas no expurgo.
    if (isCleanMode) return;

    const effectiveClientId = clientId?.trim();
    if (!effectiveClientId) {
      setExpurgoQueue([]);
      setExpurgoError('Configure o cliente nas configurações do Totem para acompanhar o expurgo.');
      return;
    }

    setLoadingExpurgo(true);
    setExpurgoError(null);
    try {
      const params = new URLSearchParams();
      params.append('clientId', effectiveClientId);
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.LAUNDRY_EXPURGO_QUEUE}${params.toString() ? `?${params.toString()}` : ''}`,
        {
          headers: {
            'x-api-key': API_CONFIG.API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setExpurgoQueue([]);
          setExpurgoError('Fila do expurgo vazia por enquanto.');
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 [Expurgo] Dados recebidos da API da fila:', data);
      
      const entries = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : Array.isArray(data?.data) ? data.data : [];
      
      console.log(`📊 [Expurgo] Processando ${entries.length} entrada(s) da fila`);
      
      const mapped: ExpurgoEntry[] = entries.map((entry: any, index: number) => {
        // Tentar múltiplos campos para encontrar a tag/RFID
        const tagValue = entry.fullNumber 
          ?? entry.rfid 
          ?? entry.tag 
          ?? entry.rfidTag 
          ?? entry.rfidNumber
          ?? entry.tid
          ?? entry.epc
          ?? entry.number
          ?? null;
        
        console.log(`📊 [Expurgo] Entrada ${index + 1}:`, {
          id: entry.id ?? entry.rfidItemId ?? index,
          tagValue,
          entry: entry
        });
        
        return {
          id: String(entry.id ?? entry.rfidItemId ?? entry.rfidItem?.id ?? index),
          fullNumber: tagValue,
          itemName: entry.item?.name ?? entry.linenItem?.name ?? entry.linenItemName ?? entry.itemName,
          createdAt: entry.createdAt ?? entry.allocatedAt ?? entry.registeredAt,
          linenItemName: entry.linenItem?.name ?? entry.item?.name ?? entry.linenItemName,
          sectorName: entry.bed?.sector?.name ?? entry.sector?.name ?? entry.sectorName
        };
      });
      
      console.log(`✅ [Expurgo] ${mapped.length} entrada(s) mapeada(s) para a fila`);
      setExpurgoQueue(mapped);
    } catch (error) {
      console.error('Erro ao carregar fila do expurgo:', error);
      setExpurgoError('Não foi possível carregar a fila do expurgo.');
    } finally {
      setLoadingExpurgo(false);
    }
  }, [clientId, isCleanMode]);

  // --------------------------
  // Efeitos iniciais
  // --------------------------

  useEffect(() => {
    if (isCleanMode) {
      fetchPendingBatches();
    } else {
      fetchExpurgoQueue();
      // Comentário: em modo expurgo, atualizamos a fila periodicamente enquanto o operador estiver na tela.
      if (expurgoQueueTimer.current) clearInterval(expurgoQueueTimer.current);
      expurgoQueueTimer.current = setInterval(fetchExpurgoQueue, 15000);
      return () => {
        if (expurgoQueueTimer.current) clearInterval(expurgoQueueTimer.current);
      };
    }
    return () => {
      if (expurgoQueueTimer.current) clearInterval(expurgoQueueTimer.current);
    };
  }, [fetchPendingBatches, fetchExpurgoQueue, isCleanMode]);

  useEffect(() => {
    if (readingActive) {
      if (settings.rfid.readerModel !== 'chainway-ur4') {
        hiddenCleanInputRef.current?.focus();
      }
    } else if (settings.rfid.readerModel === 'chainway-ur4') {
      processedCleanTagsRef.current.clear();
      lastProcessedCleanReadingIdRef.current = 0;
    }
  }, [readingActive, showAssociationModal, settings.rfid.readerModel]);

  useEffect(() => {
    if (expurgoReading && settings.rfid.readerModel !== 'chainway-ur4') {
      hiddenExpurgoInputRef.current?.focus();
    }
  }, [expurgoReading, settings.rfid.readerModel]);

  // Processar tags recebidas do leitor real UR4 no modo expurgo - PROCESSAR EM LOTE
  useEffect(() => {
    if (!expurgoReading || isCleanMode || settings.rfid.readerModel !== 'chainway-ur4' || !rfidReadings.length) {
      return;
    }

    // Processar TODAS as leituras novas (não apenas a última)
    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedExpurgoReadingIdRef.current);

    if (newReadings.length === 0) return;

    console.log(`📡 [Expurgo] Processando ${newReadings.length} nova(s) leitura(s) de ${rfidReadings.length} total`);

    // Processar todas as tags de uma vez para evitar problemas de batch do React
    const tagsToProcess: Array<{ tag: string; readingId: number }> = [];

    newReadings.forEach(reading => {
      // Normalizar TID e EPC
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;

      // Priorizar TID (único por peça); usar EPC apenas como fallback
      const primaryTag = tid || epc;
      const uniqueKey = primaryTag;

      if (primaryTag && uniqueKey && !processedExpurgoTagsRef.current.has(uniqueKey)) {
        console.log('📡 [Expurgo] Nova tag detectada:', {
          id: reading.id,
          tag: primaryTag,
          tid: reading.tid,
          epc: reading.epc,
          normalizedTid: tid,
          normalizedEpc: epc,
          antenna: reading.antenna,
          using: tid ? 'TID' : 'EPC',
          uniqueKey
        });
        processedExpurgoTagsRef.current.add(uniqueKey);

        tagsToProcess.push({
          tag: primaryTag,
          readingId: reading.id
        });

        // Limpar tag processada após 5 segundos para permitir reprocessamento se necessário
        setTimeout(() => {
          processedExpurgoTagsRef.current.delete(uniqueKey);
        }, 5000);
      } else if (primaryTag && uniqueKey && processedExpurgoTagsRef.current.has(uniqueKey)) {
        console.log(`⚠️ [Expurgo] Tag ${uniqueKey} já foi processada, ignorando...`);
      }
    });

    // Processar todas as tags em lote
    if (tagsToProcess.length > 0) {
      console.log(`✅ [Expurgo] Processando ${tagsToProcess.length} tag(s) em lote`);

      // Adicionar todas as tags ao estado de uma vez (com TID)
      setExpurgoTags(prev => {
        const existingTags = new Set(prev.map(e => e.tag));
        const newEntries = tagsToProcess
          .filter(t => !existingTags.has(t.tag))
          .map(({ tag, readingId }) => {
            // Encontrar a leitura original para obter TID
            const originalReading = rfidReadings.find(r => r.id === readingId);
            const tid = originalReading?.tid 
              ? originalReading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '')
              : undefined;
            return { tag, tid };
          });
        
        if (newEntries.length > 0) {
          console.log(`✅ [Expurgo] ${newEntries.length} tag(s) nova(s) adicionada(s) ao estado`);
          return [...prev, ...newEntries];
        }
        return prev;
      });

      // Processar cada tag na API (em paralelo, sem bloquear)
      tagsToProcess.forEach(({ tag, readingId }) => {
        // Encontrar a leitura original para obter TID e EPC
        const originalReading = rfidReadings.find(r => r.id === readingId);
        handleExpurgoTag(tag, {
          tid: originalReading?.tid || null,
          epc: originalReading?.epc || null
        });
      });
    }

    // Atualizar último ID processado
    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedExpurgoReadingIdRef.current = maxId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfidReadings, expurgoReading, isCleanMode, settings.rfid.readerModel]);

  // Limpar tags processadas ao parar leitura
  useEffect(() => {
    if (!expurgoReading) {
      processedExpurgoTagsRef.current.clear();
      lastProcessedExpurgoReadingIdRef.current = 0;
    }
  }, [expurgoReading]);

  // --------------------------
  // Lógica de associação – modo limpo
  // --------------------------

  const openAssociationModal = (batch: PendingBatch) => {
    // Comentário: ao abrir o modal, limpamos estados de leitura anteriores.
    setSelectedBatch(batch);
    setScannedTags([]);
    setTagDraft('');
    setReadingActive(false);
    setAssociationFeedback(null);
    setShowAssociationModal(true);
  };

  const pendingPieces = useMemo(() => {
    if (!selectedBatch) return 0;
    return Math.max((selectedBatch.quantity ?? 0) - (selectedBatch.associatedTags ?? 0), 0);
  }, [selectedBatch]);

  const handleTagCapture = useCallback((rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    // Comentário: Normalizamos a tag para remoção de espaços e letras em maiúsculo.
    const normalized = trimmed.replace(/\s+/g, '').toUpperCase();

    setScannedTags(prev => {
      if (prev.includes(normalized)) {
        setAssociationFeedback({ type: 'info', message: `Tag ${normalized} já capturada.` } as any);
        return prev;
      }

      if (selectedBatch && pendingPieces === 0) {
        setAssociationFeedback({
          type: 'error',
          message: 'Este lote já possui todas as peças associadas. Atualize a lista ou escolha outro lote.'
        });
        return prev;
      }

      if (selectedBatch && pendingPieces > 0 && prev.length >= pendingPieces) {
        setAssociationFeedback({
          type: 'error',
          message: `Limite de ${pendingPieces} tag(s) atingido. Remova alguma tag antes de adicionar outra.`
        });
        return prev;
      }

      return [...prev, normalized];
    });
  }, [pendingPieces, selectedBatch]);

  const removeScannedTag = useCallback((tag: string) => {
    setScannedTags(prev => prev.filter(item => item !== tag));
  }, []);

  // Processar tags recebidas do leitor real UR4 - modo associação
  useEffect(() => {
    if (!readingActive || !isCleanMode || settings.rfid.readerModel !== 'chainway-ur4' || !rfidReadings.length) {
      return;
    }

    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedCleanReadingIdRef.current);
    if (newReadings.length === 0) return;

    newReadings.forEach(reading => {
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const tag = tid || epc;

      if (tag && !processedCleanTagsRef.current.has(tag)) {
        processedCleanTagsRef.current.add(tag);
        handleTagCapture(tag);

        setTimeout(() => {
          processedCleanTagsRef.current.delete(tag);
        }, 5000);
      }
    });

    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedCleanReadingIdRef.current = maxId;
  }, [handleTagCapture, isCleanMode, readingActive, rfidReadings, settings.rfid.readerModel]);

  const handleCleanKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = tagDraft;
      setTagDraft('');
      handleTagCapture(value);
    }
  };

  const startAssociationReading = useCallback(async () => {
    setAssociationFeedback(null);

    if (settings.rfid.readerModel === 'chainway-ur4') {
      try {
        if (!rfidStatus.isConnected) {
          await connectToReader();
        }
        startContinuousReading();
        console.log('✅ [Associação] Leitura RFID real iniciada');
        setReadingActive(true);
      } catch (error) {
        console.error('❌ [Associação] Erro ao iniciar leitura RFID:', error);
        setAssociationFeedback({
          type: 'error',
          message: 'Erro ao conectar ao leitor RFID. Verifique as configurações.'
        });
      }
    } else {
      setReadingActive(true);
      setTimeout(() => hiddenCleanInputRef.current?.focus(), 50);
    }
  }, [connectToReader, rfidStatus.isConnected, settings.rfid.readerModel, startContinuousReading]);

  const stopAssociationReading = useCallback(() => {
    if (settings.rfid.readerModel === 'chainway-ur4') {
      stopContinuousReading();
      console.log('🛑 [Associação] Leitura RFID real parada');
    } else {
      hiddenCleanInputRef.current?.blur();
    }
    setReadingActive(false);
  }, [settings.rfid.readerModel, stopContinuousReading]);

  useEffect(() => {
    if (!showAssociationModal && readingActive) {
      stopAssociationReading();
    }
  }, [readingActive, showAssociationModal, stopAssociationReading]);

  const handleAssociationSubmit = async () => {
    if (!selectedBatch) return;
    if (scannedTags.length === 0) {
      setAssociationFeedback({ type: 'error', message: 'Capture ao menos uma tag antes de confirmar.' });
      return;
    }

    setAssociationSubmitting(true);
    setAssociationFeedback(null);
    if (!selectedBatch.itemId) {
      setAssociationFeedback({ type: 'error', message: 'Lote sem itemId. Atualize a lista e tente novamente.' });
      return;
    }

    try {
      const endpoint = API_CONFIG.ENDPOINTS.TOTEM.RFID_ASSOCIATE_BATCH(selectedBatch.batchNumber);
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          tags: scannedTags,
          clientId,
          itemId: selectedBatch.itemId
        })
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `HTTP ${response.status}`);
      }

      setAssociationFeedback({
        type: 'success',
        message: `${scannedTags.length} tag(s) vinculada(s) ao lote ${selectedBatch.batchNumber}.`
      });
      setScannedTags([]);
      setReadingActive(false);
      await fetchPendingBatches();
    } catch (error) {
      console.error('Erro ao associar tags ao lote:', error);
      setAssociationFeedback({
        type: 'error',
        message: 'Não foi possível associar as tags. Verifique a conexão e tente novamente.'
      });
    } finally {
      setAssociationSubmitting(false);
    }
  };

  const cleanSummary = useMemo(() => {
    const expected = selectedBatch ? selectedBatch.quantity : 0;
    return {
      expected,
      associated: selectedBatch ? selectedBatch.associatedTags : 0,
      newCount: scannedTags.length,
      totalAfter: selectedBatch ? selectedBatch.associatedTags + scannedTags.length : scannedTags.length
    };
  }, [scannedTags.length, selectedBatch]);

  const remainingSlots = useMemo(() => {
    if (!selectedBatch) return 0;
    return Math.max(pendingPieces - scannedTags.length, 0);
  }, [pendingPieces, scannedTags.length, selectedBatch]);

  // --------------------------
  // Lógica de leitura do expurgo – modo sujo
  // --------------------------

  const startExpurgoReading = async () => {
    setExpurgoFeedback(null);
    setExpurgoReading(true);
    
    // Se for leitor UR4, usar leitor real
    if (settings.rfid.readerModel === 'chainway-ur4') {
      try {
        // Conectar e iniciar leitura real
        if (!rfidStatus.isConnected) {
          await connectToReader();
        }
        startContinuousReading();
        console.log('✅ [Expurgo] Leitura RFID real iniciada');
      } catch (error) {
        console.error('❌ [Expurgo] Erro ao iniciar leitura RFID:', error);
        setExpurgoFeedback({
          type: 'error',
          message: 'Erro ao conectar ao leitor RFID. Verifique as configurações.'
        });
        setExpurgoReading(false);
      }
    } else {
      // Modo fallback: emulação de teclado
      setTimeout(() => hiddenExpurgoInputRef.current?.focus(), 50);
    }
  };

  const stopExpurgoReading = () => {
    setExpurgoReading(false);
    
    // Se for leitor UR4, parar leitura real
    if (settings.rfid.readerModel === 'chainway-ur4') {
      stopContinuousReading();
      console.log('🛑 [Expurgo] Leitura RFID real parada');
    } else {
      // Modo fallback: emulação de teclado
      hiddenExpurgoInputRef.current?.blur();
    }
  };

  const handleExpurgoTag = async (rawValue: string, options?: { tid?: string | null; epc?: string | null }) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    // Normalizar tag: remover espaços, converter para maiúsculas, remover caracteres especiais
    const normalized = trimmed.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
    
    // Normalizar TID e EPC se disponíveis
    const normalizedTid = options?.tid ? options.tid.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '') : null;
    const normalizedEpc = options?.epc ? options.epc.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '') : null;
    
    // Verificar se a tag já foi processada (evitar duplicatas)
    if (expurgoTags.some(entry => entry.tag === normalized)) {
      console.log(`⚠️ [Expurgo] Tag ${normalized} já foi processada, ignorando...`);
      return;
    }

    // Tentar primeiro com a tag fornecida, depois tentar alternativas se falhar
    const tagsToTry = [normalized];
    if (options?.epc && options.epc !== normalized) {
      const normalizedEpc = options.epc.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
      if (normalizedEpc && normalizedEpc !== normalized) tagsToTry.push(normalizedEpc);
    }
    if (options?.tid && options.tid !== normalized) {
      const normalizedTid = options.tid.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
      if (normalizedTid && normalizedTid !== normalized && normalizedTid !== options?.epc) tagsToTry.push(normalizedTid);
    }

    let tagRegistered = false;
    let lastError: Error | null = null;

    // Tentar registrar com cada variação da tag
    for (const tagToTry of tagsToTry) {
      try {
        console.log(`📤 [Expurgo] Tentando registrar tag ${tagToTry} (tentativa ${tagsToTry.indexOf(tagToTry) + 1}/${tagsToTry.length})...`);
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.LAUNDRY_EXPURGO_READ}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_CONFIG.API_KEY
          },
          body: JSON.stringify({
            tag: tagToTry,
            clientId,
            source: 'totem-expurgo'
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage: string;
          
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorJson.message || errorText;
          } catch {
            errorMessage = errorText || `HTTP ${response.status}`;
          }

          // Se não for a última tentativa, continuar loop
          if (tagsToTry.indexOf(tagToTry) < tagsToTry.length - 1) {
            console.warn(`⚠️ [Expurgo] Tag ${tagToTry} não encontrada, tentando próxima variação...`);
            lastError = new Error(errorMessage);
            continue;
          }
          
          // Se for a última tentativa, lançar erro
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        console.log(`✅ [Expurgo] Tag ${tagToTry} registrada com sucesso:`, responseData);

        // Adicionar tag ao estado apenas se foi registrada com sucesso
        setExpurgoTags(prev => {
          if (prev.some(entry => entry.tag === normalized)) return prev;
          return [...prev, { 
            tag: normalized, 
            tid: normalizedTid || undefined 
          }];
        });

        // Atualizar feedback apenas para a última tag processada
        setExpurgoFeedback({
          type: 'success',
          message: `Tag ${normalized} registrada no expurgo.`
        });
        
        // Atualizar fila após um pequeno delay para garantir que o backend processou
        setTimeout(() => {
          fetchExpurgoQueue();
        }, 500);

        tagRegistered = true;
        break; // Sucesso - sair do loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Se for a última tentativa, mostrar erro
        if (tagsToTry.indexOf(tagToTry) === tagsToTry.length - 1) {
          console.error(`❌ [Expurgo] Erro ao registrar tag ${tagToTry}:`, lastError);
          setExpurgoFeedback({
            type: 'error',
            message: `Tag ${normalized} não encontrada ou não pode ser registrada no expurgo. Verifique se a peça está cadastrada e disponível.`
          });
        }
      }
    }

    if (!tagRegistered && lastError) {
      console.error(`❌ [Expurgo] Falha ao registrar tag ${normalized} após ${tagsToTry.length} tentativa(s):`, lastError);
    }
  };

  const handleExpurgoKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = event.currentTarget.value;
      event.currentTarget.value = '';
      handleExpurgoTag(value);
    }
  };

  const clearExpurgoTags = () => {
    setExpurgoTags([]);
    setExpurgoFeedback(null);
  };

  // --------------------------
  // Renderização
  // --------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Cabeçalho principal */}
      <header className="bg-white/80 backdrop-blur-lg shadow-xl border-b border-white/20 px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="secondary" size="sm" icon={ArrowLeft}>
              Voltar
            </Button>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-emerald-600 rounded-2xl flex items-center justify-center">
              <Radio className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {isCleanMode ? 'Associação RFID' : 'Leitura de Expurgo'}
              </h1>
              <p className="text-sm text-gray-600">
                {isCleanMode
                  ? 'Associe tags aos lotes pendentes de forma direta pelo totem.'
                  : 'Registre automaticamente as peças que entram no expurgo.'}
              </p>
            </div>
          </div>

          {!isCleanMode && (
            <Button onClick={fetchExpurgoQueue} variant="secondary" size="sm" icon={RefreshCw}>
              Atualizar fila
            </Button>
          )}
        </div>
      </header>

      <main className="p-8 space-y-8">
        {isCleanMode ? (
          <>
            {/* Lista de lotes pendentes */}
            <section>
              <Card className="p-6 bg-white shadow-lg border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Lotes aguardando associação</h2>
                    <p className="text-sm text-gray-600">
                      Toque em um lote para iniciar a leitura das tags RFID.
                    </p>
                  </div>
                  <Button onClick={fetchPendingBatches} variant="secondary" size="sm" icon={RefreshCw} disabled={loadingBatches}>
                    Atualizar
                  </Button>
                </div>

                {loadingBatches ? (
                  <div className="flex items-center justify-center py-12 text-gray-500 gap-3">
                    <Loader2 className="animate-spin" />
                    Carregando lotes...
                  </div>
                ) : pendingBatches.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 gap-4">
                    <Package size={48} className="text-gray-300" />
                    <p>{batchesError || 'Nenhum lote pendente no momento.'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingBatches.map(batch => {
                      const remaining = batch.quantity - batch.associatedTags;
                      return (
                        <button
                          key={batch.batchNumber}
                          onClick={() => openAssociationModal(batch)}
                          className="text-left border-2 border-gray-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-lg transition-all bg-white"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Package className="text-blue-600" size={24} />
                              </div>
                              <div>
                                <p className="text-sm text-gray-500">Lote</p>
                                <p className="text-xl font-bold text-gray-900">#{batch.batchNumber}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Restantes</p>
                              <p className="text-2xl font-bold text-blue-700">{Math.max(remaining, 0)}</p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600">
                            <p>
                              <span className="font-semibold text-gray-800">Item:</span> {batch.itemName}
                            </p>
                            {batch.sku && (
                              <p>
                                <span className="font-semibold text-gray-800">SKU:</span> {batch.sku}
                              </p>
                            )}
                            <p className="flex items-center gap-2">
                              <QrCode size={16} className="text-blue-500" />
                              {batch.associatedTags} / {batch.quantity} tags associadas
                            </p>
                            {batch.clientName && (
                              <p className="flex items-center gap-2">
                                <MapPin size={16} className="text-emerald-500" />
                                {batch.clientName}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </section>

            {/* Modal de associação */}
            {showAssociationModal && selectedBatch && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-3xl p-6 space-y-6 border border-gray-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">
                        Lote #{selectedBatch.batchNumber}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {selectedBatch.itemName} · {selectedBatch.sku || 'SKU não informado'}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (readingActive) stopAssociationReading();
                        setShowAssociationModal(false);
                        setSelectedBatch(null);
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Fechar
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                    <div>
                      <p className="text-xs text-gray-500">Quantidade prevista</p>
                      <p className="text-2xl font-semibold text-gray-900">{cleanSummary.expected}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Já associados</p>
                      <p className="text-2xl font-semibold text-blue-600">{cleanSummary.associated}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Capturados agora</p>
                      <p className="text-2xl font-semibold text-purple-600">{cleanSummary.newCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total após envio</p>
                      <p className="text-2xl font-semibold text-emerald-600">{cleanSummary.totalAfter}</p>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-blue-300 rounded-xl p-6 bg-blue-50/50">
                    <input
                      ref={hiddenCleanInputRef}
                      type="text"
                      value={tagDraft}
                      onChange={event => setTagDraft(event.target.value)}
                      onKeyDown={handleCleanKeyDown}
                      onBlur={() => {
                        if (readingActive) {
                          hiddenCleanInputRef.current?.focus();
                        }
                      }}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                      aria-hidden="true"
                    />

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Radio className={readingActive ? 'text-emerald-600 animate-pulse' : 'text-gray-400'} size={32} />
                        <div>
                          <p className="text-lg font-semibold text-gray-800">
                            {readingActive ? 'Leitura em andamento' : 'Leitura parada'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {readingActive
                              ? 'Passe cada peça pelo leitor RFID. As tags aparecem abaixo.'
                              : 'Toque em “Iniciar leitura” e posicione as etiquetas no leitor.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {readingActive ? (
                          <Button onClick={stopAssociationReading} variant="secondary" size="sm" icon={Square}>
                            Parar leitura
                          </Button>
                        ) : (
                          <Button onClick={startAssociationReading} variant="primary" size="sm" icon={Play}>
                            Iniciar leitura
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800">
                          Tags capturadas ({scannedTags.length})
                        </h4>
                        {selectedBatch && (
                          <p className="text-sm text-gray-500">
                            Restam {remainingSlots} de {pendingPieces} tag(s) permitidas para este lote.
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          setScannedTags([]);
                          setAssociationFeedback(null);
                        }}
                        variant="secondary"
                        size="sm"
                        disabled={scannedTags.length === 0}
                      >
                        Limpar lista
                      </Button>
                    </div>
                    <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto p-4 bg-white">
                      {scannedTags.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">
                          Nenhuma tag capturada ainda.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {scannedTags.map(tag => (
                            <div
                              key={tag}
                              className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                            >
                              <span className="font-mono text-blue-800">{tag}</span>
                              <button
                                className="text-xs text-red-600 hover:text-red-800"
                                onClick={() => removeScannedTag(tag)}
                              >
                                remover
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {associationFeedback && (
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg ${
                        associationFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : associationFeedback.type === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}
                    >
                      <AlertCircle size={18} />
                      <span className="text-sm font-medium">{associationFeedback.message}</span>
                    </div>
                  )}

                  <div className="flex justify-between pt-2">
                    <Button
                      onClick={() => {
                        if (readingActive) stopAssociationReading();
                        setShowAssociationModal(false);
                        setSelectedBatch(null);
                      }}
                      variant="secondary"
                      size="lg"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAssociationSubmit}
                      variant="primary"
                      size="lg"
                      disabled={associationSubmitting || scannedTags.length === 0}
                    >
                      {associationSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="animate-spin" size={18} />
                          Enviando...
                        </div>
                      ) : (
                        `Associar ${scannedTags.length} tag(s)`
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Painel de leitura */}
              <Card className="p-6 bg-white shadow-lg border border-gray-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Leitura do expurgo</h2>
                    <p className="text-sm text-gray-600">
                      Aproxime as peças com RFID do leitor para registrar a saída do setor.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {expurgoReading ? (
                      <Button onClick={stopExpurgoReading} variant="secondary" size="sm" icon={Square}>
                        Parar
                      </Button>
                    ) : (
                      <Button onClick={startExpurgoReading} variant="primary" size="sm" icon={Play}>
                        Iniciar
                      </Button>
                    )}
                  </div>
                </div>

                <div className="border-2 border-dashed border-orange-300 rounded-xl bg-orange-50/50 p-6">
                  {settings.rfid.readerModel === 'chainway-ur4' ? (
                    <div className="flex items-center gap-4">
                      <Radio className={expurgoReading ? 'text-orange-500 animate-pulse' : 'text-gray-400'} size={32} />
                      <div className="flex-1">
                        <p className="text-lg font-semibold text-gray-800">
                          {expurgoReading ? 'Leitura em andamento' : 'Leitura parada'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {expurgoReading
                            ? `Leitor UR4 conectado. ${rfidStatus.totalReadings || 0} tag(s) lida(s). As tags são enviadas automaticamente para o expurgo.`
                            : 'Toque em "Iniciar" para começar a leitura contínua com o leitor UR4.'}
                        </p>
                        {!rfidStatus.isConnected && expurgoReading && (
                          <p className="text-xs text-orange-600 mt-1">
                            ⚠️ Conectando ao leitor RFID...
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={hiddenExpurgoInputRef}
                        type="text"
                        onKeyDown={handleExpurgoKeyDown}
                        className="absolute w-0 h-0 opacity-0 pointer-events-none"
                        aria-hidden="true"
                      />
                      <div className="flex items-center gap-4">
                        <Radio className={expurgoReading ? 'text-orange-500 animate-pulse' : 'text-gray-400'} size={32} />
                        <div>
                          <p className="text-lg font-semibold text-gray-800">
                            {expurgoReading ? 'Leitura em andamento' : 'Leitura parada'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {expurgoReading
                              ? 'As tags lidas são enviadas automaticamente para o expurgo.'
                              : 'Toque em "Iniciar" para começar a leitura contínua.'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Tags registradas nesta sessão ({expurgoTags.length})
                  </h3>
                  <Button onClick={clearExpurgoTags} variant="secondary" size="sm" disabled={expurgoTags.length === 0}>
                    Limpar sessão
                  </Button>
                </div>

                <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto bg-white p-4">
                  {expurgoTags.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">
                      Nenhuma leitura registrada nesta sessão.
                    </p>
                  ) : (
                    <ul className="space-y-2 font-mono text-sm text-gray-700">
                      {expurgoTags.map((entry, index) => {
                        const displayTid = entry.tid || entry.tag; // Mostrar TID se disponível, senão mostra a tag
                        return (
                          <li key={`${entry.tag}-${index}`} className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{displayTid}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {expurgoFeedback && (
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                      expurgoFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        : 'bg-red-50 border-red-100 text-red-700'
                    }`}
                  >
                    <AlertCircle size={18} />
                    <span className="text-sm font-medium">{expurgoFeedback.message}</span>
                  </div>
                )}
              </Card>

              {/* Lista do expurgo */}
              <Card className="p-6 bg-white shadow-lg border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Fila atual do expurgo</h2>
                    <p className="text-sm text-gray-600">
                      Peças já registradas aguardando envio para a lavanderia.
                    </p>
                  </div>
                </div>

                {loadingExpurgo ? (
                  <div className="flex items-center justify-center py-12 text-gray-500 gap-3">
                    <Loader2 className="animate-spin" />
                    Carregando fila...
                  </div>
                ) : expurgoQueue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 gap-4">
                    <Package size={48} className="text-gray-300" />
                    <p>{expurgoError || 'Nenhuma peça registrada no expurgo até o momento.'}</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[30rem] overflow-y-auto">
                    {expurgoQueue.map(entry => (
                      <div key={entry.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 hover:bg-white transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-500">RFID</p>
                            <p className="text-lg font-mono font-semibold text-gray-900">
                              {entry.fullNumber || 'Tag não informada'}
                            </p>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'Data não informada'}
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-700 space-y-1">
                          <p>
                            <span className="font-semibold text-gray-800">Item:</span>{' '}
                            {entry.itemName || entry.linenItemName || '—'}
                          </p>
                          {entry.sectorName && (
                            <p>
                              <span className="font-semibold text-gray-800">Setor:</span> {entry.sectorName}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

