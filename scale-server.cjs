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
  console.log('  🏥 ECOLAV - Servidor de Balança');
  console.log('═══════════════════════════════════════');
  console.log(`  📡 Servidor HTTP: http://localhost:${PORT}`);
  console.log(`  ⚖️  Endpoint: http://localhost:${PORT}/scale/weight`);
  console.log(`  🔌 Porta Serial: ${defaultPort} @ ${defaultBaud} baud`);
  console.log('───────────────────────────────────────');
  console.log('  💡 Para mudar a porta:');
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

