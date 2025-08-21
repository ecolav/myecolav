import { useEffect, useRef, useState } from 'react';

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
}

interface UseScaleReaderResult {
  weight: number;
  isStable: boolean;
  connected: boolean;
  zero: () => void;
  // API de mock para testes até RS232/USB ser implementado
  setExternalWeight: (value: number) => void;
  setConnected: (value: boolean) => void;
}

export function useScaleReader(config: ScaleConfig = { mode: 'mock' }): UseScaleReaderResult {
  const [weight, setWeight] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(true);
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

  // Placeholder para integração RS232/USB via Tauri
  // Neste momento, operamos em modo mock e por API setExternalWeight
  useEffect(() => {
    if (config.mode !== 'mock') {
      // Integração real será ligada aqui usando comandos/eventos Tauri
      // Mantemos conexão marcada como true até implementação
      setConnected(true);
    }
  }, [config.mode]);

  const zero = () => {
    setWeight(0);
    setIsStable(false);
  };

  const setExternalWeight = (value: number) => {
    setWeight(Math.max(0, value));
  };

  return { weight, isStable, connected, zero, setExternalWeight, setConnected };
}


