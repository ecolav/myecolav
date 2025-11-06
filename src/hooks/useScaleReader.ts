import { useEffect, useRef, useState } from 'react';
import { apiRequest, API_CONFIG } from '../config/api';
import { getDriverByLabel } from '../utils/scaleDrivers';

// Importar comandos Tauri se disponível
const invoke = typeof window !== 'undefined' && (window as any).__TAURI__?.invoke;

export type ScaleConnectionMode = 'mock' | 'rs232' | 'usb' | 'tcpip';

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
  modelLabel?: string;
  // TCP/IP Network
  host?: string; // IP ou hostname da balança
  tcpPort?: number; // porta TCP da balança
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
  submitWeighing: (controlId: string, options?: { cageId?: string; tareWeight?: number; totalWeight?: number }) => Promise<boolean>;
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
  const serialReaderAbort = useRef<() => Promise<void> | void>();
  const serialClose = useRef<() => Promise<void> | void>();
  const tcpSocketRef = useRef<WebSocket | null>(null);

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

  // Carregar gaiolas da API (usa BASE_URL global)
  useEffect(() => {
    loadCages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leitura contínua (driver ou Web Serial quando RS232 disponível)
  useEffect(() => {
    let alive = true;
    let interval: number | null = null;
    const driver = getDriverByLabel(config.modelLabel);
    if (driver) setConnected(true);
    else if (config.mode !== 'mock') setConnected(true);

    const poll = async () => {
      if (!alive) return;
      try {
        if (driver) {
          const r = await driver.test({ ...config });
          // Extrair número do RAW - suporte ao formato H/L (ex: H0000.15)
          const hlMatch = r.raw.match(/^[HL]([0-9]+(?:\.[0-9]+)?)/i);
          if (hlMatch) {
            setWeight(Math.max(0, Number(hlMatch[1])));
          } else {
            // Fallback para formato genérico
            const m = r.raw.match(/([0-9]+(?:\.[0-9]+)?)/);
            const val = m ? Number(m[1]) : Number((Math.random()*0.2).toFixed(2));
            setWeight(Math.max(0, val));
          }
        } else if (config.mode === 'rs232') {
          // Usar servidor HTTP local para ler a balança
          try {
            const response = await fetch('http://localhost:3001/scale/weight');
            if (response.ok) {
              const data = await response.json();
              setWeight(Math.max(0, data.weight));
              setConnected(data.connected);
            } else {
              setConnected(false);
            }
          } catch (error) {
            // Servidor não está rodando
            if (!serialReaderAbort.current) {
              console.warn('⚠️  Servidor de balança não encontrado. Execute: node scale-server.js');
              serialReaderAbort.current = () => {}; // Evitar spam de logs
            }
            setConnected(false);
          }
        } else if (config.mode === 'rs232' && (navigator as any)?.serial?.getPorts) {
          // Usar Web Serial se houver porta autorizada
          if (serialReaderAbort.current || serialClose.current) return; // já conectado
          try {
            const ports: any[] = await (navigator as any).serial.getPorts();
            if (!ports || ports.length === 0) {
              setConnected(false);
              return;
            }
            const port = ports[0];
            await port.open({ baudRate: config.baudRate || 9600, dataBits: config.dataBits || 8, parity: config.parity || 'none', stopBits: (config.stopBits as any) || 1 });
            setConnected(true);
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = port.readable.pipeTo(textDecoder.writable).catch(() => {});
            const reader = textDecoder.readable.getReader();
            let buffer = '';
            const abort = async () => {
              try { await reader.cancel(); } catch {}
              try { await readableStreamClosed; } catch {}
            };
            const close = async () => {
              try { await port.close(); } catch {}
            };
            serialReaderAbort.current = abort;
            serialClose.current = close;
            (async () => {
              try {
                while (alive) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  if (value) {
                    buffer += value;
                    let idx;
                    while ((idx = buffer.indexOf('\n')) >= 0) {
                      const line = buffer.slice(0, idx).trim();
                      buffer = buffer.slice(idx + 1);
                      // Suporte ao formato H/L (ex: H0000.15 ou L0000.10)
                      const hlMatch = line.match(/^[HL]([0-9]+(?:\.[0-9]+)?)/i);
                      if (hlMatch) {
                        setWeight(Math.max(0, Number(hlMatch[1])));
                      } else {
                        // Fallback para formato genérico
                        const mm = line.match(/([0-9]+(?:\.[0-9]+)?)/);
                        if (mm) setWeight(Math.max(0, Number(mm[1])));
                      }
                    }
                  }
                }
              } catch {
              } finally {
                setConnected(false);
              }
            })();
          } catch {
            setConnected(false);
          }
        } else if (config.mode === 'tcpip') {
          // Conexão TCP/IP com balança em rede
          if (tcpSocketRef.current) return; // já conectado
          
          try {
            const host = config.host || '192.168.1.100';
            const port = config.tcpPort || 4001;
            
            // Criar WebSocket para comunicação TCP (simulado via WebSocket)
            // Em um ambiente real, seria necessário usar uma biblioteca como socket.io ou implementar via backend
            const wsUrl = `ws://${host}:${port}`;
            const socket = new WebSocket(wsUrl);
            
            socket.onopen = () => {
              setConnected(true);
              console.log('Conectado à balança TCP/IP:', wsUrl);
            };
            
            socket.onmessage = (event) => {
              try {
                // Processar dados recebidos da balança
                const data = event.data;
                console.log('Dados recebidos da balança:', data);
                
                // Tentar extrair peso dos dados (formato pode variar conforme o modelo)
                const weightMatch = data.match(/([0-9]+(?:\.[0-9]+)?)/);
                if (weightMatch) {
                  setWeight(Math.max(0, Number(weightMatch[1])));
                }
              } catch (error) {
                console.error('Erro ao processar dados da balança:', error);
              }
            };
            
            socket.onclose = () => {
              setConnected(false);
              tcpSocketRef.current = null;
              console.log('Conexão TCP/IP com balança fechada');
            };
            
            socket.onerror = (error) => {
              setConnected(false);
              console.error('Erro na conexão TCP/IP com balança:', error);
            };
            
            tcpSocketRef.current = socket;
            
            // Enviar comando de leitura contínua (se necessário)
            const sendReadCommand = () => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send('READ\r\n'); // Comando comum para balanças
              }
            };
            
            // Enviar comando a cada 500ms
            const readInterval = setInterval(() => {
              if (!alive || socket.readyState !== WebSocket.OPEN) {
                clearInterval(readInterval);
                return;
              }
              sendReadCommand();
            }, 500);
            
          } catch (error) {
            console.error('Erro ao conectar TCP/IP:', error);
            setConnected(false);
          }
        } else if (config.mode === 'mock') {
          // leve jitter
          setWeight(w => Math.max(0, Number((w + (Math.random()-0.5)*0.02).toFixed(2))));
        }
      } catch (_) {}
    };
    interval = window.setInterval(poll, 800);
    return () => {
      alive = false;
      if (interval) window.clearInterval(interval);
      const abort = serialReaderAbort.current;
      const close = serialClose.current;
      const tcpSocket = tcpSocketRef.current;
      serialReaderAbort.current = undefined;
      serialClose.current = undefined;
      if (abort) Promise.resolve(abort()).catch(() => {});
      if (close) Promise.resolve(close()).catch(() => {});
      if (tcpSocket) {
        tcpSocket.close();
        tcpSocketRef.current = null;
      }
    };
  }, [config.mode, config.modelLabel, config.port, config.vendorId, config.productId, config.baudRate, config.parity]);

  const loadCages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.CAGES}`, {
        headers: { 'x-api-key': API_CONFIG.API_KEY }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json() as Array<{ id: string; barcode: string; tareWeight: number; createdAt: string }>;
      setCages(data.map(c => ({ id: c.id, barcode: c.barcode, tareWeight: Number(c.tareWeight), createdAt: c.createdAt })));
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

  const submitWeighing = async (controlId: string, options?: { cageId?: string; tareWeight?: number; totalWeight?: number }): Promise<boolean> => {
    if (!config.apiBaseUrl) return false;
    
    // ❌ REMOVIDO: setLoading(true) pode interferir com o loop de múltiplas pesagens
    // setLoading(true);
    setError(null);
    try {
      const body: any = { control_id: controlId, peso_total: options?.totalWeight ?? weight };
      
      // ✅ CORRIGIDO: Envia cageId se disponível
      if (options?.cageId) {
        body.cage_id = options.cageId;
      }
      
      // ✅ CORRIGIDO: Envia tara sempre que disponível (não é exclusivo com cageId)
      if (options?.tareWeight !== undefined) {
        body.peso_tara = options.tareWeight;
      }
      
      const url = `${config.apiBaseUrl}${API_CONFIG.ENDPOINTS.TOTEM.WEIGHINGS}`;
      
      console.log('🌐 ENVIANDO PARA API:');
      console.log('URL:', url);
      console.log('Body:', JSON.stringify(body, null, 2));
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-api-key': API_CONFIG.API_KEY,
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      console.log('📥 Resposta:', res.status, res.statusText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Erro da API:', errorText);
        // ❌ Não tratar duplicidade como sucesso; deixar o caller decidir (pode re-tentar)
        throw new Error('HTTP ' + res.status + (errorText ? (': ' + errorText) : ''));
      }
      
      const responseData = await res.json();
      console.log('✅ Resposta OK:', responseData);
      
      // ❌ REMOVIDO: setWeight(0) e setIsStable(false) 
      // Isso estava interferindo com o envio de múltiplas pesagens
      // setWeight(0);
      // setIsStable(false);
      return true;
    } catch (err) {
      console.error('❌ Erro no submitWeighing:', err);
      setError('Erro ao enviar pesagem');
      return false;
    } finally {
      // ❌ REMOVIDO: setLoading(false) pode interferir com o loop de múltiplas pesagens
      // setLoading(false);
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
      const body: any = { tipo: kind, clientId: config.clientId };
      if (kind === 'limpa' && grossWeight !== undefined) body.peso_bruto_lavanderia = grossWeight;
      if (kind === 'suja' && expectedDate) body.prevista = expectedDate;
      const res = await fetch(`${config.apiBaseUrl}${API_CONFIG.ENDPOINTS.TOTEM.CONTROL_OPEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_CONFIG.API_KEY },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      
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


