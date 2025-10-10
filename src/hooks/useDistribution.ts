import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../config/api';

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
    // Endpoint /distributed-items não está exposto publicamente
    // Por enquanto apenas mantém lista vazia
    setDistributedItems([]);
  }, []);

  const updateItemStatus = async (id: string, status: DistributedItem['status']): Promise<boolean> => {
    // Endpoint não disponível publicamente
    console.log('updateItemStatus:', id, status);
    return true;
  };

  const collectAllFromBed = async (bedId: string): Promise<boolean> => {
    // Endpoint não disponível publicamente
    console.log('collectAllFromBed:', bedId);
    return true;
  };

  const addDistribution = async (linenItemId: string, bedId: string, orderId?: string): Promise<boolean> => {
    // Endpoint não disponível publicamente
    console.log('addDistribution:', linenItemId, bedId, orderId);
    return true;
  };

  const refreshData = useCallback(async () => {
    await fetchDistributedItems();
  }, [fetchDistributedItems]);

  // Endpoint /distributed-items não está disponível publicamente
  // useEffect(() => {
  //   fetchDistributedItems();
  // }, [fetchDistributedItems]);

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
