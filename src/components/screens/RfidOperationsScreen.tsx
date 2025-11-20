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
import { useRfidItem } from '../../hooks/useRfidItem';
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
  tag: string;
  fullNumber?: string;
  itemName?: string;
  createdAt?: string;
  linenItemName?: string;
  sectorName?: string;
  status?: string;
  clientName?: string;
  batchNumber?: number;
  pieceNumber?: number;
  sku?: string;
}

interface AssociationResult {
  tag: string;
  status: 'success' | 'error';
  message?: string;
  piece?: string;
}

interface SessionExpurgoTag {
  tag: string;
  tid?: string;
  itemName?: string;
  status: 'pending' | 'success' | 'error';
  feedback?: string;
  fullNumber?: string;
  batchNumber?: number;
  pieceNumber?: number;
  rfidStatus?: string;
  clientName?: string;
  sku?: string;
}

type CleanTab = 'association' | 'nonconformity' | 'maintenance';
type NonconformityReason = 'relave' | 'dano' | 'mancha' | 'costura';

interface SessionNonconformityTag {
  tag: string;
  reason: NonconformityReason;
  status: 'pending' | 'success' | 'error';
  feedback?: string;
}

interface SessionReassignTag {
  tag: string;
  reason?: string;
  status: 'pending' | 'success' | 'error';
  feedback?: string;
}

interface SessionRetireTag {
  tag: string;
  reason: string;
  status: 'pending' | 'success' | 'error';
  feedback?: string;
}

const NONCONFORMITY_OPTIONS: Array<{ key: NonconformityReason; label: string; description: string; tone: string }> = [
  { key: 'relave', label: 'Relavagem', description: 'Peças que precisam voltar para lavagem', tone: 'bg-blue-100 text-blue-800 border-blue-200' },
  { key: 'dano', label: 'Dano', description: 'Danos estruturais (rasgos, queimados)', tone: 'bg-red-100 text-red-800 border-red-200' },
  { key: 'mancha', label: 'Mancha', description: 'Manchas persistentes após lavagem', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  { key: 'costura', label: 'Costura', description: 'Peças que exigem reparos de costura', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
] as const;

const REASSIGN_REASONS = [
  { value: 'tag_danificada', label: 'Tag danificada' },
  { value: 'peca_substituida', label: 'Peça substituída' },
  { value: 'limpar_chip', label: 'Liberação para reuso' },
  { value: 'outro', label: 'Outro motivo' }
] as const;

const RETIRE_REASONS = [
  { value: 'descarte', label: 'Descarte definitivo' },
  { value: 'dano_cliente', label: 'Dano causado pelo cliente' },
  { value: 'obsolescencia', label: 'Peça obsoleta / sem condições' },
  { value: 'extravio', label: 'Extravio / roubo' }
] as const;

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
    stopContinuousReading
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
const [scannedTagsInfo, setScannedTagsInfo] = useState<Map<string, any>>(new Map());
const [associationResults, setAssociationResults] = useState<AssociationResult[]>([]);
const [readingActive, setReadingActive] = useState(false);
const [associationFeedback, setAssociationFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
const [associationSubmitting, setAssociationSubmitting] = useState(false);
const hiddenCleanInputRef = useRef<HTMLInputElement>(null);
const [cleanTab, setCleanTab] = useState<CleanTab>('association');
const [nonconformityReason, setNonconformityReason] = useState<NonconformityReason | ''>('');
const [nonconformityTags, setNonconformityTags] = useState<SessionNonconformityTag[]>([]);
const [nonconformityReading, setNonconformityReading] = useState(false);
const [nonconformityFeedback, setNonconformityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
const hiddenNonconformityInputRef = useRef<HTMLInputElement>(null);
const processedNonconformityTagsRef = useRef<Set<string>>(new Set());
const lastProcessedNonconformityReadingIdRef = useRef<number>(0);
const [reassignReason, setReassignReason] = useState<string>(REASSIGN_REASONS[0].value);
const [reassignNotes, setReassignNotes] = useState('');
const [reassignTags, setReassignTags] = useState<SessionReassignTag[]>([]);
const [reassignReading, setReassignReading] = useState(false);
const [reassignFeedback, setReassignFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
const hiddenReassignInputRef = useRef<HTMLInputElement>(null);
const processedReassignTagsRef = useRef<Set<string>>(new Set());
const lastProcessedReassignReadingIdRef = useRef<number>(0);
const [retireReason, setRetireReason] = useState<string>(RETIRE_REASONS[0]?.value ?? '');
const [retireNotes, setRetireNotes] = useState('');
const [retireTags, setRetireTags] = useState<SessionRetireTag[]>([]);
const [retireReading, setRetireReading] = useState(false);
const [retireFeedback, setRetireFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
const hiddenRetireInputRef = useRef<HTMLInputElement>(null);
const processedRetireTagsRef = useRef<Set<string>>(new Set());
const lastProcessedRetireReadingIdRef = useRef<number>(0);

  // --------------------------
  // Estado – Expurgo (modo sujo)
  // --------------------------
const [expurgoQueue, setExpurgoQueue] = useState<ExpurgoEntry[]>([]);
const [loadingExpurgo, setLoadingExpurgo] = useState(false);
const [expurgoError, setExpurgoError] = useState<string | null>(null);
const [expurgoTags, setExpurgoTags] = useState<SessionExpurgoTag[]>([]);
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
          ?? entry.rfidTagUid
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
          tag: tagValue,
          fullNumber: tagValue,
          itemName: entry.item?.name ?? entry.linenItem?.name ?? entry.linenItemName ?? entry.itemName,
          sku: entry.item?.sku ?? entry.linenItem?.sku ?? entry.sku,
          createdAt: entry.createdAt ?? entry.allocatedAt ?? entry.registeredAt,
          linenItemName: entry.linenItem?.name ?? entry.item?.name ?? entry.linenItemName,
          sectorName: entry.bed?.sector?.name ?? entry.sector?.name ?? entry.sectorName,
          status: entry.status ?? 'EXPURGO',
          clientName: entry.client?.name ?? entry.clientName,
          batchNumber: entry.batchNumber,
          pieceNumber: entry.pieceNumber
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
            const originalReading = rfidReadings.find(r => r.id === readingId);
            const tid = originalReading?.tid 
              ? originalReading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '')
              : undefined;
            return { tag, tid, status: 'pending' as const };
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
    setScannedTagsInfo(new Map());
    setAssociationResults([]);
    setTagDraft('');
    setReadingActive(false);
    setAssociationFeedback(null);
    setShowAssociationModal(true);
  };

  const pendingPieces = useMemo(() => {
    if (!selectedBatch) return 0;
    return Math.max((selectedBatch.quantity ?? 0) - (selectedBatch.associatedTags ?? 0), 0);
  }, [selectedBatch]);

  const handleTagCapture = useCallback(async (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;

    // Comentário: Normalizamos a tag para remoção de espaços e letras em maiúsculo.
    const normalized = trimmed.replace(/\s+/g, '').toUpperCase();

    setAssociationResults(prev => prev.filter(entry => entry.tag !== normalized));

    // Buscar informações da tag via API
    let tagInfo: any = null;
    try {
      const lookupUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_LOOKUP}?tag=${encodeURIComponent(normalized)}`;
      const lookupResponse = await fetch(lookupUrl, {
        headers: {
          'x-api-key': API_CONFIG.API_KEY,
          'Accept': 'application/json'
        }
      });
      
      if (lookupResponse.ok) {
        tagInfo = await lookupResponse.json();
        console.log(`🔍 [Associação] Informações da tag ${normalized}:`, tagInfo);
        
        // Armazenar informações da tag
        setScannedTagsInfo(prev => {
          const newMap = new Map(prev);
          newMap.set(normalized, tagInfo);
          return newMap;
        });
      }
    } catch (error) {
      console.warn(`⚠️ [Associação] Não foi possível buscar informações da tag ${normalized}:`, error);
    }

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
    setScannedTagsInfo(prev => {
      const newMap = new Map(prev);
      newMap.delete(tag);
      return newMap;
    });
    setAssociationResults(prev => prev.filter(entry => entry.tag !== tag));
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

  const handleNonconformityTag = useCallback(async (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const normalized = trimmed.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
    if (!normalized) return;

    if (!clientId) {
      setNonconformityFeedback({ type: 'error', message: 'Configure o cliente nas configurações antes de registrar inconformidades.' });
      return;
    }

    if (!nonconformityReason) {
      setNonconformityFeedback({ type: 'error', message: 'Selecione o motivo da inconformidade antes de ler a tag.' });
      return;
    }

    setNonconformityTags(prev => {
      if (prev.some(entry => entry.tag === normalized)) return prev;
      return [...prev, { tag: normalized, reason: nonconformityReason, status: 'pending' }];
    });

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_NONCONFORMITY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          clientId,
          reason: nonconformityReason,
          tag: normalized
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Falha ao registrar inconformidade');
      }

      const data = await response.json();
      setNonconformityTags(prev =>
        prev.map(entry =>
          entry.tag === normalized
            ? {
                ...entry,
                status: 'success',
                feedback: data?.item?.fullNumber
                  ? `Peça ${data.item.fullNumber} encaminhada`
                  : 'Registrada com sucesso'
              }
            : entry
        )
      );

      const reasonLabel = NONCONFORMITY_OPTIONS.find(option => option.key === nonconformityReason)?.label;
      setNonconformityFeedback({
        type: 'success',
        message: reasonLabel
          ? `Tag ${normalized} enviada para ${reasonLabel}.`
          : `Tag ${normalized} registrada.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar inconformidade';
      setNonconformityTags(prev =>
        prev.map(entry =>
          entry.tag === normalized ? { ...entry, status: 'error', feedback: message } : entry
        )
      );
      setNonconformityFeedback({ type: 'error', message });
    }
  }, [clientId, nonconformityReason]);

  const handleNonconformityKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = event.currentTarget.value;
      event.currentTarget.value = '';
      handleNonconformityTag(value);
    }
  };

  const startNonconformityReading = useCallback(async () => {
    if (!nonconformityReason) {
      setNonconformityFeedback({ type: 'error', message: 'Selecione o motivo da inconformidade antes de iniciar a leitura.' });
      return;
    }

    setNonconformityFeedback(null);

    if (settings.rfid.readerModel === 'chainway-ur4') {
      try {
        if (!rfidStatus.isConnected) {
          await connectToReader();
        }
        startContinuousReading();
        setNonconformityReading(true);
      } catch (error) {
        console.error('❌ [Inconformidade] Erro ao iniciar leitura RFID:', error);
        setNonconformityFeedback({
          type: 'error',
          message: 'Erro ao conectar ao leitor RFID. Verifique as configurações.'
        });
      }
    } else {
      setNonconformityReading(true);
      setTimeout(() => hiddenNonconformityInputRef.current?.focus(), 50);
    }
  }, [connectToReader, nonconformityReason, rfidStatus.isConnected, settings.rfid.readerModel, startContinuousReading]);

  const stopNonconformityReading = useCallback(() => {
    if (settings.rfid.readerModel === 'chainway-ur4') {
      stopContinuousReading();
    } else {
      hiddenNonconformityInputRef.current?.blur();
    }
    setNonconformityReading(false);
  }, [settings.rfid.readerModel, stopContinuousReading]);

  useEffect(() => {
    if (nonconformityReading) {
      if (settings.rfid.readerModel !== 'chainway-ur4') {
        hiddenNonconformityInputRef.current?.focus();
      }
    } else {
      processedNonconformityTagsRef.current.clear();
      lastProcessedNonconformityReadingIdRef.current = 0;
    }
  }, [nonconformityReading, settings.rfid.readerModel]);

  useEffect(() => {
    if (!isCleanMode || cleanTab !== 'nonconformity' || !nonconformityReading || settings.rfid.readerModel !== 'chainway-ur4' || !rfidReadings.length) {
      return;
    }

    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedNonconformityReadingIdRef.current);
    if (newReadings.length === 0) return;

    newReadings.forEach(reading => {
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const tag = tid || epc;
      if (tag && !processedNonconformityTagsRef.current.has(tag)) {
        processedNonconformityTagsRef.current.add(tag);
        handleNonconformityTag(tag);
        setTimeout(() => processedNonconformityTagsRef.current.delete(tag), 5000);
      }
    });

    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedNonconformityReadingIdRef.current = maxId;
  }, [cleanTab, handleNonconformityTag, isCleanMode, nonconformityReading, rfidReadings, settings.rfid.readerModel]);

  const handleReassignKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = event.currentTarget.value;
      event.currentTarget.value = '';
      handleReassignTagScan(value);
    }
  };

  const handleRetireKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = event.currentTarget.value;
      event.currentTarget.value = '';
      handleRetireTagScan(value);
    }
  };

  const startReassignReading = useCallback(async () => {
    if (!clientId) {
      setReassignFeedback({ type: 'error', message: 'Selecione o cliente antes de iniciar a leitura.' });
      return;
    }
    setReassignFeedback(null);

    if (settings.rfid.readerModel === 'chainway-ur4') {
      try {
        if (!rfidStatus.isConnected) {
          await connectToReader();
        }
        startContinuousReading();
        setReassignReading(true);
      } catch (error) {
        console.error('❌ [Reassociação] Erro ao iniciar leitura RFID:', error);
        setReassignFeedback({
          type: 'error',
          message: 'Erro ao conectar ao leitor RFID. Verifique as configurações.'
        });
      }
    } else {
      setReassignReading(true);
      setTimeout(() => hiddenReassignInputRef.current?.focus(), 50);
    }
  }, [clientId, connectToReader, rfidStatus.isConnected, settings.rfid.readerModel, startContinuousReading]);

  const stopReassignReading = useCallback(() => {
    if (settings.rfid.readerModel === 'chainway-ur4') {
      stopContinuousReading();
    } else {
      hiddenReassignInputRef.current?.blur();
    }
    setReassignReading(false);
    processedReassignTagsRef.current.clear();
    lastProcessedReassignReadingIdRef.current = 0;
  }, [settings.rfid.readerModel, stopContinuousReading]);

  const startRetireReading = useCallback(async () => {
    if (!clientId) {
      setRetireFeedback({ type: 'error', message: 'Selecione o cliente antes de iniciar a leitura.' });
      return;
    }
    if (!retireReason) {
      setRetireFeedback({ type: 'error', message: 'Selecione o motivo da baixa antes de iniciar.' });
      return;
    }

    setRetireFeedback(null);

    if (settings.rfid.readerModel === 'chainway-ur4') {
      try {
        if (!rfidStatus.isConnected) {
          await connectToReader();
        }
        startContinuousReading();
        setRetireReading(true);
      } catch (error) {
        console.error('❌ [Baixa] Erro ao iniciar leitura RFID:', error);
        setRetireFeedback({
          type: 'error',
          message: 'Erro ao conectar ao leitor RFID. Verifique as configurações.'
        });
      }
    } else {
      setRetireReading(true);
      setTimeout(() => hiddenRetireInputRef.current?.focus(), 50);
    }
  }, [clientId, connectToReader, retireReason, rfidStatus.isConnected, settings.rfid.readerModel, startContinuousReading]);

  const stopRetireReading = useCallback(() => {
    if (settings.rfid.readerModel === 'chainway-ur4') {
      stopContinuousReading();
    } else {
      hiddenRetireInputRef.current?.blur();
    }
    setRetireReading(false);
    processedRetireTagsRef.current.clear();
    lastProcessedRetireReadingIdRef.current = 0;
  }, [settings.rfid.readerModel, stopContinuousReading]);

  const handleReassignTagScan = useCallback(async (rawValue: string) => {
    const normalized = normalizeTagValue(rawValue);
    if (!normalized) return;

    if (!clientId) {
      setReassignFeedback({ type: 'error', message: 'Configure o cliente do totem antes de liberar tags.' });
      return;
    }

    setReassignTags(prev => {
      const existing = prev.find(entry => entry.tag === normalized);
      if (existing) {
        return prev.map(entry =>
          entry.tag === normalized ? { ...entry, status: 'pending', feedback: undefined, reason: reassignReason } : entry
        );
      }
      return [...prev, { tag: normalized, status: 'pending', reason: reassignReason }];
    });

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_DETACH_TAG}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          clientId,
          tag: normalized,
          reason: reassignReason,
          notes: reassignNotes ? `${reassignNotes} - ${new Date().toLocaleString()}` : undefined
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Falha ao liberar tag');
      }

      const data = await response.json();
      setReassignTags(prev =>
        prev.map(entry =>
          entry.tag === normalized
            ? {
                ...entry,
                status: 'success',
                feedback: data?.item?.fullNumber
                  ? `Peça ${data.item.fullNumber} liberada para nova associação.`
                  : 'Tag liberada.'
              }
            : entry
        )
      );
      setReassignFeedback({
        type: 'success',
        message: data?.item?.fullNumber
          ? `Peça ${data.item.fullNumber} aguardando nova tag.`
          : `Tag ${normalized} liberada.`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao liberar tag';
      setReassignTags(prev =>
        prev.map(entry =>
          entry.tag === normalized ? { ...entry, status: 'error', feedback: message } : entry
        )
      );
      setReassignFeedback({ type: 'error', message });
    }
  }, [clientId, reassignNotes, reassignReason]);

  const handleRetireTagScan = useCallback(async (rawValue: string) => {
    const normalized = normalizeTagValue(rawValue);
    if (!normalized) return;

    if (!clientId) {
      setRetireFeedback({ type: 'error', message: 'Configure o cliente do totem antes de baixar peças.' });
      return;
    }
    if (!retireReason) {
      setRetireFeedback({ type: 'error', message: 'Selecione o motivo da baixa antes de iniciar a leitura.' });
      return;
    }

    setRetireTags(prev => {
      const existing = prev.find(entry => entry.tag === normalized);
      if (existing) {
        return prev.map(entry =>
          entry.tag === normalized ? { ...entry, status: 'pending', feedback: undefined, reason: retireReason } : entry
        );
      }
      return [...prev, { tag: normalized, status: 'pending', reason: retireReason }];
    });

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_RETIRE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          clientId,
          tag: normalized,
          reason: retireReason,
          notes: retireNotes ? `${retireNotes} - ${new Date().toLocaleString()}` : undefined,
          releaseTag: true
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Falha ao baixar peça');
      }

      const data = await response.json();
      setRetireTags(prev =>
        prev.map(entry =>
          entry.tag === normalized
            ? {
                ...entry,
                status: 'success',
                feedback: data?.item?.fullNumber
                  ? `Peça ${data.item.fullNumber} baixada.`
                  : 'Baixa registrada.'
              }
            : entry
        )
      );
      setRetireFeedback({
        type: 'success',
        message: data?.item?.fullNumber
          ? `Peça ${data.item.fullNumber} registrada como ${retireReason}.`
          : `Baixa registrada (${retireReason}).`
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao baixar peça';
      setRetireTags(prev =>
        prev.map(entry =>
          entry.tag === normalized ? { ...entry, status: 'error', feedback: message } : entry
        )
      );
      setRetireFeedback({ type: 'error', message });
    }
  }, [clientId, retireNotes, retireReason]);

  useEffect(() => {
    if (cleanTab !== 'association' && readingActive) {
      stopAssociationReading();
    }
    if (cleanTab !== 'nonconformity' && nonconformityReading) {
      stopNonconformityReading();
    }
    if (cleanTab !== 'maintenance' && reassignReading) {
      stopReassignReading();
    }
    if (cleanTab !== 'maintenance' && retireReading) {
      stopRetireReading();
    }
  }, [
    cleanTab,
    nonconformityReading,
    readingActive,
    reassignReading,
    retireReading,
    stopAssociationReading,
    stopNonconformityReading,
    stopReassignReading,
    stopRetireReading
  ]);

  const clearReassignSession = useCallback(() => {
    setReassignTags([]);
    setReassignFeedback(null);
  }, []);

  const clearRetireSession = useCallback(() => {
    setRetireTags([]);
    setRetireFeedback(null);
  }, []);

  useEffect(() => {
    if (!reassignReading) {
      processedReassignTagsRef.current.clear();
      lastProcessedReassignReadingIdRef.current = 0;
      return;
    }
    if (cleanTab === 'maintenance' && settings.rfid.readerModel !== 'chainway-ur4') {
      hiddenReassignInputRef.current?.focus();
    }
  }, [cleanTab, reassignReading, settings.rfid.readerModel]);

  useEffect(() => {
    if (!retireReading) {
      processedRetireTagsRef.current.clear();
      lastProcessedRetireReadingIdRef.current = 0;
      return;
    }
    if (cleanTab === 'maintenance' && settings.rfid.readerModel !== 'chainway-ur4') {
      hiddenRetireInputRef.current?.focus();
    }
  }, [cleanTab, retireReading, settings.rfid.readerModel]);

  useEffect(() => {
    if (
      !isCleanMode ||
      cleanTab !== 'maintenance' ||
      !reassignReading ||
      settings.rfid.readerModel !== 'chainway-ur4' ||
      !rfidReadings.length
    ) {
      return;
    }

    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedReassignReadingIdRef.current);
    if (newReadings.length === 0) return;

    newReadings.forEach(reading => {
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const tag = tid || epc;

      if (tag && !processedReassignTagsRef.current.has(tag)) {
        processedReassignTagsRef.current.add(tag);
        handleReassignTagScan(tag);
        setTimeout(() => processedReassignTagsRef.current.delete(tag), 5000);
      }
    });

    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedReassignReadingIdRef.current = maxId;
  }, [cleanTab, handleReassignTagScan, isCleanMode, reassignReading, rfidReadings, settings.rfid.readerModel]);

  useEffect(() => {
    if (
      !isCleanMode ||
      cleanTab !== 'maintenance' ||
      !retireReading ||
      settings.rfid.readerModel !== 'chainway-ur4' ||
      !rfidReadings.length
    ) {
      return;
    }

    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedRetireReadingIdRef.current);
    if (newReadings.length === 0) return;

    newReadings.forEach(reading => {
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const tag = tid || epc;

      if (tag && !processedRetireTagsRef.current.has(tag)) {
        processedRetireTagsRef.current.add(tag);
        handleRetireTagScan(tag);
        setTimeout(() => processedRetireTagsRef.current.delete(tag), 5000);
      }
    });

    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedRetireReadingIdRef.current = maxId;
  }, [cleanTab, handleRetireTagScan, isCleanMode, retireReading, rfidReadings, settings.rfid.readerModel]);

  const normalizeTagValue = useCallback((value: string) => {
    return value.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '');
  }, []);

  const handleAssociationSubmit = async () => {
    if (!selectedBatch) return;
    if (!clientId) {
      setAssociationFeedback({ type: 'error', message: 'Selecione/configure o cliente do totem antes de associar.' });
      return;
    }
    if (scannedTags.length === 0) {
      setAssociationFeedback({ type: 'error', message: 'Capture ao menos uma tag antes de confirmar.' });
      return;
    }
    if (!selectedBatch.itemId) {
      setAssociationFeedback({ type: 'error', message: 'Lote sem itemId. Atualize a lista e tente novamente.' });
      return;
    }

    setAssociationSubmitting(true);
    setAssociationFeedback(null);

    const payloadTags = scannedTags
      .map(tag => tag.trim().toUpperCase().replace(/\s+/g, ''))
      .filter(tag => tag.length > 0);

    try {
      const endpoint = API_CONFIG.ENDPOINTS.TOTEM.RFID_ASSOCIATE_BATCH(selectedBatch.batchNumber);
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          tags: payloadTags,
          clientId,
          itemId: selectedBatch.itemId
        })
      });

      const rawResponse = await response.text();
      let data: any = null;
      if (rawResponse) {
        try {
          data = JSON.parse(rawResponse);
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        throw new Error(data?.error || rawResponse || `HTTP ${response.status}`);
      }

      const pieces: Array<any> = Array.isArray(data?.pieces) ? data.pieces : [];
      const errors: Array<any> = Array.isArray(data?.errors) ? data.errors : [];

      const successEntries: AssociationResult[] = pieces
        .filter(piece => typeof piece?.rfidTagUid === 'string' && piece.rfidTagUid.length > 0)
        .map(piece => ({
          tag: piece.rfidTagUid,
          status: 'success',
          piece: piece.fullNumber,
          message: piece.item?.name ? `${piece.item.name} (${piece.fullNumber})` : `Peça ${piece.fullNumber}`
        }));

      const errorEntries: AssociationResult[] = errors.map(entry => ({
        tag: typeof entry?.tag === 'string' && entry.tag.length > 0 ? entry.tag : '(sem tag)',
        status: 'error',
        message: entry?.error || 'Erro ao associar tag'
      }));

      const results = [...successEntries, ...errorEntries];
      setAssociationResults(results);

      const successSet = new Set(successEntries.map(entry => entry.tag));
      const remaining = scannedTags.filter(tag => !successSet.has(tag));
      setScannedTags(remaining);

      if (successSet.size > 0 && remaining.length === 0) {
        setReadingActive(false);
      }

      const successCount = successEntries.length;
      const errorCount = errorEntries.length;

      setAssociationFeedback({
        type: errorCount === 0 ? 'success' : successCount > 0 ? 'info' : 'error',
        message:
          errorCount === 0
            ? `${successCount} tag(s) associada(s) ao lote ${selectedBatch.batchNumber}.`
            : `${successCount} tag(s) associada(s) e ${errorCount} falha(s). Verifique a lista para tentar novamente.`
      });

      setSelectedBatch(prev =>
        prev
          ? {
              ...prev,
              associatedTags: Math.min(prev.quantity, (prev.associatedTags ?? 0) + successCount)
            }
          : prev
      );

      await fetchPendingBatches();
    } catch (error) {
      console.error('Erro ao associar tags ao lote:', error);
      setAssociationFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível associar as tags. Verifique a conexão e tente novamente.'
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
    
    const alreadyTracked = expurgoTags.some(entry => entry.tag === normalized);
    // Verificar se a tag já foi processada (evitar duplicatas)
    if (alreadyTracked) {
      console.log(`⚠️ [Expurgo] Tag ${normalized} já foi processada, ignorando...`);
      return;
    }

    // Buscar informações da tag antes de adicionar
    let tagInfo: any = null;
    try {
      const lookupUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_LOOKUP}?tag=${encodeURIComponent(normalized)}`;
      const lookupResponse = await fetch(lookupUrl, {
        headers: {
          'x-api-key': API_CONFIG.API_KEY,
          'Accept': 'application/json'
        }
      });
      
      if (lookupResponse.ok) {
        tagInfo = await lookupResponse.json();
        console.log(`🔍 [Expurgo] Informações da tag ${normalized}:`, tagInfo);
      }
    } catch (error) {
      console.warn(`⚠️ [Expurgo] Não foi possível buscar informações da tag ${normalized}:`, error);
    }

    setExpurgoTags(prev => {
      if (prev.some(entry => entry.tag === normalized)) return prev;
      return [
        ...prev,
        {
          tag: normalized,
          tid: normalizedTid || undefined,
          status: 'pending' as const,
          fullNumber: tagInfo?.fullNumber || tagInfo?.pieceNumber,
          itemName: tagInfo?.linenItemName || tagInfo?.item?.name,
          sku: tagInfo?.item?.sku || tagInfo?.linenItemSku,
          rfidStatus: tagInfo?.status,
          clientName: tagInfo?.clientName || tagInfo?.client?.name,
          batchNumber: tagInfo?.batchNumber,
          pieceNumber: tagInfo?.pieceNumber
        }
      ];
    });

    // Tentar primeiro com a tag fornecida, depois tentar alternativas se falhar
    const tagsToTry = [normalized];
    if (options?.epc && options.epc !== normalized) {
      const altEpc = options.epc.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
      if (altEpc && altEpc !== normalized) tagsToTry.push(altEpc);
    }
    if (options?.tid && options.tid !== normalized) {
      const altTid = options.tid.replace(/\s+/g, '').toUpperCase().replace(/[^0-9A-F]/g, '');
      if (altTid && altTid !== normalized && altTid !== options?.epc) tagsToTry.push(altTid);
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

        const registeredItem = responseData?.rfidItem;
        setExpurgoTags(prev =>
          prev.map(entry =>
            entry.tag === normalized
              ? {
                  ...entry,
                  status: 'success',
                  itemName: registeredItem?.item?.name ?? entry.itemName,
                  feedback: registeredItem?.fullNumber
                    ? `${registeredItem.fullNumber}${
                        registeredItem?.item?.name ? ` • ${registeredItem.item.name}` : ''
                      }`
                    : entry.feedback
                }
              : entry
          )
        );

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
          setExpurgoTags(prev =>
            prev.map(entry =>
              entry.tag === normalized
                ? {
                    ...entry,
                    status: 'error',
                    feedback: lastError?.message || 'Erro ao registrar tag'
                  }
                : entry
            )
          );
        }
      }
    }

    if (!tagRegistered && lastError) {
      console.error(`❌ [Expurgo] Falha ao registrar tag ${normalized} após ${tagsToTry.length} tentativa(s):`, lastError);
      setExpurgoTags(prev =>
        prev.map(entry =>
          entry.tag === normalized
            ? {
                ...entry,
                status: 'error',
                feedback: lastError.message
              }
            : entry
        )
      );
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
            <section className="mb-4">
              <div className="flex flex-wrap gap-3">
                {[
                  { key: 'association' as CleanTab, label: 'Associação' },
                  { key: 'nonconformity' as CleanTab, label: 'Inconformidades' },
                  { key: 'maintenance' as CleanTab, label: 'Manutenção' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setCleanTab(tab.key)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                      cleanTab === tab.key
                        ? 'bg-blue-600 text-white border-blue-700 shadow-lg'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </section>

            {cleanTab === 'association' && (
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
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
                <Card className="w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col border border-gray-200 bg-white">
                  <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        Lote #{selectedBatch.batchNumber}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {selectedBatch.itemName} · {selectedBatch.sku || 'SKU não informado'}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        if (readingActive) stopAssociationReading();
                        setShowAssociationModal(false);
                        setScannedTags([]);
                        setAssociationResults([]);
                        setSelectedBatch(null);
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Fechar
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center shrink-0">
                    <div>
                      <p className="text-xs text-gray-500">Prevista</p>
                      <p className="text-xl font-semibold text-gray-900">{cleanSummary.expected}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Associados</p>
                      <p className="text-xl font-semibold text-blue-600">{cleanSummary.associated}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Agora</p>
                      <p className="text-xl font-semibold text-purple-600">{cleanSummary.newCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-xl font-semibold text-emerald-600">{cleanSummary.totalAfter}</p>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-blue-300 rounded-xl p-3 bg-blue-50/50 shrink-0">
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

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Radio className={readingActive ? 'text-emerald-600 animate-pulse' : 'text-gray-400'} size={28} />
                        <div>
                          <p className="text-base font-semibold text-gray-800">
                            {readingActive ? 'Leitura em andamento' : 'Leitura parada'}
                          </p>
                          <p className="text-xs text-gray-600">
                            {readingActive
                              ? 'Passe cada peça pelo leitor RFID.'
                              : 'Toque em "Iniciar leitura".'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {readingActive ? (
                          <Button onClick={stopAssociationReading} variant="secondary" size="sm" icon={Square}>
                            Parar
                          </Button>
                        ) : (
                          <Button onClick={startAssociationReading} variant="primary" size="sm" icon={Play}>
                            Iniciar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-semibold text-gray-800">
                          Tags capturadas ({scannedTags.length})
                        </h4>
                        {selectedBatch && (
                          <p className="text-xs text-gray-500">
                            Restam {remainingSlots} de {pendingPieces} permitidas
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          setScannedTags([]);
                          setAssociationResults([]);
                          setAssociationFeedback(null);
                        }}
                        variant="secondary"
                        size="sm"
                        disabled={scannedTags.length === 0}
                      >
                        Limpar
                      </Button>
                    </div>
                    <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto p-3 bg-white">
                      {scannedTags.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">
                          Nenhuma tag capturada ainda.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {scannedTags.map(tag => {
                            const tagResult = associationResults.find(result => result.tag === tag);
                            const tagInfo = scannedTagsInfo.get(tag);
                            return (
                              <div
                                key={tag}
                                className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
                              >
                                <div className="flex flex-col flex-1">
                                  <span className="font-mono text-blue-800 font-semibold">{tag}</span>
                                  {tagInfo && (
                                    <div className="mt-1 space-y-0.5">
                                      {tagInfo.linenItemName && (
                                        <p className="text-xs text-gray-600">
                                          Item: {tagInfo.linenItemName}
                                        </p>
                                      )}
                                      {tagInfo.fullNumber && (
                                        <p className="text-xs text-gray-600">
                                          Peça: {tagInfo.fullNumber}
                                        </p>
                                      )}
                                      {tagInfo.clientName && (
                                        <p className="text-xs text-gray-600">
                                          Cliente: {tagInfo.clientName}
                                        </p>
                                      )}
                                      {tagInfo.status && (
                                        <p className={`text-xs font-medium ${
                                          tagInfo.status === 'EM_USO' ? 'text-green-600' :
                                          tagInfo.status === 'DISTRIBUIDO' ? 'text-blue-600' :
                                          tagInfo.status === 'EXPURGO' ? 'text-orange-600' :
                                          'text-gray-600'
                                        }`}>
                                          Status: {tagInfo.status.replace(/_/g, ' ')}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {tagResult?.message && (
                                    <span
                                      className={`text-xs mt-1 ${
                                        tagResult.status === 'error' ? 'text-red-600' : 'text-emerald-600'
                                      }`}
                                    >
                                      {tagResult.message}
                                    </span>
                                  )}
                                </div>
                                <button
                                  className="text-xs text-red-600 hover:text-red-800 ml-2"
                                  onClick={() => removeScannedTag(tag)}
                                >
                                  remover
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {associationResults.length > 0 && (
                    <div className="border border-gray-200 rounded-xl p-3 bg-white space-y-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-semibold text-gray-700">
                          Resultado
                        </h5>
                        <span className="text-xs text-gray-500">
                          {associationResults.filter(r => r.status === 'success').length} OK ·{' '}
                          {associationResults.filter(r => r.status === 'error').length} erro(s)
                        </span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {associationResults.map(result => (
                          <div
                            key={`${result.tag}-${result.status}-${result.message}`}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${
                              result.status === 'success'
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : 'bg-red-50 border-red-100 text-red-700'
                            }`}
                          >
                            <div>
                              <p className="font-mono font-semibold">{result.tag}</p>
                              {result.piece && (
                                <p className="text-xs">
                                  {result.piece}
                                </p>
                              )}
                              {result.message && (
                                <p className="text-xs">
                                  {result.message}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-bold uppercase">
                              {result.status === 'success' ? 'OK' : 'Erro'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {associationFeedback && (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 ${
                        associationFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : associationFeedback.type === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}
                    >
                      <AlertCircle size={16} />
                      <span className="text-xs font-medium">{associationFeedback.message}</span>
                    </div>
                  )}
                  </div>

                  <div className="flex justify-between p-4 border-t shrink-0">
                    <Button
                      onClick={() => {
                        if (readingActive) stopAssociationReading();
                        setShowAssociationModal(false);
                        setScannedTags([]);
                        setAssociationResults([]);
                        setSelectedBatch(null);
                      }}
                      variant="secondary"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAssociationSubmit}
                      variant="primary"
                      size="sm"
                      disabled={associationSubmitting || scannedTags.length === 0}
                    >
                      {associationSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="animate-spin" size={16} />
                          Enviando...
                        </div>
                      ) : (
                        `Associar ${scannedTags.length}`
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
              </>
            )}

            {cleanTab === 'nonconformity' && (
              <section>
                <Card className="p-6 bg-white shadow-lg border border-gray-200 space-y-6">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold text-gray-800">Registro de inconformidades</h2>
                    <p className="text-sm text-gray-600">
                      Leia as peças que precisam voltar para relavagem, manutenção ou ajustes de qualidade. Elas serão encaminhadas automaticamente para o processo correto.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {NONCONFORMITY_OPTIONS.map(option => (
                      <button
                        key={option.key}
                        onClick={() => setNonconformityReason(option.key)}
                        className={`border rounded-2xl p-4 text-left transition-all ${
                          nonconformityReason === option.key
                            ? `${option.tone} shadow-lg`
                            : 'border-gray-200 bg-gray-50 hover:border-blue-200'
                        }`}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="text-xs text-gray-600 mt-1">{option.description}</p>
                      </button>
                    ))}
                  </div>

                  <div className="border-2 border-dashed border-amber-300 rounded-xl p-6 bg-amber-50/50">
                    <input
                      ref={hiddenNonconformityInputRef}
                      type="text"
                      onKeyDown={handleNonconformityKeyDown}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                      aria-hidden="true"
                    />

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <Radio className={nonconformityReading ? 'text-amber-500 animate-pulse' : 'text-gray-400'} size={32} />
                        <div>
                          <p className="text-lg font-semibold text-gray-800">
                            {nonconformityReading ? 'Leitura em andamento' : 'Leitura parada'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {nonconformityReading
                              ? 'Passe as peças com problemas no leitor. Cada leitura será registrada automaticamente.'
                              : 'Escolha o motivo acima e toque em “Iniciar leitura”.'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {nonconformityReading ? (
                          <Button onClick={stopNonconformityReading} variant="secondary" size="sm" icon={Square}>
                            Parar leitura
                          </Button>
                        ) : (
                          <Button onClick={startNonconformityReading} variant="primary" size="sm" icon={Play}>
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
                          Tags processadas ({nonconformityTags.length})
                        </h4>
                        <p className="text-sm text-gray-500">
                          Motivo atual:{' '}
                          {nonconformityReason
                            ? NONCONFORMITY_OPTIONS.find(option => option.key === nonconformityReason)?.label
                            : 'Nenhum motivo selecionado'}
                        </p>
                      </div>
                      <Button
                        onClick={() => {
                          setNonconformityTags([]);
                          setNonconformityFeedback(null);
                        }}
                        variant="secondary"
                        size="sm"
                        disabled={nonconformityTags.length === 0}
                      >
                        Limpar lista
                      </Button>
                    </div>
                    <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto bg-white p-4">
                      {nonconformityTags.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">
                          Nenhuma leitura registrada ainda.
                        </p>
                      ) : (
                        <ul className="space-y-2 text-sm font-mono">
                          {nonconformityTags.map(entry => (
                            <li
                              key={`${entry.tag}-${entry.reason}`}
                              className={`px-3 py-2 rounded-lg border flex items-center justify-between ${
                                entry.status === 'success'
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : entry.status === 'error'
                                  ? 'bg-red-50 border-red-100 text-red-700'
                                  : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{entry.tag}</p>
                                <p className="text-xs">
                                  {NONCONFORMITY_OPTIONS.find(option => option.key === entry.reason)?.label || entry.reason.toUpperCase()}
                                </p>
                                {entry.feedback && <p className="text-xs">{entry.feedback}</p>}
                              </div>
                              <span className="text-xs font-bold uppercase">
                                {entry.status === 'success'
                                  ? 'Registrada'
                                  : entry.status === 'error'
                                  ? 'Erro'
                                  : 'Pendente'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {nonconformityFeedback && (
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        nonconformityFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : 'bg-red-50 border-red-100 text-red-700'
                      }`}
                    >
                      <AlertCircle size={18} />
                      <span className="text-sm font-medium">{nonconformityFeedback.message}</span>
                    </div>
                  )}
                </Card>
              </section>
            )}

            {cleanTab === 'maintenance' && (
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card className="p-6 bg-white shadow-lg border border-gray-200 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">Liberar tags para reassociação</h2>
                      <p className="text-sm text-gray-600">
                        Escolha o motivo, inicie a leitura e aproxime as tags antigas para liberar automaticamente as peças.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={clearReassignSession}
                        variant="secondary"
                        size="sm"
                        disabled={reassignTags.length === 0}
                      >
                        Limpar
                      </Button>
                      {reassignReading ? (
                        <Button onClick={stopReassignReading} variant="secondary" size="sm" icon={Square}>
                          Parar
                        </Button>
                      ) : (
                        <Button onClick={startReassignReading} variant="primary" size="sm" icon={Play}>
                          Iniciar
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase font-semibold text-gray-500">Motivo</label>
                      <select
                        value={reassignReason}
                        onChange={event => setReassignReason(event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                      >
                        {REASSIGN_REASONS.map(reason => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-semibold text-gray-500">Observações (opcional)</label>
                      <input
                        type="text"
                        value={reassignNotes}
                        onChange={event => setReassignNotes(event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        placeholder="Ex.: Tag queimada, peça intacta"
                      />
                    </div>
                  </div>

                  <input
                    ref={hiddenReassignInputRef}
                    type="text"
                    onKeyDown={handleReassignKeyDown}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    aria-hidden="true"
                  />

                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-800">
                      Tags processadas ({reassignTags.length})
                    </h4>
                    <span className="text-sm text-gray-500">
                      {reassignReading ? 'Lendo tags...' : 'Leitura parada'}
                    </span>
                  </div>
                  <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto bg-white p-4">
                    {reassignTags.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Inicie a leitura e aproxime as tags antigas para liberá-las.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm font-mono">
                        {reassignTags.map(entry => {
                          const reasonLabel = REASSIGN_REASONS.find(option => option.value === entry.reason)?.label || entry.reason;
                          return (
                            <li
                              key={entry.tag}
                              className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-4 ${
                                entry.status === 'success'
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : entry.status === 'error'
                                  ? 'bg-red-50 border-red-100 text-red-700'
                                  : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{entry.tag}</p>
                                {reasonLabel && <p className="text-xs text-gray-600">{reasonLabel}</p>}
                                {entry.feedback && <p className="text-xs">{entry.feedback}</p>}
                              </div>
                              <span className="text-xs font-bold uppercase">
                                {entry.status === 'success'
                                  ? 'Liberada'
                                  : entry.status === 'error'
                                  ? 'Erro'
                                  : 'Pendente'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {reassignFeedback && (
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        reassignFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : 'bg-red-50 border-red-100 text-red-700'
                      }`}
                    >
                      <AlertCircle size={18} />
                      <span className="text-sm font-medium">{reassignFeedback.message}</span>
                    </div>
                  )}
                </Card>

                <Card className="p-6 bg-white shadow-lg border border-gray-200 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800">Baixa automatizada</h2>
                      <p className="text-sm text-gray-600">
                        As peças lidas saem imediatamente do estoque e têm suas tags liberadas para reutilização.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={clearRetireSession}
                        variant="secondary"
                        size="sm"
                        disabled={retireTags.length === 0}
                      >
                        Limpar
                      </Button>
                      {retireReading ? (
                        <Button onClick={stopRetireReading} variant="secondary" size="sm" icon={Square}>
                          Parar
                        </Button>
                      ) : (
                        <Button onClick={startRetireReading} variant="primary" size="sm" icon={Play}>
                          Iniciar
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase font-semibold text-gray-500">Motivo</label>
                      <select
                        value={retireReason}
                        onChange={event => setRetireReason(event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-white"
                      >
                        {RETIRE_REASONS.map(reason => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs uppercase font-semibold text-gray-500">Observações (opcional)</label>
                      <input
                        type="text"
                        value={retireNotes}
                        onChange={event => setRetireNotes(event.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        placeholder="Ex.: Peça perdida pelo cliente"
                      />
                    </div>
                  </div>

                  <input
                    ref={hiddenRetireInputRef}
                    type="text"
                    onKeyDown={handleRetireKeyDown}
                    className="absolute w-0 h-0 opacity-0 pointer-events-none"
                    aria-hidden="true"
                  />

                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-gray-800">Peças baixadas ({retireTags.length})</h4>
                    <span className="text-sm text-gray-500">
                      {retireReading ? 'Lendo tags...' : 'Leitura parada'}
                    </span>
                  </div>

                  <div className="border border-gray-200 rounded-xl max-h-64 overflow-y-auto bg-white p-4">
                    {retireTags.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Inicie a leitura e aproxime as tags que serão baixadas.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm font-mono">
                        {retireTags.map(entry => {
                          const reasonLabel = RETIRE_REASONS.find(option => option.value === entry.reason)?.label || entry.reason;
                          return (
                            <li
                              key={`${entry.tag}-${entry.reason}`}
                              className={`px-3 py-2 rounded-lg border flex items-center justify-between gap-4 ${
                                entry.status === 'success'
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : entry.status === 'error'
                                  ? 'bg-red-50 border-red-100 text-red-700'
                                  : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              <div>
                                <p className="font-semibold">{entry.tag}</p>
                                <p className="text-xs text-gray-600">{reasonLabel}</p>
                                {entry.feedback && <p className="text-xs">{entry.feedback}</p>}
                              </div>
                              <span className="text-xs font-bold uppercase">
                                {entry.status === 'success'
                                  ? 'Baixada'
                                  : entry.status === 'error'
                                  ? 'Erro'
                                  : 'Pendente'}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {retireFeedback && (
                    <div
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                        retireFeedback.type === 'success'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                          : 'bg-red-50 border-red-100 text-red-700'
                      }`}
                    >
                      <AlertCircle size={18} />
                      <span className="text-sm font-medium">{retireFeedback.message}</span>
                    </div>
                  )}
                </Card>
              </section>
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
                        const displayTid = entry.tid || entry.tag;
                        const statusLabel =
                          entry.status === 'success' ? 'Registrada' : entry.status === 'error' ? 'Erro' : 'Pendente';
                        const statusColor =
                          entry.status === 'success'
                            ? 'text-emerald-600'
                            : entry.status === 'error'
                            ? 'text-red-600'
                            : 'text-gray-500';
                        return (
                          <li key={`${entry.tag}-${index}`} className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <p className="font-semibold text-gray-800">{displayTid}</p>
                                {entry.itemName && <p className="text-xs text-gray-600 mt-0.5">{entry.itemName}</p>}
                                {entry.fullNumber && (
                                  <p className="text-xs text-gray-500 mt-0.5">Peça: {entry.fullNumber}</p>
                                )}
                                {entry.clientName && (
                                  <p className="text-xs text-gray-500 mt-0.5">Cliente: {entry.clientName}</p>
                                )}
                                {entry.rfidStatus && (
                                  <p className={`text-xs font-medium mt-0.5 ${
                                    entry.rfidStatus === 'EM_USO' ? 'text-green-600' :
                                    entry.rfidStatus === 'DISTRIBUIDO' ? 'text-blue-600' :
                                    entry.rfidStatus === 'EXPURGO' ? 'text-orange-600' :
                                    'text-gray-600'
                                  }`}>
                                    Status: {entry.rfidStatus.replace(/_/g, ' ')}
                                  </p>
                                )}
                                {entry.feedback && <p className="text-xs text-gray-500 mt-0.5">{entry.feedback}</p>}
                              </div>
                              <span className={`text-xs font-semibold uppercase ${statusColor}`}>{statusLabel}</span>
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

