import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../config/api';

export interface Client {
  id: string;
  name: string;
  code?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UseClientsResult {
  clients: Client[];
  loading: boolean;
  error: string | null;
  fetchClients: () => Promise<void>;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
}

export function useClients(): UseClientsResult {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRequest<{data: Client[]}>('/api/public/clients');
      setClients(response.data);
    } catch (err) {
      setError('Erro ao carregar clientes');
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar cliente selecionado do localStorage
  useEffect(() => {
    const savedClient = localStorage.getItem('selectedClient');
    if (savedClient) {
      try {
        setSelectedClient(JSON.parse(savedClient));
      } catch (err) {
        console.error('Erro ao carregar cliente selecionado:', err);
      }
    }
  }, []);

  // Salvar cliente selecionado no localStorage
  useEffect(() => {
    if (selectedClient) {
      localStorage.setItem('selectedClient', JSON.stringify(selectedClient));
    } else {
      localStorage.removeItem('selectedClient');
    }
  }, [selectedClient]);

  // Carregar clientes na inicialização
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    fetchClients,
    selectedClient,
    setSelectedClient
  };
}
