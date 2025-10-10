#!/bin/bash

##############################################################################
# Fix JavaScriptCore - Instala a biblioteca faltante
##############################################################################

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

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║     Fix JavaScriptCore GTK - ECOLAV Totem         ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Detectar versão do Ubuntu
UBUNTU_VERSION=$(lsb_release -rs)
print_step "Ubuntu $UBUNTU_VERSION detectado"

# Instalar baseado na versão
if [[ "$UBUNTU_VERSION" == "22.04" ]] || [[ "$UBUNTU_VERSION" == "24.04" ]] || [[ "$UBUNTU_VERSION" > "22.04" ]]; then
    print_step "Instalando javascriptcoregtk-4.1 (Ubuntu 22.04+)..."
    sudo apt update
    sudo apt install -y \
        libwebkit2gtk-4.1-0 \
        libwebkit2gtk-4.1-dev \
        libjavascriptcoregtk-4.1-0 \
        libjavascriptcoregtk-4.1-dev \
        gir1.2-javascriptcoregtk-4.1
    print_success "javascriptcoregtk-4.1 instalado!"
    
elif [[ "$UBUNTU_VERSION" == "20.04" ]]; then
    print_step "Instalando javascriptcoregtk-4.0 (Ubuntu 20.04)..."
    sudo apt update
    sudo apt install -y \
        libwebkit2gtk-4.0-dev \
        libwebkit2gtk-4.0-37 \
        libjavascriptcoregtk-4.0-dev \
        gir1.2-javascriptcoregtk-4.0
    print_success "javascriptcoregtk-4.0 instalado!"
    
else
    print_step "Versão não reconhecida. Tentando instalar 4.0..."
    sudo apt update
    sudo apt install -y \
        libwebkit2gtk-4.0-dev \
        libjavascriptcoregtk-4.0-dev
    print_success "javascriptcoregtk instalado!"
fi

echo ""
print_step "Verificando instalação..."

# Verificar se pkg-config encontra a biblioteca
if pkg-config --exists javascriptcoregtk-4.1 2>/dev/null; then
    print_success "javascriptcoregtk-4.1 encontrado!"
    echo "  Versão: $(pkg-config --modversion javascriptcoregtk-4.1)"
elif pkg-config --exists javascriptcoregtk-4.0 2>/dev/null; then
    print_success "javascriptcoregtk-4.0 encontrado!"
    echo "  Versão: $(pkg-config --modversion javascriptcoregtk-4.0)"
else
    echo ""
    echo "⚠️  Aviso: pkg-config não encontrou javascriptcoregtk"
    echo "   Mas isso pode ser normal. Tente compilar mesmo assim."
fi

echo ""
print_success "Correção aplicada!"
echo ""
print_step "Agora você pode tentar compilar novamente:"
echo "  ${GREEN}npm run tauri:build${NC}"
echo ""

