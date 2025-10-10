#!/bin/bash

##############################################################################
# ECOLAV Totem - Script de Correção de Repositórios
# 
# Este script remove repositórios problemáticos do PostgreSQL
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

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║   Correção de Repositórios - ECOLAV Totem         ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

print_step "Removendo repositórios problemáticos do PostgreSQL..."

# Remover repositórios do PostgreSQL
sudo rm -f /etc/apt/sources.list.d/pgdg.list 2>/dev/null || true
sudo rm -f /etc/apt/sources.list.d/pgadmin4.list 2>/dev/null || true
sudo rm -f /etc/apt/sources.list.d/postgresql.list 2>/dev/null || true

print_success "Repositórios do PostgreSQL removidos"

print_step "Limpando cache do APT..."
sudo apt clean
sudo rm -rf /var/lib/apt/lists/*
sudo mkdir -p /var/lib/apt/lists/partial

print_success "Cache limpo"

print_step "Atualizando repositórios..."
sudo apt update

if [ $? -eq 0 ]; then
    print_success "Repositórios atualizados com sucesso!"
    echo ""
    print_step "Agora você pode executar:"
    echo "  ${GREEN}bash install-ubuntu.sh${NC}"
    echo ""
else
    print_warning "Ainda há erros. Verifique manualmente:"
    echo "  ${YELLOW}sudo nano /etc/apt/sources.list${NC}"
    echo "  ${YELLOW}ls /etc/apt/sources.list.d/${NC}"
fi

