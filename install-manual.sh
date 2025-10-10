#!/bin/bash

##############################################################################
# ECOLAV Totem - Instalação Manual Passo a Passo
# Use este script se o install-ubuntu.sh travar
##############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶${NC} $1"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    read -p "Pressione ENTER para continuar..."
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   ECOLAV TOTEM - Instalação Manual Passo a Passo  ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "Este script instala MANUALMENTE, pausando a cada etapa."
echo "Use se o install-ubuntu.sh estiver travando."
echo ""

# Passo 1
print_step "PASSO 1: Corrigir repositórios"
sudo rm -f /etc/apt/sources.list.d/pgdg.list
sudo rm -f /etc/apt/sources.list.d/pgadmin4.list
sudo rm -f /etc/apt/sources.list.d/postgresql.list
print_success "Repositórios antigos removidos"

# Passo 2
print_step "PASSO 2: Atualizar sistema"
sudo apt update
print_success "Sistema atualizado"

# Passo 3
print_step "PASSO 3: Instalar webkit2gtk e javascriptcore"

# Detectar versão do Ubuntu
UBUNTU_VERSION=$(lsb_release -rs)
echo "Ubuntu $UBUNTU_VERSION detectado"

if [[ "$UBUNTU_VERSION" == "22.04" ]] || [[ "$UBUNTU_VERSION" == "24.04" ]]; then
    echo "Instalando versão 4.1 (Ubuntu 22.04+)..."
    sudo apt install -y \
        libwebkit2gtk-4.1-0 \
        libwebkit2gtk-4.1-dev \
        libjavascriptcoregtk-4.1-0 \
        libjavascriptcoregtk-4.1-dev \
        libsoup-3.0-0 \
        libsoup-3.0-dev \
        libsoup2.4-1 \
        libsoup2.4-dev
else
    echo "Instalando versão 4.0 (Ubuntu 20.04)..."
    sudo apt install -y \
        libwebkit2gtk-4.0-dev \
        libwebkit2gtk-4.0-37 \
        libjavascriptcoregtk-4.0-dev \
        libsoup2.4-1 \
        libsoup2.4-dev
fi
print_success "webkit2gtk, javascriptcore e libsoup instalados"

# Passo 4
print_step "PASSO 4: Instalar GTK e dependências gráficas"
sudo apt install -y libgtk-3-dev librsvg2-dev
print_success "GTK instalado"

# Passo 5
print_step "PASSO 5: Instalar ferramentas de build"
sudo apt install -y build-essential pkg-config libssl-dev
print_success "Build tools instalados"

# Passo 6
print_step "PASSO 6: Instalar utilitários"
sudo apt install -y curl wget file git patchelf
print_success "Utilitários instalados"

# Passo 7
print_step "PASSO 7: Instalar libayatana-appindicator3"
sudo apt install -y libayatana-appindicator3-dev || sudo apt install -y libappindicator3-dev
print_success "AppIndicator instalado"

# Passo 8
print_step "PASSO 8: Verificar Node.js"
if command -v node &> /dev/null; then
    echo "Node.js já instalado: $(node --version)"
    print_success "Node.js OK"
else
    echo "Node.js NÃO encontrado. Instalando via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    print_success "Node.js instalado: $(node --version)"
fi

# Passo 9
print_step "PASSO 9: Verificar Rust"
if command -v cargo &> /dev/null; then
    echo "Rust já instalado: $(rustc --version)"
    print_success "Rust OK"
else
    echo "Rust NÃO encontrado. Instalando..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    print_success "Rust instalado: $(rustc --version)"
fi

# Passo 10
print_step "PASSO 10: Instalar dependências npm"
npm install
print_success "Dependências npm instaladas"

# Passo 11
print_step "PASSO 11: Compilar ECOLAV Totem (DEMORADO - pode levar 15 minutos)"
echo ""
echo "⚠️  ATENÇÃO: Esta etapa é MUITO DEMORADA!"
echo "    Pode levar de 10 a 20 minutos na primeira vez."
echo "    NÃO CANCELE, aguarde até o final."
echo ""
npm run tauri:build

if [ $? -eq 0 ]; then
    print_success "Compilação concluída!"
else
    print_error "Erro na compilação. Verifique as mensagens acima."
    exit 1
fi

# Passo 12
print_step "PASSO 12: Instalar pacote .deb"
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -n 1)
if [ -f "$DEB_FILE" ]; then
    sudo dpkg -i "$DEB_FILE"
    sudo apt --fix-broken install -y
    print_success "ECOLAV Totem instalado!"
else
    print_error "Arquivo .deb não encontrado"
    exit 1
fi

# Final
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║          ✓✓✓ INSTALAÇÃO CONCLUÍDA! ✓✓✓           ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "Para executar: ${GREEN}ecolav-totem${NC}"
echo ""

read -p "Deseja executar agora? (s/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    ecolav-totem &
    print_success "App iniciado!"
fi

