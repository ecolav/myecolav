import { useState, useCallback } from 'react';
import { API_CONFIG } from '../config/api';

export interface RfidItemInfo {
  id: string;
  rfidTagUid: string | null;
  fullNumber: string;
  batchNumber: number;
  pieceNumber: number;
  status: string;
  isActive: boolean;
  lastReadAt: string | null;
  readCount: number;
  item: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    currentStock: number;
  };
  client: {
    id: string;
    name: string;
  };
  sector?: {
    id: string;
    name: string;
  } | null;
}

interface UseRfidItemResult {
  itemInfo: RfidItemInfo | null;
  loading: boolean;
  error: string | null;
  lookupTag: (tag: string) => Promise<RfidItemInfo | null>;
  clearError: () => void;
}

export function useRfidItem(): UseRfidItemResult {
  const [itemInfo, setItemInfo] = useState<RfidItemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupTag = useCallback(async (tag: string): Promise<RfidItemInfo | null> => {
    if (!tag || !tag.trim()) {
      setError('Tag inválida');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedTag = tag.trim().toUpperCase().replace(/\s+/g, '').replace(/[^0-9A-F]/g, '');
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_LOOKUP}?tag=${encodeURIComponent(normalizedTag)}`;
      
      const response = await fetch(url, {
        headers: {
          'x-api-key': API_CONFIG.API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Tag não encontrada ou não associada');
          setItemInfo(null);
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Mapear resposta para estrutura padrão
      const info: RfidItemInfo = {
        id: data.id || data.rfidItem?.id || '',
        rfidTagUid: data.rfidTagUid || data.tag || normalizedTag,
        fullNumber: data.fullNumber || data.pieceNumber || '',
        batchNumber: data.batchNumber || 0,
        pieceNumber: data.pieceNumber || 0,
        status: data.status || 'unknown',
        isActive: data.isActive ?? true,
        lastReadAt: data.lastReadAt || null,
        readCount: data.readCount || 0,
        item: {
          id: data.linenItemId || data.item?.id || data.linenItem?.id || '',
          name: data.linenItemName || data.item?.name || data.linenItem?.name || 'Item desconhecido',
          sku: data.linenItemSku || data.item?.sku || data.linenItem?.sku || '',
          unit: data.item?.unit || data.linenItem?.unit || 'unidade',
          currentStock: data.item?.currentStock || data.linenItem?.currentStock || 0
        },
        client: {
          id: data.clientId || data.client?.id || '',
          name: data.clientName || data.client?.name || ''
        },
        sector: data.sector ? {
          id: data.sector.id || data.sectorId || '',
          name: data.sector.name || data.sectorName || ''
        } : null
      };

      setItemInfo(info);
      return info;
    } catch (err) {
      console.error('Erro ao buscar tag RFID:', err);
      setError('Erro ao consultar tag no servidor');
      setItemInfo(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    itemInfo,
    loading,
    error,
    lookupTag,
    clearError
  };
}

