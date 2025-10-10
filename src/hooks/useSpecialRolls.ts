import { useState, useEffect, useCallback } from 'react';
import { API_CONFIG, apiRequest } from '../config/api';
import { SpecialRoll, SpecialRollEvent } from '../types';

export interface SpecialRollsConfig {
  apiBaseUrl?: string;
  clientId?: string;
}

interface UseSpecialRollsResult {
  rolls: SpecialRoll[];
  loading: boolean;
  error: string | null;
  createRoll: (data: Partial<SpecialRoll>) => Promise<SpecialRoll | null>;
  updateRoll: (id: string, data: Partial<SpecialRoll>) => Promise<boolean>;
  deleteRoll: (id: string) => Promise<boolean>;
  addEvent: (rollId: string, event: Omit<SpecialRollEvent, 'id' | 'rollId' | 'timestamp'>) => Promise<boolean>;
  refreshData: () => Promise<void>;
  getByStatus: (status: string) => SpecialRoll[];
  getOverdue: () => SpecialRoll[];
  getByPriority: (priority: number) => SpecialRoll[];
}

export function useSpecialRolls(config: SpecialRollsConfig = {}): UseSpecialRollsResult {
  const [rolls, setRolls] = useState<SpecialRoll[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (config.clientId) {
        params.append('clientId', config.clientId);
      }
      
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SPECIAL_ROLLS}${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: { 'x-api-key': API_CONFIG.API_KEY }
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      
      setRolls(Array.isArray(data) ? data : (data.data || []));
    } catch (err) {
      console.error('Error fetching special rolls:', err);
      setError('Erro ao carregar rolos especiais');
    } finally {
      setLoading(false);
    }
  }, [config.clientId]);

  const createRoll = async (data: Partial<SpecialRoll>): Promise<SpecialRoll | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SPECIAL_ROLLS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          ...data,
          clientId: data.clientId || config.clientId
        })
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const newRoll = await response.json();
      
      await fetchRolls();
      return newRoll;
    } catch (err) {
      console.error('Error creating roll:', err);
      setError('Erro ao criar rolo especial');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateRoll = async (id: string, data: Partial<SpecialRoll>): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SPECIAL_ROLLS}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      await fetchRolls();
      return true;
    } catch (err) {
      console.error('Error updating roll:', err);
      setError('Erro ao atualizar rolo especial');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteRoll = async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SPECIAL_ROLLS}/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': API_CONFIG.API_KEY }
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      await fetchRolls();
      return true;
    } catch (err) {
      console.error('Error deleting roll:', err);
      setError('Erro ao excluir rolo especial');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addEvent = async (
    rollId: string, 
    event: Omit<SpecialRollEvent, 'id' | 'rollId' | 'timestamp'>
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SPECIAL_ROLLS}/${rollId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify(event)
      });
      
      if (!response.ok) throw new Error('HTTP ' + response.status);
      
      await fetchRolls();
      return true;
    } catch (err) {
      console.error('Error adding event:', err);
      setError('Erro ao adicionar evento');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Removido: uploadPhoto - não necessário para totem

  const refreshData = useCallback(async () => {
    await fetchRolls();
  }, [fetchRolls]);

  const getByStatus = (status: string): SpecialRoll[] => {
    return rolls.filter(roll => roll.status === status);
  };

  const getOverdue = (): SpecialRoll[] => {
    const now = new Date();
    return rolls.filter(roll => {
      if (!roll.expectedReturnAt) return false;
      return new Date(roll.expectedReturnAt) < now && roll.status !== 'returned';
    });
  };

  const getByPriority = (priority: number): SpecialRoll[] => {
    return rolls.filter(roll => roll.priority === priority);
  };

  useEffect(() => {
    if (baseUrl) {
      fetchRolls();
    }
  }, [fetchRolls, baseUrl]);

  return {
    rolls,
    loading,
    error,
    createRoll,
    updateRoll,
    deleteRoll,
    addEvent,
    refreshData,
    getByStatus,
    getOverdue,
    getByPriority
  };
}

