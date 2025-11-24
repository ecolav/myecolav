import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { API_CONFIG } from '../config/api';

export interface RfidItem {
  id: string;
  tag: string;
  tid?: string;
  linen_item_id?: string;
  linen_item_name?: string;
  linen_item_sku?: string;
  full_number?: string;
  batch_number?: number;
  piece_number?: number;
  status?: string;
  client_id?: string;
  client_name?: string;
  updated_at: number;
}

export interface LookupResult {
  data: RfidItem | null;
  source: 'local' | 'api' | 'none' | 'error';
  cached: boolean;
}

export interface OfflineStats {
  rfid_items_cached: number;
  pending_operations: number;
  last_sync_timestamp: number;
}

export function useOfflineRFID() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [stats, setStats] = useState<OfflineStats | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Carregar estatísticas iniciais
    loadStats();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const dbStats = await invoke<OfflineStats>('get_db_stats');
      setStats(dbStats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas do DB:', error);
    }
  }, []);

  const lookupTag = useCallback(async (tag: string): Promise<LookupResult> => {
    const normalizedTag = tag.trim().toUpperCase().replace(/\s+/g, '');
    
    try {
      // 1. SEMPRE tenta buscar no cache local primeiro (instantâneo)
      console.log('🔍 Buscando tag no cache local:', normalizedTag);
      const localResult = await invoke<RfidItem | null>('lookup_rfid_local', { tag: normalizedTag });
      
      if (localResult) {
        console.log('✅ Tag encontrada no cache local:', localResult);
        await loadStats(); // Atualiza stats
        return { data: localResult, source: 'local', cached: true };
      }
      
      // 2. Se não encontrou localmente e está online, tenta API
      if (isOnline) {
        console.log('⚠️ Tag não encontrada localmente, consultando API...');
        try {
          const url = new URL(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_LOOKUP}`);
          url.searchParams.set('tag', normalizedTag);
          
          const response = await fetch(url.toString(), {
            headers: { 'x-api-key': API_CONFIG.API_KEY },
            signal: AbortSignal.timeout(5000), // Timeout de 5s
          });
          
          if (response.ok) {
            const apiData = await response.json();
            
            // Mapear resposta da API para formato do DB
            const rfidItem: RfidItem = {
              id: apiData.id || apiData.rfidItem?.id || apiData.rfidItemId || '',
              tag: normalizedTag,
              tid: apiData.tid || null,
              linen_item_id: apiData.linenItemId || apiData.linenItem?.id || apiData.item?.id || null,
              linen_item_name: apiData.linenItemName || apiData.linenItem?.name || apiData.item?.name || null,
              linen_item_sku: apiData.linenItemSku || apiData.linenItem?.sku || apiData.item?.sku || null,
              full_number: apiData.fullNumber || apiData.pieceNumber || null,
              batch_number: apiData.batchNumber || null,
              piece_number: apiData.pieceNumber || null,
              status: apiData.status || 'EM_USO',
              client_id: apiData.clientId || apiData.client?.id || null,
              client_name: apiData.clientName || apiData.client?.name || null,
              updated_at: Date.now(),
            };
            
            // Salva no cache para próximas consultas
            if (rfidItem.id) {
              console.log('💾 Salvando tag no cache local:', rfidItem);
              await invoke('cache_rfid_item', { item: rfidItem });
              await loadStats();
            }
            
            return { data: rfidItem, source: 'api', cached: false };
          }
        } catch (apiError) {
          console.error('❌ Erro ao consultar API:', apiError);
        }
      } else {
        console.log('📵 Offline - não foi possível consultar API');
      }
      
      return { data: null, source: 'none', cached: false };
    } catch (error) {
      console.error('❌ Erro no lookup:', error);
      return { data: null, source: 'error', cached: false };
    }
  }, [isOnline, loadStats]);

  const queueOperation = useCallback(async (
    operationType: string,
    payload: Record<string, any>
  ): Promise<{ success: boolean; queued: boolean; operationId?: number }> => {
    try {
      const payloadStr = JSON.stringify(payload);
      const operationId = await invoke<number>('queue_operation', {
        operationType,
        payload: payloadStr,
      });
      
      console.log(`📋 Operação ${operationType} enfileirada (ID: ${operationId})`);
      await loadStats();
      
      return { success: true, queued: true, operationId };
    } catch (error) {
      console.error('❌ Erro ao enfileirar operação:', error);
      return { success: false, queued: false };
    }
  }, [loadStats]);

  const getPendingCount = useCallback(async (): Promise<number> => {
    try {
      const count = await invoke<number>('get_pending_count');
      return count;
    } catch (error) {
      console.error('Erro ao buscar contagem de operações pendentes:', error);
      return 0;
    }
  }, []);

  return {
    lookupTag,
    queueOperation,
    getPendingCount,
    loadStats,
    stats,
    isOnline,
  };
}

