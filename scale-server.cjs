#!/usr/bin/env node

/**
 * Servidor de Balança - MyEcolav
 * 
 * Este servidor lê dados da balança via porta serial e disponibiliza
 * via API HTTP para o frontend.
 * 
 * CONFIGURAÇÃO DA PORTA:
 * ----------------------
 * Você pode definir a porta serial de 3 formas:
 * 
 * 1. Variável de ambiente:
 *    SCALE_PORT=COM3 SCALE_BAUD_RATE=9600 node scale-server.cjs
 *    SCALE_PORT=/dev/ttyUSB0 node scale-server.cjs
 * 
 * 2. Via npm config:
 *    npm run scale:server --scale-port=COM3 --scale-baud-rate=9600
 * 
 * 3. Padrão (se não especificado):
 *    /dev/ttyS0 @ 9600 baud (Linux/Unix)
 * 
 * PORTAS COMUNS:
 * - Windows: COM1, COM2, COM3, etc.
 * - Linux: /dev/ttyS0, /dev/ttyUSB0, /dev/ttyACM0
 * - Mac: /dev/cu.usbserial, /dev/tty.usbserial
 */

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const express = require('express');
const net = require('net');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

// Importar biblioteca chainway-rfid (compilada)
let chainwayApi = null;
try {
  chainwayApi = require('./chainway-rfid/dist/index').chainwayApi;
  console.log('✅ Biblioteca chainway-rfid carregada');
} catch (error) {
  console.warn('⚠️  Biblioteca chainway-rfid não encontrada. Compile com: cd chainway-rfid && npx tsc');
}

const app = express();
const PORT = 3001;

let lastWeight = 0;
let connected = false;
let currentPort = null; // Porta serial atual
let currentReader = null; // Referência ao leitor atual

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

// Endpoint para ler o peso da balança
app.get('/scale/weight', (req, res) => {
  res.json({ 
    weight: lastWeight, 
    connected: connected,
    timestamp: Date.now()
  });
});

// Endpoint para testar conexão com leitor Chainway UR4
app.post('/rfid/ur4/test', (req, res) => {
  const { host, port, power, antennas } = req.body || {};

  if (!host || port === undefined || port === null) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetros "host" e "port" são obrigatórios.'
    });
  }

  const numericPort = typeof port === 'number' ? port : parseInt(port, 10);
  if (!Number.isFinite(numericPort) || numericPort <= 0 || numericPort > 65535) {
    return res.status(400).json({
      success: false,
      message: 'Parâmetro "port" inválido. Informe um número entre 1 e 65535.'
    });
  }

  const socket = new net.Socket();
  const startedAt = Date.now();
  let responded = false;

  const finish = (status, payload) => {
    if (responded) return;
    responded = true;
    clearTimeout(timeout);
    try {
      socket.destroy();
    } catch {}
    if (!res.headersSent) {
      res.status(status).json(payload);
    }
  };

  const timeout = setTimeout(() => {
    finish(504, {
      success: false,
      message: `Tempo excedido ao conectar em ${host}:${numericPort}.`
    });
  }, 4000);

  socket.once('error', (err) => {
    finish(502, {
      success: false,
      message: `Não foi possível conectar em ${host}:${numericPort} - ${err.message || 'erro desconhecido'}.`
    });
  });

  socket.connect(numericPort, host, () => {
    const latency = Date.now() - startedAt;
    finish(200, {
      success: true,
      message: `Conexão estabelecida com ${host}:${numericPort}.`,
      latency,
      echo: {
        power,
        antennas
      }
    });
  });
});

// Endpoint para listar todas as portas seriais disponíveis
app.get('/scale/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    const portList = ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      vendorId: p.vendorId,
      productId: p.productId
    }));
    res.json({ ports: portList });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para testar uma porta específica
app.post('/scale/test-port', async (req, res) => {
  const { path, baudRate = 9600 } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: 'Porta não especificada' });
  }

  try {
    console.log(`🔍 Testando porta ${path} @ ${baudRate} baud...`);
    
    const testPort = new SerialPort({
      path: path,
      baudRate: baudRate,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false
    });

    const parser = testPort.pipe(new ReadlineParser({ delimiter: '\r' }));
    let responded = false;

    const finish = (payload) => {
      if (responded) return;
      responded = true;
      try {
        testPort.removeAllListeners();
        if (testPort.isOpen) {
          testPort.close(() => {});
        }
      } catch {}
      res.json(payload);
    };

    const timeout = setTimeout(() => {
      console.log(`⏱️  Timeout na porta ${path}`);
      finish({ success: false, error: 'Sem resposta da balança (timeout)', path, baudRate });
    }, 5000);

    testPort.open((err) => {
      if (err) {
        clearTimeout(timeout);
        console.log(`❌ Erro ao abrir ${path}: ${err.message}`);
        return finish({ success: false, error: err.message, path });
      }

      console.log(`✅ Porta ${path} aberta, aguardando dados...`);
    });

    parser.on('data', (line) => {
      const data = line.trim();
      console.log(`📥 Dados recebidos de ${path}: ${data}`);
      
      if (data.length > 1 && /^[HLFDhlfd]/.test(data)) {
        const weightStr = data.substring(1);
        const weight = parseFloat(weightStr);
        
        if (!isNaN(weight)) {
          clearTimeout(timeout);
          console.log(`✅ Balança detectada em ${path}! Peso: ${weight.toFixed(2)} kg`);
          finish({ 
            success: true, 
            path,
            baudRate,
            weight,
            raw: data,
            message: `Balança detectada! Peso: ${weight.toFixed(2)} kg`
          });
        }
      }
    });

    testPort.on('close', () => {
      clearTimeout(timeout);
      if (!responded) {
        console.log(`⚠️  Porta ${path} fechada sem dados`);
        finish({ success: false, error: 'Porta fechada sem dados', path, baudRate });
      }
    });

    testPort.on('error', (err) => {
      clearTimeout(timeout);
      console.log(`❌ Erro na porta ${path}: ${err.message}`);
      finish({ success: false, error: err.message, path, baudRate });
    });

  } catch (error) {
    console.log(`❌ Erro ao testar porta ${path}: ${error.message}`);
    res.json({ 
      success: false, 
      error: error.message,
      path: path 
    });
  }
});

// Endpoint para mudar a porta em tempo real
app.post('/scale/change-port', async (req, res) => {
  const { path, baudRate = 9600 } = req.body;
  
  if (!path) {
    return res.status(400).json({ error: 'Porta não especificada' });
  }

  try {
    console.log(`🔄 Mudando para porta ${path} @ ${baudRate} baud...`);
    
    // Fechar porta atual se existir
    if (currentPort && currentPort.isOpen) {
      await currentPort.close();
      console.log('🔌 Porta anterior fechada');
    }

    // Configurar nova porta
    process.env.SCALE_PORT = path;
    process.env.SCALE_BAUD_RATE = baudRate.toString();
    
    // Reiniciar leitura
    connected = false;
    lastWeight = 0;
    readScale();
    
    res.json({ 
      success: true, 
      message: `Porta alterada para ${path}`,
      path: path,
      baudRate: baudRate
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Criar servidor HTTP
const server = http.createServer(app);

// ===== SISTEMA RFID UR4 COM SOCKET.IO =====
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Configuração padrão do leitor RFID
const defaultRFIDConfig = {
  ip: '192.168.99.201',
  port: 8888,
  power: 20,
  antennas: [1, 2, 3, 4]
};

const rfidConfigPath = path.join(__dirname, 'rfid-config.json');

let rfidConfig = { ...defaultRFIDConfig };

function isValidIPv4(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const octets = value.trim().split('.');
  if (octets.length !== 4) {
    return false;
  }
  return octets.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

function sanitizeAntennaList(input) {
  if (!input) {
    return [...defaultRFIDConfig.antennas];
  }

  const list = Array.isArray(input) ? input : [input];
  const normalized = list
    .map((antenna) => Number(antenna))
    .filter((antenna) => Number.isFinite(antenna))
    .map((antenna) => Math.max(1, Math.min(8, Math.trunc(antenna))))
    .filter((antenna, index, self) => antenna >= 1 && antenna <= 8 && self.indexOf(antenna) === index);

  return normalized.length ? normalized : [...defaultRFIDConfig.antennas];
}

async function applyRFIDPowerSetting(powerValue, options = {}) {
  const { allowReconnect = true, manageReadingState = true, antennas } = options;

  if (powerValue === undefined || powerValue === null) {
    console.log('ℹ️ [RFID] Nenhum valor de potência informado para aplicar.');
    return false;
  }

  if (!chainwayApi || typeof chainwayApi.setPower !== 'function') {
    console.log('⚠️ [RFID] Método setPower indisponível na biblioteca chainway-rfid');
    return false;
  }

  const numericPower = Number(powerValue);
  if (!Number.isFinite(numericPower)) {
    console.log(`⚠️ [RFID] Valor de potência inválido: ${powerValue}`);
    return false;
  }

  const normalizedPower = Math.max(0, Math.min(30, Math.round(numericPower * 100) / 100));
  const antennaList = sanitizeAntennaList(antennas ?? rfidConfig.antennas);

  if (!rfidConnected) {
    console.log('ℹ️ [RFID] Potência atualizada será aplicada quando o leitor conectar.');
    return false;
  }

  const wasReading = rfidReading && manageReadingState;

  if (wasReading) {
    console.log('⏸️ [RFID] Pausando leitura para aplicar nova potência...');
    try {
      await stopRFIDReading();
    } catch (pauseError) {
      console.error('⚠️ [RFID] Erro ao pausar leitura antes de ajustar potência:', pauseError.message || pauseError);
    }
  }

  const sendPowerCommand = async () => {
    try {
      await chainwayApi.setPower(normalizedPower, {
        antennas: antennaList,
        saveToFlash: true
      });
      console.log(`✅ [RFID] Potência aplicada: ${normalizedPower} dBm | Antenas: ${antennaList.join(', ')}`);
      return true;
    } catch (error) {
      console.error(`❌ [RFID] Erro ao aplicar potência (${normalizedPower} dBm):`, error.message || error);
      return false;
    }
  };

  let commandApplied = await sendPowerCommand();

  if (!commandApplied && allowReconnect) {
    console.log('🔄 [RFID] Tentando reconectar para reaplicar potência...');
    try {
      await disconnectFromRFIDReader();
      await connectToRFIDReader();
      if (rfidConnected) {
        commandApplied = await sendPowerCommand();
      }
    } catch (reconnectError) {
      console.error('❌ [RFID] Falha ao reconectar durante ajuste de potência:', reconnectError.message || reconnectError);
    }
  }

  if (wasReading && rfidConnected) {
    try {
      await startRFIDReading();
      console.log('▶️ [RFID] Leitura retomada após ajuste de potência');
    } catch (resumeError) {
      console.error('⚠️ [RFID] Não foi possível retomar leitura automaticamente:', resumeError.message || resumeError);
    }
  }

  return commandApplied;
}

rfidConfig.antennas = sanitizeAntennaList(rfidConfig.antennas);

function loadRFIDConfig() {
  try {
    if (fs.existsSync(rfidConfigPath)) {
      const fileData = fs.readFileSync(rfidConfigPath, 'utf-8');
      const parsed = JSON.parse(fileData);
      rfidConfig = { ...rfidConfig, ...parsed };
      if (!isValidIPv4(rfidConfig.ip)) {
        console.warn(`⚠️ [RFID] IP inválido em rfid-config (${rfidConfig.ip}), usando padrão ${defaultRFIDConfig.ip}`);
        rfidConfig.ip = defaultRFIDConfig.ip;
      }
      rfidConfig.antennas = sanitizeAntennaList(rfidConfig.antennas);
      console.log(`📁 [RFID] Configuração carregada de ${rfidConfigPath}`, rfidConfig);
    } else {
      console.log('📁 [RFID] Nenhum arquivo de configuração encontrado, usando padrão.');
    }
  } catch (error) {
    console.error('❌ [RFID] Erro ao carregar configuração persistida:', error.message || error);
  }
}

function saveRFIDConfig() {
  try {
    fs.writeFileSync(rfidConfigPath, JSON.stringify(rfidConfig, null, 2));
    console.log(`💾 [RFID] Configuração salva em ${rfidConfigPath}`);
  } catch (error) {
    console.error('❌ [RFID] Erro ao salvar configuração:', error.message || error);
  }
}

loadRFIDConfig();

// Variáveis globais para controle RFID
let rfidConnected = false;
let rfidReading = false;
let rfidReadings = [];
let rfidTotalReadings = 0;
let rfidReceiverAttached = false;
let rfidReconnecting = false; // Flag para evitar loops de reconexão

function clearRFIDReadings(options = {}) {
  const { emit = true } = options;
  rfidReadings = [];
  rfidTotalReadings = 0;
  if (emit && io) {
    io.emit('readings-update', {
      readings: [],
      totalReadings: 0
    });
  }
}

// Conectar ao leitor RFID UR4
async function connectToRFIDReader() {
  if (!chainwayApi) {
    throw new Error('Biblioteca chainway-rfid não disponível');
  }
  
  // Evitar múltiplas tentativas simultâneas
  if (rfidReconnecting) {
    console.log('⚠️ [RFID] Conexão já em andamento, aguardando...');
    return;
  }
  
  rfidReconnecting = true;
  
  try {
    console.log(`🔌 [RFID] Conectando: ${rfidConfig.ip}:${rfidConfig.port}`);
    await chainwayApi.connect(rfidConfig.ip, rfidConfig.port);
    rfidConnected = true;
    rfidReconnecting = false;

    if (rfidConfig.power !== undefined) {
      await applyRFIDPowerSetting(rfidConfig.power, {
        allowReconnect: false,
        manageReadingState: false,
        antennas: rfidConfig.antennas
      });
    }

    if (!rfidReceiverAttached) {
      chainwayApi.received((data) => {
        try {
          const epcValue = (data && data.epc) ? String(data.epc).toUpperCase() : '';
          const tidValue = (data && data.tid) ? String(data.tid).toUpperCase() : '';
          
          const reading = {
            id: Date.now(),
            epc: epcValue,
            tid: tidValue,
            rssi: typeof data.rssi === 'string' ? parseInt(data.rssi, 16) : (typeof data.rssi === 'number' ? data.rssi : 0),
            antenna: typeof data.ant === 'number' ? data.ant : 0,
            timestamp: new Date().toISOString(),
            rawData: ''
          };

          rfidReadings.push(reading);
          rfidTotalReadings++;
          if (rfidReadings.length > 100) {
            rfidReadings = rfidReadings.slice(-100);
          }

          // Emitir para todos os clientes via Socket.IO
          io.emit('rfid-reading', reading);
          io.emit('readings-update', { 
            readings: rfidReadings.slice(-50), 
            totalReadings: rfidTotalReadings 
          });
          
          console.log(`📡 [RFID] Tag lida: TID=${tidValue || epcValue} | Ant=${reading.antenna}`);
        } catch (error) {
          console.error('❌ [RFID] Erro ao processar dados:', error.message);
        }
      });
      
      rfidReceiverAttached = true;
    }

    console.log(`✅ [RFID] Conectado ao leitor RFID`);
    io.emit('connection-status', { 
      isConnected: true,
      isReading: rfidReading,
      totalReadings: rfidTotalReadings
    });
  } catch (error) {
    console.error(`❌ [RFID] Erro na conexão: ${error.message || error}`);
    rfidConnected = false;
    rfidReconnecting = false;
    throw error;
  }
}

// Iniciar leitura contínua
async function startRFIDReading() {
  if (!chainwayApi) {
    throw new Error('Biblioteca chainway-rfid não disponível');
  }
  if (!rfidConnected) {
    throw new Error('Leitor não conectado');
  }
  if (rfidReading) {
    console.log('⚠️ [RFID] Já está lendo');
    return;
  }
  
  try {
    clearRFIDReadings();
    await chainwayApi.startScan();
    rfidReading = true;
    console.log('✅ [RFID] Leitura iniciada');
    io.emit('reading-status', { isReading: true });
  } catch (error) {
    console.error('❌ [RFID] Erro ao iniciar leitura:', error.message || error);
    throw error;
  }
}

// Parar leitura contínua
async function stopRFIDReading() {
  if (!chainwayApi) {
    return;
  }
  if (!rfidReading) {
    console.log('⚠️ [RFID] Não está lendo');
    return;
  }
  
  try {
    await chainwayApi.stopScan();
    rfidReading = false;
    console.log('✅ [RFID] Leitura parada');
    io.emit('reading-status', { isReading: false });
    clearRFIDReadings();
  } catch (error) {
    console.error('❌ [RFID] Erro ao parar leitura:', error.message || error);
    clearRFIDReadings();
  }
}

// Desconectar do leitor
async function disconnectFromRFIDReader() {
  if (!chainwayApi) return;
  
  try {
    // Parar leitura primeiro
    if (rfidReading) {
      console.log('🛑 [RFID] Parando leitura antes de desconectar...');
      await stopRFIDReading();
    }
    
    // Desconectar usando o método da biblioteca
    if (typeof chainwayApi.disconnect === 'function') {
      console.log('🔌 [RFID] Chamando disconnect() da biblioteca...');
      chainwayApi.disconnect();
      
      // Aguardar um pouco para garantir que a conexão foi fechada
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Limpar estado
    rfidConnected = false;
    rfidReceiverAttached = false;
    rfidReconnecting = false;
    clearRFIDReadings();
    
    console.log('✅ [RFID] Desconectado do leitor');
    io.emit('connection-status', { 
      isConnected: false,
      isReading: false,
      totalReadings: rfidTotalReadings
    });
  } catch (error) {
    console.error('❌ [RFID] Erro ao desconectar:', error.message || error);
    // Forçar limpeza do estado mesmo em caso de erro
    rfidConnected = false;
    rfidReceiverAttached = false;
    rfidReconnecting = false;
    clearRFIDReadings();
    io.emit('connection-status', { 
      isConnected: false,
      isReading: false,
      totalReadings: rfidTotalReadings
    });
  }
}

// Socket.IO event handlers para RFID
io.on('connection', (socket) => {
  console.log('🔌 [Socket.IO] Cliente conectado:', socket.id);
  
  // Enviar status atual ao conectar
  socket.emit('connection-status', { 
    isConnected: rfidConnected,
    isReading: rfidReading,
    totalReadings: rfidTotalReadings
  });

  socket.on('get-status', () => {
    socket.emit('connection-status', { 
      isConnected: rfidConnected,
      isReading: rfidReading,
      totalReadings: rfidTotalReadings
    });
    socket.emit('reading-status', { isReading: rfidReading });
    socket.emit('readings-update', { 
      readings: rfidReadings.slice(-50),
      totalReadings: rfidTotalReadings
    });
  });

  socket.on('connect-reader', async () => {
    try {
      await connectToRFIDReader();
      socket.emit('connection-status', { 
        isConnected: true,
        isReading: rfidReading,
        totalReadings: rfidTotalReadings
      });
    } catch (error) {
      socket.emit('error', { message: 'Erro ao conectar: ' + error.message });
    }
  });

  socket.on('disconnect-reader', () => {
    disconnectFromRFIDReader();
  });

  socket.on('start-reading', async () => {
    try {
      await startRFIDReading();
      socket.emit('reading-status', { isReading: true });
    } catch (error) {
      socket.emit('error', { message: 'Erro ao iniciar leitura: ' + error.message });
    }
  });

  socket.on('stop-reading', async () => {
    await stopRFIDReading();
    socket.emit('reading-status', { isReading: false });
  });

  socket.on('clear-readings', () => {
    clearRFIDReadings();
    console.log('🧹 [RFID] Leituras limpas');
  });

  socket.on('disconnect', () => {
    console.log('🔌 [Socket.IO] Cliente desconectado:', socket.id);
  });
});

// Endpoints REST para RFID (compatibilidade)
app.post('/rfid/ur4/connect', async (req, res) => {
  try {
    const { host, port, power, antennas } = req.body || {};
    if (host) rfidConfig.ip = host;
    if (port !== undefined) rfidConfig.port = port;
    if (power !== undefined) rfidConfig.power = power;
    if (antennas) rfidConfig.antennas = antennas;
    
    await connectToRFIDReader();
    res.json({ success: true, message: 'Conectado ao leitor RFID' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/rfid/ur4/disconnect', async (req, res) => {
  await disconnectFromRFIDReader();
  res.json({ success: true, message: 'Desconectado do leitor RFID' });
});

// Endpoint para atualizar configuração sem conectar
app.post('/rfid/ur4/config', async (req, res) => {
  try {
    const { host, port, power, antennas } = req.body || {};
    const configChanged = {};
    
    // Capturar valores antigos antes de atualizar
    const oldIp = rfidConfig.ip;
    const oldPort = rfidConfig.port;
    const oldPower = rfidConfig.power;
    
    if (host && host !== rfidConfig.ip) {
      if (!isValidIPv4(host)) {
        return res.status(400).json({
          success: false,
          message: `Endereço IP inválido: ${host}`
        });
      }
      configChanged.ip = true;
      rfidConfig.ip = host.trim();
      console.log(`📝 [RFID] IP atualizado de ${oldIp} para: ${rfidConfig.ip}`);
    }
    if (port !== undefined && port !== rfidConfig.port) {
      configChanged.port = true;
      rfidConfig.port = port;
      console.log(`📝 [RFID] Porta atualizada de ${oldPort} para: ${port}`);
    }
    if (power !== undefined && power !== rfidConfig.power) {
      configChanged.power = true;
      rfidConfig.power = power;
      console.log(`📝 [RFID] Potência atualizada de ${oldPower} para: ${power}`);
    }
    if (antennas) {
      const sanitizedAntennas = sanitizeAntennaList(antennas);
      if (JSON.stringify(sanitizedAntennas) !== JSON.stringify(rfidConfig.antennas)) {
        configChanged.antennas = true;
        rfidConfig.antennas = sanitizedAntennas;
        console.log(`📝 [RFID] Antenas atualizadas para: ${sanitizedAntennas.join(', ')}`);
      }
    }
    
    if (configChanged.ip || configChanged.port || configChanged.power || configChanged.antennas) {
      saveRFIDConfig();
    }
    
    // Se já estiver conectado e apenas IP/porta mudaram, reconectar
    if (rfidConnected && (configChanged.ip || configChanged.port)) {
      console.log(`🔄 [RFID] Configuração de conexão mudou, reconectando...`);
      console.log(`   IP: ${oldIp} → ${rfidConfig.ip}`);
      console.log(`   Porta: ${oldPort} → ${rfidConfig.port}`);
      
      // Desconectar completamente
      await disconnectFromRFIDReader();
      
      // Aguardar um pouco para garantir que a desconexão foi concluída
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconectar com nova configuração (com timeout para evitar loop infinito)
      console.log(`🔌 [RFID] Reconectando com IP: ${rfidConfig.ip}, Porta: ${rfidConfig.port}`);
      try {
        // Timeout de 10 segundos para conexão
        const connectPromise = connectToRFIDReader();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao conectar (10s)')), 10000)
        );
        await Promise.race([connectPromise, timeoutPromise]);
      } catch (error) {
        console.error(`❌ [RFID] Erro ao reconectar: ${error.message}`);
        // Não relançar o erro para não quebrar a atualização da configuração
        // O usuário pode tentar conectar manualmente depois
      }
    }

    // Reaplicar potência/antenas se houver alterações e o leitor estiver conectado
    if (rfidConnected && (configChanged.power || configChanged.antennas)) {
      const applied = await applyRFIDPowerSetting(rfidConfig.power, {
        allowReconnect: true,
        manageReadingState: true,
        antennas: rfidConfig.antennas
      });
      if (!applied) {
        console.warn('⚠️ [RFID] Não foi possível aplicar nova potência/antenas imediatamente.');
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Configuração atualizada',
      config: rfidConfig,
      reconnected: rfidConnected && (configChanged.ip || configChanged.port)
    });
  } catch (error) {
    console.error('❌ [RFID] Erro ao atualizar configuração:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para obter configuração atual
app.get('/rfid/ur4/config', (req, res) => {
  res.json({ 
    success: true, 
    config: rfidConfig 
  });
});

app.post('/rfid/ur4/start-reading', async (req, res) => {
  try {
    await startRFIDReading();
    res.json({ success: true, message: 'Leitura iniciada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/rfid/ur4/stop-reading', async (req, res) => {
  try {
    await stopRFIDReading();
    res.json({ success: true, message: 'Leitura parada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/rfid/ur4/status', (req, res) => {
  res.json({
    isConnected: rfidConnected,
    isReading: rfidReading,
    totalReadings: rfidTotalReadings,
    readings: rfidReadings.slice(-10),
    config: rfidConfig
  });
});

// Ler continuamente da porta serial
function readScale() {
  // Permite configurar via variável de ambiente ou usa valor padrão
  const SCALE_PORT = process.env.SCALE_PORT || process.env.npm_config_scale_port || '/dev/ttyS0';
  const BAUD_RATE = parseInt(process.env.SCALE_BAUD_RATE || process.env.npm_config_scale_baud_rate || '9600');
  
  console.log(`🔌 Conectando à balança em ${SCALE_PORT} @ ${BAUD_RATE} baud...`);
  
  try {
    const port = new SerialPort({
      path: SCALE_PORT,
      baudRate: BAUD_RATE,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      autoOpen: false
    });
    
    // Salvar referência da porta atual
    currentPort = port;
    
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r' }));
    
    port.open((err) => {
      if (err) {
        console.error('❌ Erro ao abrir porta:', err.message);
        connected = false;
        currentPort = null;
        setTimeout(readScale, 2000);
        return;
      }
      
      console.log('✅ Conectado à balança!');
      connected = true;
    });
    
    parser.on('data', (line) => {
      const data = line.trim();
      console.log('📥 Dados recebidos:', JSON.stringify(data));
      
      // Formato: H0000.15, L0000.10, F0000.00 (fixo), D0000.00 (dinâmico)
      if (data.length > 1 && /^[HLFDhlfd]/.test(data)) {
        const weightStr = data.substring(1);
        const weight = parseFloat(weightStr);
        
        if (!isNaN(weight)) {
          lastWeight = weight;
          connected = true;
          const status = data[0].toUpperCase() === 'F' ? '✓' : (data[0].toUpperCase() === 'D' ? '~' : '');
          console.log(`⚖️  Peso: ${weight.toFixed(2)} kg ${status}`);
        }
      } else {
        console.log('⚠️  Formato não reconhecido');
      }
    });
    
    port.on('error', (err) => {
      console.error('❌ Erro na porta serial:', err.message);
      connected = false;
    });
    
    port.on('close', () => {
      console.log('⚠️  Porta fechada, reconectando...');
      connected = false;
      setTimeout(readScale, 2000);
    });
    
  } catch (err) {
    console.error('❌ Erro ao criar porta serial:', err.message);
    connected = false;
    setTimeout(readScale, 2000);
  }
}

// Iniciar servidor e leitura da balança
server.listen(PORT, () => {
  const defaultPort = process.env.SCALE_PORT || process.env.npm_config_scale_port || '/dev/ttyS0';
  const defaultBaud = parseInt(process.env.SCALE_BAUD_RATE || process.env.npm_config_scale_baud_rate || '9600');
  
  console.log('═══════════════════════════════════════');
  console.log('  🏥 ECOLAV - Servidor de Balança & RFID');
  console.log('═══════════════════════════════════════');
  console.log(`  📡 Servidor HTTP: http://localhost:${PORT}`);
  console.log(`  ⚖️  Balança: http://localhost:${PORT}/scale/weight`);
  console.log(`  🔌 Porta Serial: ${defaultPort} @ ${defaultBaud} baud`);
  console.log(`  📡 RFID UR4: ${rfidConfig.ip}:${rfidConfig.port}`);
  console.log(`  🔌 Socket.IO: http://localhost:${PORT} (WebSocket)`);
  console.log('───────────────────────────────────────');
  console.log('  💡 Para mudar a porta da balança:');
  console.log(`     SCALE_PORT=COM3 node scale-server.cjs`);
  console.log(`     npm run scale:server --scale-port=COM3`);
  console.log('═══════════════════════════════════════\n');
  
  // Iniciar leitura da balança
  readScale();
});

// Tratamento de sinais para encerrar gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado.');
    process.exit(0);
  });
});

