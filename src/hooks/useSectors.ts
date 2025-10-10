import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG } from '../config/api';

export interface Sector {
  id: string;
  name: string;
  description?: string;
  clientId?: string;
  createdAt: string;
}

interface UseSectorsConfig {
  clientId?: string;
  autoLoad?: boolean;
}

export function useSectors(config: UseSectorsConfig = {}) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSectors = useCallback(async () => {
    if (!config.clientId) {
      setSectors([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (config.clientId) {
        params.append('clientId', config.clientId);
      }
      params.append('pageSize', '200');

      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SECTORS}?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'x-api-key': API_CONFIG.API_KEY
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSectors(data.data || data || []);
    } catch (err) {
      console.error('Error fetching sectors:', err);
      setError('Erro ao carregar setores');
      setSectors([]);
    } finally {
      setLoading(false);
    }
  }, [config.clientId]);

  useEffect(() => {
    if (config.autoLoad !== false) {
      fetchSectors();
    }
  }, [fetchSectors, config.autoLoad]);

  return {
    sectors,
    loading,
    error,
    refetch: fetchSectors
  };
}

