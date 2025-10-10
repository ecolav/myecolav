#!/bin/bash

##############################################################################
# ECOLAV Totem - Script de Instalação Automática para Ubuntu
# 
# Este script instala todas as dependências e compila o app ECOLAV Totem
# 
# Uso: bash install-ubuntu.sh
##############################################################################

set -e  # Parar em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de utilidade
print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Verificar se está rodando no Ubuntu
if [ ! -f /etc/lsb-release ]; then
    print_error "Este script foi feito para Ubuntu. Outras distros podem não funcionar corretamente."
    exit 1
fi

source /etc/lsb-release
print_step "Sistema detectado: $DISTRIB_DESCRIPTION"

# Banner
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║         ECOLAV TOTEM - Instalador Ubuntu          ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then 
    print_error "Não execute este script como root (sem sudo)"
    print_warning "O script irá solicitar senha quando necessário"
    exit 1
fi

# 1. Atualizar sistema
print_step "1/7 - Atualizando repositórios do sistema..."

# Tentar atualizar normalmente
if ! sudo apt update 2>&1; then
    print_warning "Erro ao atualizar repositórios. Tentando corrigir..."
    
    # Remover repositórios problemáticos do PostgreSQL
    print_step "Removendo repositórios antigos do PostgreSQL..."
    sudo rm -f /etc/apt/sources.list.d/pgdg.list 2>/dev/null || true
    sudo rm -f /etc/apt/sources.list.d/pgadmin4.list 2>/dev/null || true
    sudo rm -f /etc/apt/sources.list.d/postgresql.list 2>/dev/null || true
    
    # Tentar novamente
    print_step "Tentando atualizar novamente..."
    sudo apt update
fi

print_success "Repositórios atualizados"

# 2. Instalar dependências do Tauri
print_step "2/7 - Instalando dependências do Tauri (isso pode demorar alguns minutos)..."

# Detectar versão do Ubuntu
UBUNTU_VERSION=$(lsb_release -rs)
print_step "Ubuntu $UBUNTU_VERSION detectado"

# Instalar webkit baseado na versão
if [[ "$UBUNTU_VERSION" == "22.04" ]] || [[ "$UBUNTU_VERSION" == "24.04" ]]; then
    print_step "Instalando webkit2gtk-4.1 e javascriptcore-4.1 (Ubuntu 22.04+)..."
    sudo apt install -y \
        libwebkit2gtk-4.1-0 \
        libwebkit2gtk-4.1-dev \
        libjavascriptcoregtk-4.1-0 \
        libjavascriptcoregtk-4.1-dev
    print_success "webkit2gtk-4.1 instalado"
else
    print_step "Instalando webkit2gtk-4.0 e javascriptcore-4.0 (Ubuntu 20.04)..."
    sudo apt install -y \
        libwebkit2gtk-4.0-dev \
        libwebkit2gtk-4.0-37 \
        libjavascriptcoregtk-4.0-dev
    print_success "webkit2gtk-4.0 instalado"
fi

# Instalar outras dependências
print_step "Instalando outras dependências..."
sudo apt install -y \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    libssl-dev \
    build-essential \
    curl \
    wget \
    file \
    pkg-config \
    git

print_success "Dependências do Tauri instaladas"

# 3. Verificar/Instalar Node.js
print_step "3/7 - Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js já instalado: $NODE_VERSION"
else
    print_warning "Node.js não encontrado. Instalando via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    print_success "Node.js instalado: $(node --version)"
fi

# 4. Verificar/Instalar Rust
print_step "4/7 - Verificando Rust..."
if command -v cargo &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    print_success "Rust já instalado: $RUST_VERSION"
else
    print_warning "Rust não encontrado. Instalando..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    print_success "Rust instalado: $(rustc --version)"
fi

# 5. Instalar dependências npm
print_step "5/7 - Instalando dependências do projeto..."
if [ ! -d "node_modules" ]; then
    npm install
    print_success "Dependências npm instaladas"
else
    print_success "Dependências npm já instaladas"
fi

# 6. Compilar o app
print_step "6/7 - Compilando ECOLAV Totem (isso pode demorar alguns minutos)..."
echo ""
print_warning "Primeira compilação pode levar 10-15 minutos..."
npm run tauri:build

if [ $? -eq 0 ]; then
    print_success "Compilação concluída com sucesso!"
else
    print_error "Erro na compilação. Verifique as mensagens acima."
    exit 1
fi

# 7. Instalar o pacote
print_step "7/7 - Instalando ECOLAV Totem..."
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -n 1)

if [ -f "$DEB_FILE" ]; then
    sudo dpkg -i "$DEB_FILE"
    sudo apt --fix-broken install -y
    print_success "ECOLAV Totem instalado com sucesso!"
else
    print_error "Arquivo .deb não encontrado"
    exit 1
fi

# Verificar instalação
echo ""
print_step "Verificando instalação..."
if command -v ecolav-totem &> /dev/null; then
    print_success "Comando 'ecolav-totem' disponível"
fi

# Informações finais
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║            ✓ Instalação Concluída!                ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
print_step "Arquivos gerados:"
echo "  • DEB:      $DEB_FILE"
echo "  • AppImage: $(find src-tauri/target/release/bundle/appimage -name "*.AppImage" | head -n 1)"
echo ""
print_step "Para executar o app:"
echo "  ${GREEN}ecolav-totem${NC}"
echo ""
print_step "Ou pelo menu de aplicativos:"
echo "  Procure por 'ECOLAV Totem'"
echo ""
print_step "Configurações avançadas:"
echo "  Ver arquivo: ${YELLOW}INSTALACAO_UBUNTU.md${NC}"
echo ""
print_step "Logs do sistema:"
echo "  ${YELLOW}journalctl -u ecolav-totem -f${NC}"
echo ""

# Perguntar se deseja executar agora
read -p "Deseja executar o ECOLAV Totem agora? (s/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_step "Iniciando ECOLAV Totem..."
    ecolav-totem &
    print_success "App iniciado!"
fi

print_success "Instalação concluída! 🎉"

