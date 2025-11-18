import { useCallback } from 'react';
import { API_CONFIG } from '../config/api';

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
  'x-api-key': API_CONFIG.API_KEY
};

export function useReception() {
  const fetchDailyEntries = useCallback(async (clientId?: string, date?: string) => {
    const params = new URLSearchParams();
    if (clientId) params.set('clientId', clientId);
    if (date) params.set('date', date);
    const query = params.toString();
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.STOCK_MOVEMENTS}${query ? `?${query}` : ''}`;

    const res = await fetch(url, { headers: defaultHeaders });
    if (!res.ok) {
      throw new Error(`Falha ao carregar entradas (${res.status})`);
    }
    return res.json();
  }, []);

  const registerReception = useCallback(async (payload: {
    rfidTagUid?: string;
    rfidItemId?: string;
    sectorId?: string;
    readerId?: string;
    notes?: string;
  }) => {
    const res = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.RFID_RECEPTION}`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na recepção: ${errText || res.status}`);
    }

    return res.json();
  }, []);

  const fetchLaundryExport = useCallback(async (clientId?: string) => {
    const params = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.LAUNDRY_EXPORT}${params}`;
    const res = await fetch(url, { headers: defaultHeaders });
    if (!res.ok) {
      throw new Error(`Falha ao carregar export (${res.status})`);
    }
    return res.json();
  }, []);

  return {
    fetchDailyEntries,
    registerReception,
    fetchLaundryExport
  };
}

