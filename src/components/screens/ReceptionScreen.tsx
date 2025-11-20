import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Radio, Loader2, ListChecks, BarChart2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useSettings } from '../../hooks/useSettings';
import { useClients } from '../../hooks/useClients';
import { useRFIDReader } from '../../hooks/useRFIDReader';
import { API_CONFIG } from '../../config/api';
import { useReception } from '../../hooks/useReception';

interface ReceptionScreenProps {
  onBack: () => void;
}

interface ReceptionEntry {
  tag: string;
  tid?: string;
  linenItemId?: string;
  rfidItemId?: string;
  name: string;
  sku?: string;
  notFound?: boolean;
  fullNumber?: string;
  batchNumber?: number;
  pieceNumber?: number;
  status?: string;
  clientName?: string;
}

type ReceptionTab = 'tags' | 'summary';

export const ReceptionScreen: React.FC<ReceptionScreenProps> = ({ onBack }) => {
  const { settings } = useSettings();
  const { selectedClient } = useClients();
  const {
    status: readerStatus,
    readings: rfidReadings,
    connectToReader,
    startContinuousReading,
    stopContinuousReading
  } = useRFIDReader();

  const [showModal, setShowModal] = useState(false);
  const [rfidEntries, setRfidEntries] = useState<ReceptionEntry[]>([]);
  const [rfidFeedback, setRfidFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rfidReadingActive, setRfidReadingActive] = useState(false);
  const [rfidLookupLoading, setRfidLookupLoading] = useState(false);
  const [rfidSubmitting, setRfidSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<ReceptionTab>('tags');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyEntriesCount, setDailyEntriesCount] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [exporting, setExporting] = useState(false);
  const clientId = selectedClient?.id || settings.totem.clientId;
  const { fetchDailyEntries, registerReception, fetchLaundryExport } = useReception();

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const processedTagsRef = useRef<Set<string>>(new Set());
  const lastProcessedReadingIdRef = useRef<number>(0);

  const totalPieces = rfidEntries.length;
  const validEntries = useMemo(
    () => rfidEntries.filter(entry => entry.rfidItemId && !entry.notFound),
    [rfidEntries]
  );

  const rfidSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        sku?: string;
        quantity: number;
        fullNumber?: string;
        linenItemId?: string;
      }
    >();

    rfidEntries.forEach(entry => {
      const key = entry.linenItemId || entry.name || entry.tag;
      const current = map.get(key);
      map.set(key, {
        key,
        name: entry.name || 'Peça RFID',
        sku: entry.sku,
        fullNumber: entry.fullNumber,
        linenItemId: entry.linenItemId,
        quantity: (current?.quantity || 0) + 1
      });
    });

    return Array.from(map.values());
  }, [rfidEntries]);

  const focusHiddenInput = () => {
    requestAnimationFrame(() => hiddenInputRef.current?.focus());
  };

  const loadDailyEntries = useCallback(async () => {
    if (!clientId) {
      setDailyEntriesCount(0);
      return;
    }
    setLoadingEntries(true);
    try {
      const data = await fetchDailyEntries(clientId, selectedDate);
      const entries = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : data?.items || [];
      const total = typeof data?.total === 'number' ? data.total : entries.length;
      setDailyEntriesCount(total);
    } catch (error) {
      console.error('Erro ao carregar entradas da recepção:', error);
      setDailyEntriesCount(0);
    } finally {
      setLoadingEntries(false);
    }
  }, [clientId, fetchDailyEntries, selectedDate]);

  const startReceptionReading = async () => {
    setRfidFeedback(null);
    setRfidReadingActive(true);
    try {
      if (!readerStatus.isConnected) {
        await connectToReader();
      }
      startContinuousReading();
      focusHiddenInput();
    } catch (error) {
      console.error('Erro ao iniciar leitura RFID:', error);
      setRfidFeedback({
        type: 'error',
        message: 'Não foi possível conectar ao leitor RFID. Verifique o servidor.'
      });
      setRfidReadingActive(false);
    }
  };

  const stopReceptionReading = () => {
    setRfidReadingActive(false);
    stopContinuousReading();
    hiddenInputRef.current?.blur();
  };

  const resetModalState = () => {
    setRfidEntries([]);
    setRfidFeedback(null);
    setActiveTab('tags');
    processedTagsRef.current.clear();
    lastProcessedReadingIdRef.current = 0;
    stopReceptionReading();
  };

  const openModal = () => {
    resetModalState();
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetModalState();
  };

  useEffect(() => {
    if (!showModal) {
      resetModalState();
    }
    if (showModal) {
      loadDailyEntries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, loadDailyEntries]);

  useEffect(() => {
    if (!rfidReadingActive || !rfidReadings.length) return;

    const newReadings = rfidReadings.filter(reading => reading.id > lastProcessedReadingIdRef.current);
    if (newReadings.length === 0) return;

    console.log(`📡 [Recepção] Processando ${newReadings.length} nova(s) leitura(s)`);

    const tagsToAdd: Array<{ tag: string; tid?: string; epc?: string }> = [];

    newReadings.forEach(reading => {
      const tid = reading.tid ? reading.tid.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const epc = reading.epc ? reading.epc.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '') : null;
      const tag = tid || epc;

      if (tag && !processedTagsRef.current.has(tag)) {
        processedTagsRef.current.add(tag);
        tagsToAdd.push({ tag, tid: tid || undefined, epc: epc || undefined });

        setTimeout(() => {
          processedTagsRef.current.delete(tag);
        }, 5000);
      }
    });

    if (tagsToAdd.length > 0) {
      setRfidEntries(prev => {
        const existing = new Set(prev.map(entry => entry.tag));
        const additions = tagsToAdd
          .filter(tag => !existing.has(tag.tag))
          .map(tag => ({
            tag: tag.tag,
            tid: tag.tid,
            name: 'Buscando informações...',
            notFound: false
          }));

        return additions.length ? [...prev, ...additions] : prev;
      });

      tagsToAdd.forEach(tag => lookupRfidTag(tag.tag, { tid: tag.tid, epc: tag.epc }));
    }

    const maxId = Math.max(...newReadings.map(r => r.id));
    lastProcessedReadingIdRef.current = maxId;
  }, [rfidReadings, rfidReadingActive]);

  useEffect(() => {
    if (!rfidReadingActive) {
      processedTagsRef.current.clear();
      lastProcessedReadingIdRef.current = 0;
    }
  }, [rfidReadingActive]);

  const lookupRfidTag = async (rawTag: string, options?: { tid?: string; epc?: string }) => {
    const tag = rawTag.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '');
    if (!tag || !rfidReadingActive) return;

    setRfidLookupLoading(true);
    const tagsToTry = [tag];
    if (options?.epc && options.epc !== tag) tagsToTry.push(options.epc);
    if (options?.tid && options.tid !== tag && options.tid !== options?.epc) tagsToTry.push(options.tid);

    for (const current of tagsToTry) {
      try {
        const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_LOOKUP}`);
        url.searchParams.set('tag', current);

        const response = await fetch(url.toString(), { headers: { 'x-api-key': API_CONFIG.API_KEY } });
        if (!response.ok) {
          if (current !== tagsToTry[tagsToTry.length - 1]) continue;
          const text = await response.text();
          throw new Error(text || `Tag ${current} não encontrada.`);
        }

        const data = await response.json();
        const linenItemId =
          data?.linenItemId ||
          data?.linenItem?.id ||
          data?.rfidItem?.linenItemId ||
          data?.item?.linenItemId ||
          data?.item?.id ||
          data?.itemId ||
          null;

        const rfidItemId =
          data?.id ||
          data?.rfidItem?.id ||
          data?.rfidItemId ||
          data?.piece?.id ||
          null;

        const name =
          data?.linenItemName ||
          data?.linenItem?.name ||
          data?.item?.name ||
          data?.name ||
          'Peça RFID';

        const sku =
          data?.linenItemSku ||
          data?.linenItem?.sku ||
          data?.item?.sku ||
          undefined;

        const fullNumber = data?.fullNumber || data?.pieceNumber || '';
        const batchNumber = data?.batchNumber || 0;
        const pieceNumber = data?.pieceNumber || 0;
        const status = data?.status || 'EM_USO';
        const clientName = data?.clientName || data?.client?.name || '';

        setRfidEntries(prev =>
          prev.map(entry =>
            entry.tag === tag
              ? {
                  ...entry,
                  linenItemId,
                  rfidItemId: rfidItemId || entry.rfidItemId,
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
          )
        );

        break;
      } catch (error) {
        if (current === tagsToTry[tagsToTry.length - 1]) {
          setRfidEntries(prev =>
            prev.map(entry =>
              entry.tag === tag
                ? {
                    ...entry,
                    name: 'Não cadastrada',
                    notFound: true
                  }
                : entry
            )
          );
        }
      }
    }

    setRfidLookupLoading(false);
  };

  const removeEntry = (tag: string) => {
    setRfidEntries(prev => prev.filter(entry => entry.tag !== tag));
  };

  const handleConfirmReception = async () => {
    if (validEntries.length === 0) {
      setRfidFeedback({
        type: 'error',
        message: 'Nenhuma peça RFID válida para registrar.'
      });
      return;
    }

    setRfidSubmitting(true);
    setRfidFeedback(null);

    try {
      const notes = `Recepção RFID - ${selectedClient?.name || 'Cliente'}`;
      await Promise.all(
        validEntries.map(entry =>
          registerReception({
            rfidTagUid: entry.tag,
            rfidItemId: entry.rfidItemId,
            notes
          })
        )
      );

      await loadDailyEntries();
      setRfidFeedback({
        type: 'success',
        message: `✅ ${validEntries.length} peça(s) recebida(s) com sucesso!`
      });

      setTimeout(() => {
        setRfidEntries([]);
        setShowModal(false);
      }, 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao registrar recepção RFID.';
      setRfidFeedback({ type: 'error', message });
    } finally {
      setRfidSubmitting(false);
    }
  };

  const handleExportLaundry = async () => {
    if (!clientId) {
      setRfidFeedback({
        type: 'error',
        message: 'Cliente não configurado para exportação.'
      });
      return;
    }
    setExporting(true);
    try {
      await fetchLaundryExport(clientId);
      setRfidFeedback({
        type: 'success',
        message: '✅ Exportação solicitada com sucesso!'
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao exportar dados.';
      setRfidFeedback({ type: 'error', message });
    } finally {
      setExporting(false);
    }
  };

  const renderTagList = () => (
    <div className="space-y-2 flex-1 overflow-y-auto pr-1">
      {rfidEntries.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-4">
          Nenhuma peça lida. Clique em "Iniciar".
        </div>
      ) : (
        rfidEntries.map(entry => {
          const isWarning = entry.notFound;
          return (
            <div
              key={entry.tag}
              className={`border rounded-lg p-2 flex items-start justify-between gap-2 ${
                isWarning ? 'border-orange-300 bg-orange-50/60' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {entry.name}{' '}
                  {entry.fullNumber && (
                    <span className="text-xs text-gray-500 font-normal">• {entry.fullNumber}</span>
                  )}
                </p>
                <p className="text-xs font-mono text-gray-500 truncate">{entry.tag}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isWarning ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {isWarning ? '✕' : '✓'}
                </span>
                <button
                  onClick={() => removeEntry(entry.tag)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const renderSummary = () => (
    <div className="flex-1 overflow-y-auto">
      {rfidSummary.length === 0 ? (
        <div className="text-xs text-gray-500 text-center py-4">
          Nenhuma peça agrupada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {rfidSummary.map(summary => (
            <div key={summary.key} className="border border-gray-200 rounded-lg p-2 bg-white flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{summary.name}</p>
                {summary.sku && <p className="text-xs text-gray-500 truncate">SKU {summary.sku}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-blue-600">{summary.quantity}</p>
                <p className="text-xs text-gray-500">peça(s)</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur border-b border-white/20 sticky top-0 z-10">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="secondary" size="sm" icon={ArrowLeft}>
              Voltar
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Recepção RFID</h1>
              <p className="text-gray-600">Registrar peças retornadas da lavanderia com leitura automática</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${readerStatus.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
              {readerStatus.isConnected ? 'Leitor conectado' : 'Leitor desconectado'}
            </span>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <Card className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Fluxo RFID</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-2">Receber peças da lavanderia</h2>
            <p className="text-gray-600 mt-1">
              Utilize o leitor UR4 para capturar automaticamente as peças que retornaram. Você pode revisar as tags lidas e o resumo antes de confirmar.
            </p>
          </div>
          <Button size="lg" icon={Radio} onClick={openModal}>
            Abrir leitura
          </Button>
        </Card>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-3 sm:px-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col">
            <div className="p-3 border-b flex items-center justify-between gap-2 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Recepção RFID</h3>
                <p className="text-xs text-gray-500">
                  {selectedClient?.name || 'Não configurado'} • {totalPieces} lida(s)
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={closeModal}>
                Fechar
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-1 text-xs shrink-0">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    readerStatus.isConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {readerStatus.isConnected ? '✓ Conectado' : '✕ Desconectado'}
                </span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    rfidReadingActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {rfidReadingActive ? 'Lendo...' : 'Parado'}
                </span>
                <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {validEntries.length} pronta(s)
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  {!rfidReadingActive ? (
                    <Button onClick={startReceptionReading} icon={Radio} size="sm">
                      Iniciar
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={stopReceptionReading} size="sm">
                      Parar
                    </Button>
                  )}
                  {rfidLookupLoading && (
                    <div className="flex items-center gap-1 text-xs text-purple-600">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Consultando...
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <label className="font-semibold">Data:</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="px-2 py-1 border rounded-lg text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadDailyEntries}
                    disabled={loadingEntries}
                  >
                    {loadingEntries ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                  <span className="text-xs text-gray-500">
                    Entradas: <strong>{dailyEntriesCount}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleExportLaundry}
                    disabled={exporting || !clientId}
                  >
                    {exporting ? 'Exportando...' : 'Exportar expurgo'}
                  </Button>
                </div>
              </div>

              <input
                ref={hiddenInputRef}
                type="text"
                className="absolute w-0 h-0 opacity-0 pointer-events-none"
                aria-hidden="true"
                onFocus={() => rfidReadingActive && focusHiddenInput()}
              />

              <div className="flex gap-2 border rounded-xl p-1 bg-gray-50 shrink-0">
                <button
                  onClick={() => setActiveTab('tags')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'tags' ? 'bg-white shadow text-blue-700' : 'text-gray-500'
                  }`}
                >
                  <ListChecks size={14} />
                  Tags
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'summary' ? 'bg-white shadow text-blue-700' : 'text-gray-500'
                  }`}
                >
                  <BarChart2 size={14} />
                  Resumo
                </button>
              </div>

              {activeTab === 'tags' ? renderTagList() : renderSummary()}

              {rfidFeedback && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs shrink-0 ${
                    rfidFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      : 'bg-red-50 text-red-700 border border-red-100'
                  }`}
                >
                  {rfidFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                  <span>{rfidFeedback.message}</span>
                </div>
              )}
            </div>

            <div className="p-3 border-t flex items-center justify-between gap-2 shrink-0">
              <div className="text-xs text-gray-500">
                {validEntries.length} pronta(s)
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setRfidEntries([])} disabled={rfidSubmitting}>
                  Limpar
                </Button>
                <Button variant="secondary" size="sm" onClick={closeModal} disabled={rfidSubmitting}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmReception}
                  disabled={validEntries.length === 0 || rfidSubmitting}
                >
                  {rfidSubmitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      Registrando...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

