import { useEffect, useRef, useState } from 'react';
import { apiRequest, getApiUrl, getAuthHeaders } from '../config/api';

export type ScaleConnectionMode = 'mock' | 'rs232' | 'usb';

export interface ScaleConfig {
  mode: ScaleConnectionMode;
  // RS232
  port?: string;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 1.5 | 2;
  // USB HID
  vendorId?: number;
  productId?: number;
  // API Integration
  apiBaseUrl?: string;
  clientId?: string;
}

export interface WeighingEntry {
  id: string;
  controlId: string;
  cageId?: string;
  tareWeight: number;
  totalWeight: number;
  netWeight: number;
  createdAt: string;
  cage?: {
    id: string;
    barcode: string;
    tareWeight: number;
    createdAt: string;
  };
}

export interface WeighingControl {
  id: string;
  laundryGrossWeight: number;
  clientTotalNetWeight: number;
  differenceWeight: number;
  differencePercent: number;
  kind: 'suja' | 'limpa';
  referenceDate: string;
  createdAt: string;
  entries?: WeighingEntry[];
}

interface UseScaleReaderResult {
  weight: number;
  isStable: boolean;
  connected: boolean;
  zero: () => void;
  // API de mock para testes até RS232/USB ser implementado
  setExternalWeight: (value: number) => void;
  setConnected: (value: boolean) => void;
  // API Integration
  submitWeighing: (controlId: string, cageId?: string, tareWeight?: number) => Promise<boolean>;
  getCurrentControl: () => Promise<WeighingControl | null>;
  startControl: (kind: 'suja' | 'limpa', grossWeight?: number, expectedDate?: string) => Promise<WeighingControl | null>;
  cages: Array<{ id: string; barcode: string; tareWeight: number; createdAt: string }>;
  loading: boolean;
  error: string | null;
}

export function useScaleReader(config: ScaleConfig = { mode: 'mock' }): UseScaleReaderResult {
  const [weight, setWeight] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(true);
  const [cages, setCages] = useState<Array<{ id: string; barcode: string; tareWeight: number; createdAt: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Detecta estabilidade: sem alteração por 1.2s
  useEffect(() => {
    setIsStable(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (weight > 0) {
      timerRef.current = window.setTimeout(() => setIsStable(true), 1200);
    }
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [weight]);

  // Carregar gaiolas da API
  useEffect(() => {
    if (config.apiBaseUrl) {
      loadCages();
    }
  }, [config.apiBaseUrl]);

  // Placeholder para integração RS232/USB via Tauri
  // Neste momento, operamos em modo mock e por API setExternalWeight
  useEffect(() => {
    if (config.mode !== 'mock') {
      // Integração real será ligada aqui usando comandos/eventos Tauri
      // Mantemos conexão marcada como true até implementação
      setConnected(true);
    }
  }, [config.mode]);

  const loadCages = async () => {
    if (!config.apiBaseUrl) return;
    
    setLoading(true);
    setError(null);
    try {
      // Simular gaiolas por enquanto, padronizando no formato esperado pelo app
      const mockCages: Array<{ id: string; code: string; tare: number; createdAt: Date }> = [
        { id: '1', code: 'GAI-001', tare: 5.0, createdAt: new Date() },
        { id: '2', code: 'GAI-002', tare: 7.5, createdAt: new Date() },
        { id: '3', code: 'GAI-003', tare: 6.2, createdAt: new Date() },
      ];
      const normalized = mockCages.map((c) => ({
        id: c.id,
        barcode: c.code,
        tareWeight: Number(c.tare ?? 0),
        createdAt: c.createdAt.toISOString(),
      }));
      setCages(normalized);
    } catch (err) {
      setError('Erro ao carregar gaiolas');
    } finally {
      setLoading(false);
    }
  };

  const zero = () => {
    setWeight(0);
    setIsStable(false);
  };

  const setExternalWeight = (value: number) => {
    setWeight(Math.max(0, value));
  };

  const submitWeighing = async (controlId: string, cageId?: string, tareWeight?: number): Promise<boolean> => {
    if (!config.apiBaseUrl) return false;
    
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        control_id: controlId,
        peso_total: weight
      };
      
      if (cageId) {
        body.cage_id = cageId;
      } else if (tareWeight !== undefined) {
        body.peso_tara = tareWeight;
      }
      
      await apiRequest('/pesagens', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      setWeight(0);
      setIsStable(false);
      return true;
    } catch (err) {
      setError('Erro ao enviar pesagem');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getCurrentControl = async (): Promise<WeighingControl | null> => {
    if (!config.apiBaseUrl) return null;
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<any>('/controles/current');
      return {
        id: data.id,
        laundryGrossWeight: Number(data.laundryGrossWeight),
        clientTotalNetWeight: Number(data.clientTotalNetWeight),
        differenceWeight: Number(data.differenceWeight),
        differencePercent: Number(data.differencePercent),
        kind: data.kind,
        referenceDate: data.referenceDate,
        createdAt: data.createdAt,
        entries: data.entries || []
      };
    } catch (err) {
      setError('Erro ao carregar controle');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startControl = async (kind: 'suja' | 'limpa', grossWeight?: number, expectedDate?: string): Promise<WeighingControl | null> => {
    if (!config.apiBaseUrl) return null;
    
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        tipo: kind
      };
      
      if (kind === 'limpa' && grossWeight !== undefined) {
        body.peso_bruto_lavanderia = grossWeight;
      }
      
      if (kind === 'suja' && expectedDate) {
        body.prevista = expectedDate;
      }
      
      if (config.clientId) {
        body.clientId = config.clientId;
      }
      
      const data = await apiRequest<any>('/controles', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      
      return {
        id: data.id,
        laundryGrossWeight: Number(data.laundryGrossWeight),
        clientTotalNetWeight: Number(data.clientTotalNetWeight),
        differenceWeight: Number(data.differenceWeight),
        differencePercent: Number(data.differencePercent),
        kind: data.kind,
        referenceDate: data.referenceDate,
        createdAt: data.createdAt,
        entries: []
      };
    } catch (err) {
      setError('Erro ao iniciar controle');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { 
    weight, 
    isStable, 
    connected, 
    zero, 
    setExternalWeight, 
    setConnected,
    submitWeighing,
    getCurrentControl,
    startControl,
    cages,
    loading,
    error
  };
}


