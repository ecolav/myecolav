# 🐧 Instalação e Execução no Ubuntu

Este guia explica como instalar e executar o **ECOLAV Totem** no Ubuntu Linux.

---

## 📋 Pré-requisitos

### 1. Instalar dependências do sistema

```bash
# Atualizar repositórios
sudo apt update

# Instalar dependências do Tauri
sudo apt install -y \
  libwebkit2gtk-4.1-0 \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  build-essential \
  curl \
  wget \
  file

# Instalar Node.js (via nvm - recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# Verificar instalação
node --version  # deve mostrar v20.x.x
npm --version   # deve mostrar 10.x.x
```

### 2. Instalar Rust

```bash
# Instalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Configurar PATH (adicionar ao ~/.bashrc)
source $HOME/.cargo/env

# Verificar instalação
rustc --version
cargo --version
```

---

## 📥 Baixar o Projeto

### Opção 1: Clone via Git

```bash
# Clonar repositório
git clone https://github.com/ecolav/myecolav.git
cd myecolav

# Instalar dependências
npm install
```

### Opção 2: Download ZIP

```bash
# Baixar e extrair
wget https://github.com/ecolav/myecolav/archive/refs/heads/main.zip
unzip main.zip
cd myecolav-main

# Instalar dependências
npm install
```

---

## 🚀 Executar o App

### Modo Desenvolvimento

```bash
# Executar em modo desenvolvimento
npm run tauri:dev
```

Isso irá:
- Compilar o frontend React
- Compilar o backend Rust
- Abrir a janela do app automaticamente
- Recarregar automaticamente quando você fizer alterações

### Build de Produção

```bash
# Gerar pacotes de instalação
npm run tauri:build
```

Isso irá gerar:
- **DEB** (Debian/Ubuntu): `src-tauri/target/release/bundle/deb/ecolav-totem_0.1.0_amd64.deb`
- **AppImage**: `src-tauri/target/release/bundle/appimage/ecolav-totem_0.1.0_amd64.AppImage`
- **RPM** (Fedora/RedHat): `src-tauri/target/release/bundle/rpm/ecolav-totem-0.1.0-1.x86_64.rpm`

---

## 📦 Instalar o Pacote

### Instalar .deb (Ubuntu/Debian)

```bash
# Instalar o pacote DEB
sudo dpkg -i src-tauri/target/release/bundle/deb/ecolav-totem_0.1.0_amd64.deb

# Se houver erros de dependência, corrija com:
sudo apt --fix-broken install

# Executar o app instalado
ecolav-totem
```

### Executar AppImage (Portátil - sem instalação)

```bash
# Dar permissão de execução
chmod +x src-tauri/target/release/bundle/appimage/ecolav-totem_0.1.0_amd64.AppImage

# Executar
./src-tauri/target/release/bundle/appimage/ecolav-totem_0.1.0_amd64.AppImage
```

---

## ⚙️ Configuração para Totem

### 1. Configurar Inicialização Automática

Criar arquivo de serviço systemd:

```bash
sudo nano /etc/systemd/system/ecolav-totem.service
```

Conteúdo:

```ini
[Unit]
Description=ECOLAV Totem
After=graphical.target

[Service]
Type=simple
User=totem
Environment=DISPLAY=:0
ExecStart=/usr/bin/ecolav-totem
Restart=always
RestartSec=10

[Install]
WantedBy=graphical.target
```

Ativar o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ecolav-totem
sudo systemctl start ecolav-totem
```

### 2. Configurar Modo Quiosque (Kiosk)

Instalar Openbox (gerenciador de janelas leve):

```bash
sudo apt install -y openbox xorg

# Criar script de inicialização
mkdir -p ~/.config/openbox
nano ~/.config/openbox/autostart
```

Conteúdo:

```bash
#!/bin/bash

# Desabilitar protetor de tela
xset s off
xset -dpms
xset s noblank

# Ocultar cursor do mouse após 5 segundos
unclutter -idle 5 &

# Executar app em tela cheia
ecolav-totem --fullscreen
```

Dar permissão:

```bash
chmod +x ~/.config/openbox/autostart
```

### 3. Configurar Tela Touch Screen

```bash
# Instalar ferramentas de calibração
sudo apt install -y xinput-calibrator

# Calibrar touchscreen (seguir instruções na tela)
xinput_calibrator

# Testar touchscreen
xinput list  # Ver dispositivos
xinput test <ID>  # Substituir <ID> pelo ID do touchscreen
```

---

## 🔧 Troubleshooting

### Erro: "webkit2gtk not found"

```bash
sudo apt install -y libwebkit2gtk-4.1-0 libwebkit2gtk-4.1-dev
```

### Erro: "cargo not found"

```bash
# Reinstalar Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Erro: "failed to run custom build command"

```bash
# Instalar dependências de build
sudo apt install -y build-essential pkg-config libssl-dev
```

### Erro de Permissão Serial (Balança RS232)

```bash
# Adicionar usuário ao grupo dialout
sudo usermod -a -G dialout $USER

# Relogar ou executar:
newgrp dialout
```

### App não inicia em tela cheia

```bash
# Editar tauri.conf.json antes de compilar
# Alterar "fullscreen": true em app.windows
```

---

## 🖥️ Configuração Recomendada para Totem

### Hardware
- **Monitor**: Touch Screen 15.6" (1366x768)
- **RAM**: Mínimo 2GB, recomendado 4GB
- **CPU**: Dual-core ou superior
- **Storage**: 8GB livres

### Ubuntu
- **Versão**: Ubuntu 22.04 LTS ou 24.04 LTS
- **Interface**: Gnome ou XFCE (leve)
- **Boot**: Automático sem senha

### Periféricos
- **Balança**: USB, RS232 ou TCP/IP
- **Leitor RFID**: USB (emula teclado)
- **Impressora**: USB ou Rede (opcional)

---

## 🔄 Atualizar o App

### Via Git

```bash
cd myecolav
git pull origin main
npm install
npm run tauri:build
sudo dpkg -i src-tauri/target/release/bundle/deb/ecolav-totem_0.1.0_amd64.deb
```

### Via Download

```bash
# Baixar nova versão
wget https://github.com/ecolav/myecolav/releases/latest/download/ecolav-totem_amd64.deb

# Instalar
sudo dpkg -i ecolav-totem_amd64.deb
```

---

## 📱 Comandos Rápidos

```bash
# Desenvolvimento
npm run tauri:dev

# Build
npm run tauri:build

# Instalar
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb

# Executar
ecolav-totem

# Ver logs
journalctl -u ecolav-totem -f

# Reiniciar serviço
sudo systemctl restart ecolav-totem

# Parar serviço
sudo systemctl stop ecolav-totem

# Status
sudo systemctl status ecolav-totem
```

---

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verificar logs: `journalctl -u ecolav-totem`
2. Verificar conexão: Settings → Servidor → Testar conexão
3. Verificar configurações: `~/.local/share/com.ecolav.totem/`
4. Abrir issue no GitHub: https://github.com/ecolav/myecolav/issues

---

## 📄 Licença

Ver arquivo LICENSE no repositório.

