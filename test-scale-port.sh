#!/bin/bash

echo "=========================================="
echo "🔍 Testando portas seriais para balança..."
echo "=========================================="
echo ""
echo "Pressione Ctrl+C para parar"
echo ""

# Testar portas mais comuns primeiro
for port in /dev/ttyS0 /dev/ttyS1 /dev/ttyS2 /dev/ttyUSB0 /dev/ttyUSB1; do
    if [ -e "$port" ]; then
        echo "📡 Testando: $port"
        echo "   (aguardando 3 segundos...)"
        
        # Tentar ler dados da porta com timeout
        timeout 3s cat "$port" 2>/dev/null && echo "   ✅ Dados recebidos em $port!" || echo "   ❌ Sem dados"
        echo ""
    fi
done

echo ""
echo "=========================================="
echo "💡 Dica: Se a balança enviou dados, a porta"
echo "   correta será mostrada acima com ✅"
echo "=========================================="

