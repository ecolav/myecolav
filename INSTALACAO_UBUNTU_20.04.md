# 🐧 Instalação no Ubuntu 20.04 LTS

## ⚠️ Importante: Compatibilidade

Este projeto usa **Tauri 1.x** para compatibilidade com **Ubuntu 20.04**.

- ✅ **Ubuntu 20.04** → Tauri 1.x (GLib 2.64)
- ✅ **Ubuntu 22.04+** → Tauri 2.x ou 1.x (GLib 2.72+)

---

## 🚀 Instalação Rápida (Ubuntu 20.04)

### 1. Clonar o Repositório

```bash
git clone https://github.com/ecolav/myecolav.git
cd myecolav
```

### 2. Instalar Dependências do Sistema

```bash
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.0-dev \
    libwebkit2gtk-4.0-37 \
    libjavascriptcoregtk-4.0-dev \
    libgtk-3-dev \
    libglib2.0-dev \
    libglib2.0-0 \
    libgirepository1.0-dev \
    libgdk-pixbuf2.0-dev \
    libcairo2-dev \
    libpango1.0-dev \
    librsvg2-dev \
    libayatana-appindicator3-dev \
    patchelf \
    libssl-dev \
    build-essential \
    curl wget file git pkg-config
```

### 3. Instalar Node.js (se não tiver)

```bash
# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Instalar Node.js 18
nvm install 18
nvm use 18
```

### 4. Instalar Rust (se não tiver)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 5. Instalar Dependências npm

```bash
npm install
```

### 6. Compilar o Projeto

```bash
npm run tauri:build
```

**⏱️ Primeira compilação:** 10-15 minutos

### 7. Instalar o Pacote .deb

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/ecolav-totem_0.1.0_amd64.deb
sudo apt --fix-broken install -y
```

### 8. Executar o Aplicativo

```bash
ecolav-totem
```

---

## 📦 Versões do Projeto

| Componente | Versão Ubuntu 20.04 |
|------------|---------------------|
| Tauri | 1.8.x |
| Tauri Build | 1.5.x |
| Tauri API | 1.5.x |
| Node.js | 18+ |
| Rust | 1.70+ |

---

## 🔧 Configuração do Projeto

O projeto está configurado para Ubuntu 20.04 com:

### `package.json`
```json
{
  "dependencies": {
    "@tauri-apps/api": "^1.5.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^1.5.0"
  }
}
```

### `src-tauri/Cargo.toml`
```toml
[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.6", features = ["api-all"] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

---

## 🆘 Troubleshooting

### Erro: "gobject-2.0 not found"
```bash
sudo apt install -y libglib2.0-dev pkg-config
```

### Erro: "webkit2gtk not found"
```bash
sudo apt install -y libwebkit2gtk-4.0-dev
```

### Erro de compilação
```bash
cd src-tauri
cargo clean
cd ..
npm run tauri:build
```

---

## 📊 Comparação de Versões

| Ubuntu Version | GLib | Tauri Compatível | Status |
|---------------|------|------------------|--------|
| 20.04 LTS | 2.64 | 1.x | ✅ Este projeto |
| 22.04 LTS | 2.72 | 1.x ou 2.x | ✅ |
| 24.04 LTS | 2.80 | 1.x ou 2.x | ✅ |

---

## 🔄 Para Atualizar para Tauri 2.x (Ubuntu 22.04+)

Se estiver em Ubuntu 22.04 ou superior, pode atualizar:

```bash
# Atualizar package.json
npm install @tauri-apps/api@^2.8.0 @tauri-apps/cli@^2 --save-dev

# Atualizar Cargo.toml
# Mudar tauri = "1.6" para tauri = "2.8"
# Mudar tauri-build = "1.5" para tauri-build = "2.4"

# Recompilar
npm run tauri:build
```

---

## 📝 Arquivos Gerados

Após compilação bem-sucedida:

- **DEB:** `src-tauri/target/release/bundle/deb/ecolav-totem_0.1.0_amd64.deb`
- **RPM:** `src-tauri/target/release/bundle/rpm/ecolav-totem-0.1.0-1.x86_64.rpm`

---

## ⚙️ Configuração de Totem em Produção

Ver arquivo: [INSTALACAO_UBUNTU.md](INSTALACAO_UBUNTU.md)

- Inicialização automática
- Modo quiosque/kiosk
- Calibração touchscreen
- Configuração de periféricos

---

**Versão:** 1.0 (Ubuntu 20.04 compatível)  
**Data:** 2025-10-13  
**Tauri:** 1.8.x

