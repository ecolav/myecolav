const { SerialPort } = require('serialport');

const port = new SerialPort({
  path: '/dev/ttyS0',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1
});

console.log('🔍 Lendo dados brutos da balança...\n');

port.on('data', (data) => {
  console.log('HEX:', data.toString('hex'));
  console.log('TXT:', JSON.stringify(data.toString('utf8')));
  console.log('---');
});

port.on('error', (err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('\n✅ Teste concluído');
  port.close(() => process.exit(0));
}, 5000);

