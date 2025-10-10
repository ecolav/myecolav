const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const app = express();
const PORT = 3000;

// Obter o IP local da máquina
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

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'dist')));

// Rota para obter informações do servidor
app.get('/api/server-info', (req, res) => {
  res.json({
    ip: getLocalIP(),
    port: PORT,
    url: `http://${getLocalIP()}:${PORT}`,
    timestamp: new Date().toISOString()
  });
});

// Rota para iniciar o build do Vite
app.post('/api/build', (req, res) => {
  console.log('Iniciando build do projeto...');
  exec('npm run build', (error, stdout, stderr) => {
    if (error) {
      console.error('Erro no build:', error);
      return res.status(500).json({ error: 'Erro no build', details: error.message });
    }
    console.log('Build concluído com sucesso');
    res.json({ message: 'Build concluído', stdout, stderr });
  });
});

// Servir o index.html para todas as rotas (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('\n🚀 Servidor iniciado!');
  console.log(`📱 Acesso local: http://localhost:${PORT}`);
  console.log(`🌐 Acesso em rede: http://${localIP}:${PORT}`);
  console.log('\nPara acessar de outro computador na rede:');
  console.log(`   Abra o navegador e acesse: http://${localIP}:${PORT}`);
  console.log('\nPressione Ctrl+C para parar o servidor\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Parando servidor...');
  process.exit(0);
});

