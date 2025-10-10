const { spawn } = require('child_process');
const os = require('os');

console.log('🚀 Iniciando MyEcolav em modo rede...\n');

// Função para obter o IP local
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Primeiro, fazer o build do projeto
console.log('📦 Fazendo build do projeto...');
const buildProcess = spawn('npm', ['run', 'build'], { 
  stdio: 'inherit',
  shell: true 
});

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ Erro no build do projeto');
    process.exit(1);
  }
  
  console.log('✅ Build concluído com sucesso!\n');
  
  // Depois iniciar o servidor
  console.log('🌐 Iniciando servidor web...');
  const serverProcess = spawn('node', ['server.cjs'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  serverProcess.on('close', (code) => {
    console.log(`\n🛑 Servidor finalizado com código ${code}`);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Parando aplicação...');
    serverProcess.kill('SIGINT');
  });
});

buildProcess.on('error', (err) => {
  console.error('❌ Erro ao executar build:', err);
  process.exit(1);
});

