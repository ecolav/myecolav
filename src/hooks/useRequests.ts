import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../config/api';

export interface OrderItem {
  itemId: string;
  quantity: number;
  item?: {
    id: string;
    name: string;
    sku: string;
    currentStock: number;
  };
}

export interface Order {
  id: string;
  bedId: string;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
  items: OrderItem[];
  observations?: string;
  scheduledDelivery?: string;
  createdAt: string;
  updatedAt: string;
  bed?: {
    id: string;
    number: string;
    sectorId: string;
    sector?: {
      id: string;
      name: string;
    };
  };
}

export interface RequestsConfig {
  apiBaseUrl?: string;
  clientId?: string;
}

interface UseRequestsResult {
  orders: Order[];
  loading: boolean;
  error: string | null;
  createRequest: (bedId: string, items: Array<{ itemId: string; quantity: number }>, observations?: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  getPendingOrders: () => Order[];
}

export function useRequests(config: RequestsConfig = {}): UseRequestsResult {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = config.apiBaseUrl || API_CONFIG.BASE_URL;

  const fetchOrders = useCallback(async () => {
    // Endpoint /api/public/orders não existe no backend
    // Apenas mantém estado local por enquanto
    setOrders([]);
  }, []);

  const createRequest = async (
    bedId: string,
    items: Array<{ itemId: string; quantity: number }>,
    observations?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.ORDERS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          bedId,
          items,
          observations,
          status: 'pending'
        })
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      // Adicionar à lista local
      const newOrder = await response.json();
      setOrders(prev => [...prev, newOrder]);
      return true;
    } catch (err) {
      console.error('Error creating request:', err);
      setError('Erro ao criar solicitação');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refreshData = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  const getPendingOrders = (): Order[] => {
    return orders.filter(order => order.status === 'pending' || order.status === 'preparing');
  };

  // Não carregar orders automaticamente (endpoint não existe)
  // useEffect(() => {
  //   fetchOrders();
  // }, [fetchOrders]);

  return {
    orders,
    loading,
    error,
    createRequest,
    refreshData,
    getPendingOrders
  };
}


