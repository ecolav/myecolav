# 🚀 Quick Start - Ubuntu

## Instalação Rápida (Recomendado)

```bash
# Clonar repositório
git clone https://github.com/ecolav/myecolav.git
cd myecolav

# Executar instalador automático
bash install-ubuntu.sh
```

**Pronto!** O script irá:
- ✅ Instalar todas as dependências
- ✅ Configurar Node.js e Rust
- ✅ Compilar o app
- ✅ Gerar pacotes .deb e AppImage
- ✅ Instalar o app no sistema

---

## Instalação Manual

### Pré-requisitos

```bash
# Dependências do sistema
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev pkg-config

# Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Compilar e Instalar

```bash
# Instalar dependências
npm install

# Compilar
npm run tauri:build

# Instalar pacote .deb
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb
```

---

## Executar

```bash
# Via terminal
ecolav-totem

# Ou buscar "ECOLAV Totem" no menu de aplicativos
```

---

## Modo Desenvolvimento

```bash
npm run tauri:dev
```

---

## 📚 Documentação Completa

Ver **[INSTALACAO_UBUNTU.md](INSTALACAO_UBUNTU.md)** para:
- Configuração de totem/quiosque
- Inicialização automática
- Calibração de touchscreen
- Troubleshooting
- Configuração de periféricos

---

## 🆘 Problemas?

```bash
# Verificar logs
journalctl -u ecolav-totem -f

# Reinstalar dependências
sudo apt --fix-broken install
```

---

## 📦 Arquivos Gerados

Após a compilação, os seguintes arquivos estarão disponíveis:

- **DEB** (Ubuntu/Debian): `src-tauri/target/release/bundle/deb/ecolav-totem_0.1.0_amd64.deb`
- **AppImage** (Portátil): `src-tauri/target/release/bundle/appimage/ecolav-totem_0.1.0_amd64.AppImage`
- **RPM** (Fedora/RedHat): `src-tauri/target/release/bundle/rpm/ecolav-totem-0.1.0-1.x86_64.rpm`

---

## 🔄 Atualizar

```bash
cd myecolav
git pull
npm install
npm run tauri:build
sudo dpkg -i src-tauri/target/release/bundle/deb/*.deb
```

