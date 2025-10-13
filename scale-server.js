#!/usr/bin/env node

const fs = require('fs');
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
  
  console.log(`🔌 Conectando à balança em ${SCALE_PORT}...`);
  
  const stream = fs.createReadStream(SCALE_PORT, { 
    encoding: 'utf8',
    highWaterMark: 16 
  });
  
  let buffer = '';
  
  stream.on('data', (chunk) => {
    buffer += chunk;
    
    // Processar linhas completas
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      
      // Formato: H0000.15 ou L0000.10
      if (line.length > 1 && /^[HLhl]/.test(line)) {
        const weightStr = line.substring(1);
        const weight = parseFloat(weightStr);
        
        if (!isNaN(weight)) {
          lastWeight = weight;
          connected = true;
          // console.log(`⚖️  Peso: ${weight.toFixed(2)} kg`);
        }
      }
    }
  });
  
  stream.on('error', (err) => {
    console.error('❌ Erro na leitura:', err.message);
    connected = false;
    
    // Tentar reconectar após 2 segundos
    setTimeout(readScale, 2000);
  });
  
  stream.on('end', () => {
    console.log('⚠️  Stream encerrado, reconectando...');
    connected = false;
    setTimeout(readScale, 1000);
  });
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

