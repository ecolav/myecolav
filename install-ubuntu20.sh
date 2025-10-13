#!/bin/bash

##############################################################################
# ECOLAV Totem - Instalação Automática Ubuntu 20.04
# 
# Este script instala e compila o ECOLAV Totem no Ubuntu 20.04 LTS
# Usa Tauri 1.x (compatível com GLib 2.64)
##############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║     ECOLAV TOTEM - Instalador Ubuntu 20.04        ║"
echo "║            (Tauri 1.x - Compatível)               ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Verificar Ubuntu
if [ ! -f /etc/lsb-release ]; then
    print_error "Este script é para Ubuntu"
    exit 1
fi

source /etc/lsb-release
print_step "Sistema: $DISTRIB_DESCRIPTION"

# Verificar se é root
if [ "$EUID" -eq 0 ]; then 
    print_error "NÃO execute como root (sem sudo)"
    print_warning "O script pedirá senha quando necessário"
    exit 1
fi

# 1. Atualizar repositórios
print_step "1/8 - Atualizando repositórios..."
sudo apt update || {
    print_warning "Erro ao atualizar. Removendo repos problemáticos..."
    sudo rm -f /etc/apt/sources.list.d/pgdg.list 2>/dev/null || true
    sudo rm -f /etc/apt/sources.list.d/pgadmin4.list 2>/dev/null || true
    sudo apt update
}
print_success "Repositórios atualizados"

# 2. Instalar dependências WebKit e GTK (Ubuntu 20.04)
print_step "2/8 - Instalando WebKit e GTK (Ubuntu 20.04)..."
sudo apt install -y \
    libwebkit2gtk-4.0-dev \
    libwebkit2gtk-4.0-37 \
    libjavascriptcoregtk-4.0-dev \
    gir1.2-javascriptcoregtk-4.0 \
    libsoup2.4-1 \
    libsoup2.4-dev
print_success "WebKit instalado"

# 3. Instalar dependências GLib/GObject
print_step "3/8 - Instalando GLib/GObject..."
sudo apt install -y \
    libglib2.0-dev \
    libglib2.0-0 \
    libgirepository1.0-dev \
    pkg-config
print_success "GLib instalado"

# 4. Instalar dependências GTK
print_step "4/8 - Instalando GTK e componentes..."
sudo apt install -y \
    libgtk-3-dev \
    libgtk-3-0 \
    libgdk-pixbuf2.0-dev \
    libcairo2-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libayatana-appindicator3-dev
print_success "GTK instalado"

# 5. Instalar ferramentas de build
print_step "5/8 - Instalando ferramentas de build..."
sudo apt install -y \
    build-essential \
    libssl-dev \
    patchelf \
    curl wget file git
print_success "Build tools instalados"

# 6. Verificar/Instalar Node.js
print_step "6/8 - Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js já instalado: $NODE_VERSION"
else
    print_warning "Node.js não encontrado. Instalando via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 18
    nvm use 18
    print_success "Node.js instalado: $(node --version)"
fi

# 7. Verificar/Instalar Rust
print_step "7/8 - Verificando Rust..."
if command -v cargo &> /dev/null; then
    RUST_VERSION=$(rustc --version)
    print_success "Rust já instalado: $RUST_VERSION"
else
    print_warning "Rust não encontrado. Instalando..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    print_success "Rust instalado: $(rustc --version)"
fi

# 8. Instalar dependências npm e compilar
print_step "8/8 - Instalando dependências e compilando..."

if [ ! -d "node_modules" ]; then
    npm install
    print_success "Dependências npm instaladas"
else
    print_success "Dependências npm já instaladas"
fi

print_step "Compilando ECOLAV Totem (pode demorar 10-15 minutos)..."
echo ""
print_warning "⏱️  Aguarde... Primeira compilação é demorada!"
echo ""

npm run tauri:build

if [ $? -eq 0 ]; then
    print_success "Compilação concluída!"
else
    print_error "Erro na compilação"
    exit 1
fi

# Instalar pacote .deb
print_step "Instalando pacote .deb..."
DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" | head -n 1)

if [ -f "$DEB_FILE" ]; then
    sudo dpkg -i "$DEB_FILE"
    sudo apt --fix-broken install -y
    print_success "ECOLAV Totem instalado!"
else
    print_error "Arquivo .deb não encontrado"
    exit 1
fi

# Informações finais
echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║         ✓✓✓ INSTALAÇÃO CONCLUÍDA! ✓✓✓            ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

print_step "📦 Arquivos gerados:"
echo "  • DEB: $DEB_FILE"
echo ""

print_step "🚀 Para executar:"
echo "  ${GREEN}ecolav-totem${NC}"
echo ""

print_step "📋 Ou procure no menu de aplicativos:"
echo "  'ECOLAV Totem'"
echo ""

print_step "⚙️ Configurações:"
echo "  Ver: ${YELLOW}INSTALACAO_UBUNTU.md${NC}"
echo ""

print_step "📊 Versões instaladas:"
echo "  • Tauri: 1.8.x (compatível Ubuntu 20.04)"
echo "  • Node.js: $(node --version)"
echo "  • Rust: $(rustc --version | cut -d' ' -f2)"
echo ""

# Perguntar se deseja executar
read -p "Deseja executar o ECOLAV Totem agora? (s/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_step "Iniciando ECOLAV Totem..."
    ecolav-totem &
    print_success "App iniciado!"
fi

print_success "Instalação concluída! 🎉"
echo ""

