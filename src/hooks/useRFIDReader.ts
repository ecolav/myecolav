import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { socketManager } from '../services/socketManager';

interface RFIDReaderConfig {
  ip: string;
  port: number;
  power: number;
  antennas: number[];
}

interface RFIDReading {
  id: number;
  epc: string;
  tid?: string;
  rssi: number;
  antenna: number;
  timestamp: string;
  rawData: string;
}

interface ConnectionStatus {
  isConnected: boolean;
  isReading: boolean;
  totalReadings: number;
}

interface PowerStatus {
  updating: boolean;
  targetPower: number | null;
  queueLength: number;
  timestamp: number;
}

export function useRFIDReader() {
  const [config, setConfig] = useState<RFIDReaderConfig>({
    ip: '192.168.99.201',
    port: 8888,
    power: 20,
    antennas: [1, 2, 3, 4]
  });

  const [readings, setReadings] = useState<RFIDReading[]>([]);
  
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isReading: false,
    totalReadings: 0
  });

  const [powerStatus, setPowerStatus] = useState<PowerStatus>({
    updating: false,
    targetPower: null,
    queueLength: 0,
    timestamp: Date.now()
  });

  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Conectar ao servidor backend usando Socket.IO
  useEffect(() => {
    console.log('🔌 [useRFIDReader] Obtendo socket do gerenciador...');
    const socket = socketManager.getSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      console.log('✅ [useRFIDReader] Conectado ao servidor backend');
      setError(null);
    };

    const handleDisconnect = () => {
      console.log('🔌 [useRFIDReader] Desconectado do servidor backend');
      setStatus(current => ({ ...current, isConnected: false, isReading: false }));
    };

    const handleConnectionStatus = (data: ConnectionStatus) => {
      console.log('📊 [useRFIDReader] Status da conexão:', data);
      setStatus(data);
    };

    const handleReadingStatus = (data: { isReading: boolean }) => {
      console.log('📊 [useRFIDReader] Status da leitura:', data);
      setStatus(current => ({ ...current, isReading: data.isReading }));
    };

    const handleRFIDReading = (reading: RFIDReading) => {
      console.log('🎯 [useRFIDReader] Nova leitura RFID:', reading);
      setReadings(current => [reading, ...current.slice(0, 99)]);
    };

    const handleReadingsUpdate = (data: { readings: RFIDReading[], totalReadings: number }) => {
      console.log('📊 [useRFIDReader] Atualização de leituras:', data);
      setReadings(data.readings);
      setStatus(current => ({ 
        ...current, 
        totalReadings: data.totalReadings
      }));
    };

    const handleError = (data: { message: string }) => {
      console.error('❌ [useRFIDReader] Erro do servidor:', data.message);
      setError(data.message);
    };

    const handlePowerStatus = (data: Partial<PowerStatus>) => {
      setPowerStatus(current => ({
        updating: Boolean(data.updating),
        targetPower: typeof data.targetPower === 'number' ? data.targetPower : current.targetPower,
        queueLength: typeof data.queueLength === 'number' ? data.queueLength : current.queueLength,
        timestamp: data.timestamp ?? Date.now()
      }));
    };

    // Registrar eventos
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connection-status', handleConnectionStatus);
    socket.on('reading-status', handleReadingStatus);
    socket.on('rfid-reading', handleRFIDReading);
    socket.on('readings-update', handleReadingsUpdate);
    socket.on('error', handleError);
    socket.on('power-status', handlePowerStatus);

    // Solicitar status atual do servidor ao montar
    if (socket.connected) {
      console.log('🔄 [useRFIDReader] Solicitando status atual do servidor...');
      socket.emit('get-status');
    }

    // Cleanup
    return () => {
      console.log('🧹 [useRFIDReader] Removendo listeners do componente...');
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connection-status', handleConnectionStatus);
      socket.off('reading-status', handleReadingStatus);
      socket.off('rfid-reading', handleRFIDReading);
      socket.off('readings-update', handleReadingsUpdate);
      socket.off('error', handleError);
      socket.off('power-status', handlePowerStatus);
    };
  }, []);

  // Função para conectar ao leitor RFID
  const connectToReader = useCallback(async () => {
    if (!socketRef.current) {
      setError('Servidor não conectado');
      return;
    }

    try {
      console.log('🔌 [useRFIDReader] Conectando ao leitor RFID...');
      socketRef.current.emit('connect-reader');
      setError(null);
    } catch (error) {
      console.error('❌ [useRFIDReader] Erro ao conectar:', error);
      setError('Erro ao conectar ao leitor');
    }
  }, []);

  // Função para desconectar do leitor
  const disconnectFromReader = useCallback(() => {
    if (!socketRef.current) return;
    console.log('🔌 [useRFIDReader] Desconectando do leitor RFID...');
    socketRef.current.emit('disconnect-reader');
  }, []);

  // Função para iniciar leitura contínua
  const startContinuousReading = useCallback(() => {
    if (!socketRef.current) {
      setError('Servidor não conectado');
      return;
    }

    try {
      console.log('🟢 [useRFIDReader] Iniciando leitura contínua...');
      socketRef.current.emit('start-reading');
      setError(null);
    } catch (error) {
      console.error('❌ [useRFIDReader] Erro ao iniciar leitura:', error);
      setError('Erro ao iniciar leitura');
    }
  }, []);

  // Função para parar leitura
  const stopContinuousReading = useCallback(() => {
    if (!socketRef.current) return;
    console.log('🛑 [useRFIDReader] Parando leitura contínua...');
    socketRef.current.emit('stop-reading');
  }, []);

  // Função para limpar leituras
  const clearReadings = useCallback(() => {
    if (!socketRef.current) return;
    console.log('🧹 [useRFIDReader] Limpando leituras...');
    socketRef.current.emit('clear-readings');
    setReadings([]);
  }, []);

  // Função para atualizar configuração
  const updateConfig = useCallback((newConfig: Partial<RFIDReaderConfig>) => {
    setConfig(current => ({ ...current, ...newConfig }));
  }, []);

  // Função para limpar erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Estado
    config,
    readings,
    status,
    powerStatus,
    error,
    
    // Ações
    connectToReader,
    disconnectFromReader,
    startContinuousReading,
    stopContinuousReading,
    clearReadings,
    updateConfig,
    clearError
  };
}











