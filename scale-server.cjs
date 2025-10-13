#!/usr/bin/env node

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const http = require('http');
const express = require('express');

const app = express();
const PORT = 3001;

let lastWeight = 0;
let connected = false;

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Endpoint para ler o peso da balança
app.get('/scale/weight', (req, res) => {
  res.json({ 
    weight: lastWeight, 
    connected: connected,
    timestamp: Date.now()
  });
});

// Criar servidor HTTP
const server = http.createServer(app);

// Ler continuamente da porta serial
function readScale() {
  const SCALE_PORT = '/dev/ttyS0';
  const BAUD_RATE = 9600;
  
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
    
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r' }));
    
    port.open((err) => {
      if (err) {
        console.error('❌ Erro ao abrir porta:', err.message);
        connected = false;
        setTimeout(readScale, 2000);
        return;
      }
      
      console.log('✅ Conectado à balança!');
      connected = true;
    });
    
    parser.on('data', (line) => {
      const data = line.trim();
      console.log('📥 Dados recebidos:', JSON.stringify(data));
      
      // Formato: H0000.15 ou L0000.10
      if (data.length > 1 && /^[HLhl]/.test(data)) {
        const weightStr = data.substring(1);
        const weight = parseFloat(weightStr);
        
        if (!isNaN(weight)) {
          lastWeight = weight;
          connected = true;
          console.log(`⚖️  Peso: ${weight.toFixed(2)} kg`);
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
  console.log('═══════════════════════════════════════');
  console.log('  🏥 ECOLAV - Servidor de Balança');
  console.log('═══════════════════════════════════════');
  console.log(`  📡 Servidor rodando em http://localhost:${PORT}`);
  console.log(`  ⚖️  Endpoint: http://localhost:${PORT}/scale/weight`);
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

