#!/bin/bash
clear
echo "════════════════════════════════════════════════════════"
echo "  🏥 ECOLAV TOTEM - Instalador Completo v3"
echo "════════════════════════════════════════════════════════"
echo ""

# 0. Verificar/Atualizar Node.js
echo "🔍 [0/7] Verificando Node.js..."
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
    echo "📦 Instalando Node.js 20 (LTS)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt-get install -y nodejs > /dev/null 2>&1
    echo "✅ Node.js $(node -v) instalado!"
else
    echo "✅ Node.js $(node -v) já instalado!"
fi

# 1. Instalar aplicativo
echo "📦 [1/7] Instalando aplicativo Tauri..."
sudo dpkg -i ecolav-totem_0.1.0_amd64.deb 2>/dev/null
sudo apt-get install -f -y > /dev/null 2>&1

# 2. Criar diretório do servidor
echo "📁 [2/7] Criando diretório do servidor..."
sudo mkdir -p /opt/ecolav-server
sudo cp scale-server.cjs /opt/ecolav-server/
sudo cp package.json /opt/ecolav-server/
sudo rm -rf /opt/ecolav-server/chainway-rfid
sudo cp -R chainway-rfid /opt/ecolav-server/
sudo cp rfid-config.json /opt/ecolav-server/

# 3. Instalar dependências Node
echo "📦 [3/7] Instalando dependências Node (pode demorar 1-2 min)..."
cd /opt/ecolav-server
sudo rm -rf node_modules
sudo npm install --production > /dev/null 2>&1

# 4. Criar logs
echo "📋 [4/7] Configurando logs..."
sudo mkdir -p /var/log/ecolav
sudo chmod 777 /var/log/ecolav

# 5. Criar launcher unificado
echo "🚀 [5/7] Criando launcher unificado..."
sudo bash -c 'cat > /usr/local/bin/ecolav-completo << "LAUNCHER"
#!/bin/bash
# Mata processos antigos
pkill -f "node.*scale-server" 2>/dev/null
pkill -f "ecolav-totem" 2>/dev/null
sleep 1

# Inicia servidor da balança
cd /opt/ecolav-server
nohup node scale-server.cjs > /var/log/ecolav/scale-server.log 2>&1 &
sleep 2

# Inicia aplicativo
DISPLAY=:0 /usr/bin/ecolav-totem 2>/dev/null &

exit 0
LAUNCHER'
sudo chmod +x /usr/local/bin/ecolav-completo

# 6. Criar ícone desktop
echo "🖼️  [6/7] Criando ícone no desktop..."
cat > ~/Desktop/ECOLAV-Totem.desktop << 'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=ECOLAV Totem
Comment=Sistema Ecolav - Servidor + App
Exec=/usr/local/bin/ecolav-completo
Icon=/usr/share/icons/hicolor/256x256/apps/ecolav-totem.png
Terminal=false
Categories=Utility;Application;
StartupNotify=false
DESKTOP
chmod +x ~/Desktop/ECOLAV-Totem.desktop
sudo cp ~/Desktop/ECOLAV-Totem.desktop /usr/share/applications/

# 7. Finalizar
echo "✅ [7/7] Finalizando..."
echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ INSTALAÇÃO CONCLUÍDA!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"
echo ""
echo "🖱️  CLIQUE NO ÍCONE: 'ECOLAV Totem' no desktop"
echo ""
echo "Ou execute: ecolav-completo"
echo ""
echo "📊 Ver logs: tail -f /var/log/ecolav/scale-server.log"
echo "🧪 Testar: curl http://localhost:3001/scale/weight"
echo ""
echo "════════════════════════════════════════════════════════"
