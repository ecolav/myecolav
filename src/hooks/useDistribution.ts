import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../config/api';

export interface DistributedItem {
  id: string;
  linenItemId: string;
  bedId: string;
  allocatedAt: string;
  status: 'allocated' | 'pendingCollection' | 'collected';
  orderId?: string;
  clientId?: string;
  linenItem?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    currentStock: number;
    minimumStock: number;
    createdAt: string;
  };
  bed?: {
    id: string;
    number: string;
    sectorId: string;
    status: 'free' | 'occupied';
    token: string;
    sector?: {
      id: string;
      name: string;
      description?: string;
      createdAt: string;
      clientId?: string;
    };
  };
  distributedByName?: string;
}

export interface DistributionConfig {
  apiBaseUrl?: string;
  clientId?: string;
}

interface UseDistributionResult {
  distributedItems: DistributedItem[];
  loading: boolean;
  error: string | null;
  updateItemStatus: (id: string, status: DistributedItem['status']) => Promise<boolean>;
  collectAllFromBed: (bedId: string) => Promise<boolean>;
  addDistribution: (linenItemId: string, bedId: string, orderId?: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
}

export function useDistribution(config: DistributionConfig = {}): UseDistributionResult {
  const [distributedItems, setDistributedItems] = useState<DistributedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDistributedItems = useCallback(async () => {
    if (!config.apiBaseUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      let endpoint = '/distributed-items';
      if (config.clientId) {
        endpoint += `?clientId=${config.clientId}`;
      }
      
      const data = await apiRequest<DistributedItem[]>(endpoint);
      setDistributedItems(data);
    } catch (err) {
      setError('Erro ao carregar itens distribuídos');
    } finally {
      setLoading(false);
    }
  }, [config.apiBaseUrl, config.clientId]);

  const updateItemStatus = async (id: string, status: DistributedItem['status']): Promise<boolean> => {
    if (!config.apiBaseUrl) return false;
    
    setLoading(true);
    setError(null);
    try {
      await apiRequest(`/distributed-items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      
      await fetchDistributedItems();
      return true;
    } catch (err) {
      setError('Erro ao atualizar status do item');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const collectAllFromBed = async (bedId: string): Promise<boolean> => {
    if (!config.apiBaseUrl) return false;
    
    const bedItems = distributedItems.filter(item => 
      item.bedId === bedId && item.status !== 'collected'
    );
    
    if (bedItems.length === 0) return true;
    
    setLoading(true);
    setError(null);
    try {
      const promises = bedItems.map(item => 
        apiRequest(`/distributed-items/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'collected' })
        })
      );
      
      await Promise.all(promises);
      await fetchDistributedItems();
      return true;
    } catch (err) {
      setError('Erro ao coletar alguns itens');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addDistribution = async (linenItemId: string, bedId: string, orderId?: string): Promise<boolean> => {
    if (!config.apiBaseUrl) return false;
    
    setLoading(true);
    setError(null);
    try {
      await apiRequest('/distributed-items', {
        method: 'POST',
        body: JSON.stringify({
          linenItemId,
          bedId,
          orderId,
          status: 'allocated'
        })
      });
      
      await fetchDistributedItems();
      return true;
    } catch (err) {
      setError('Erro ao adicionar distribuição');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refreshData = useCallback(async () => {
    await fetchDistributedItems();
  }, [fetchDistributedItems]);

  useEffect(() => {
    if (config.apiBaseUrl) {
      fetchDistributedItems();
    }
  }, [fetchDistributedItems]);

  return {
    distributedItems,
    loading,
    error,
    updateItemStatus,
    collectAllFromBed,
    addDistribution,
    refreshData
  };
}
