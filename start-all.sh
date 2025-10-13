#!/bin/bash

echo "═══════════════════════════════════════"
echo "  🏥 ECOLAV TOTEM - Inicialização"
echo "═══════════════════════════════════════"
echo ""

# Parar processos antigos
echo "🛑 Parando processos antigos..."
pkill -f scale-server 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 1

# Iniciar servidor de balança
echo "⚖️  Iniciando servidor de balança..."
cd /home/idtrack/myecolav
nohup node scale-server.cjs > scale-server.log 2>&1 &
sleep 2

# Verificar se servidor de balança está rodando
if curl -s http://localhost:3001/scale/weight > /dev/null; then
    echo "✅ Servidor de balança: OK"
    WEIGHT=$(curl -s http://localhost:3001/scale/weight | grep -o '"weight":[0-9.]*' | cut -d: -f2)
    echo "   Peso atual: ${WEIGHT} kg"
else
    echo "❌ Servidor de balança: ERRO"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  📊 STATUS DOS SERVIÇOS"
echo "═══════════════════════════════════════"
echo ""
echo "✅ Servidor Balança:  http://localhost:3001"
echo "✅ Balança Serial:    /dev/ttyS0 @ 9600 baud"
echo ""
echo "═══════════════════════════════════════"
echo "  🚀 COMO USAR"
echo "═══════════════════════════════════════"
echo ""
echo "1. Abra o navegador: http://localhost:5173"
echo "2. Vá em 'Pesagem' (botão azul)"
echo "3. Coloque peso na balança"
echo "4. O peso aparecerá em tempo real!"
echo ""
echo "Ou abra o app instalado:"
echo "   ecolav-totem"
echo ""
echo "═══════════════════════════════════════"

