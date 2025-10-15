# 🚀 CRIAR RELEASE NO GITHUB - PASSO A PASSO

## ✅ STATUS ATUAL
- Código no GitHub: ✅ Atualizado (commit 6193dc3)
- .deb pronto: ✅ `/home/idtrack/myecolav/release-20251015-135211/ecolav-totem_0.1.0_amd64.deb` (5.3 MB)

---

## 📤 CRIAR RELEASE (5 minutos)

### PASSO 1: Acesse
```
https://github.com/ecolav/myecolav/releases/new
```

### PASSO 2: Preencha os campos

**Choose a tag:**
```
v0.1.0-20251015
```
(Digite e clique em "Create new tag: v0.1.0-20251015 on publish")

**Release title:**
```
Release 2025-10-15 - Correções Balança e Layout
```

**Describe this release:**
```markdown
## 🏥 MyEcolav Totem - Release 2025-10-15

### ✅ Correções e Melhorias

#### 🔧 Servidor da Balança
- ✅ Suporte completo aos códigos `F` (fixo), `D` (dinâmico), `H` e `L`
- ✅ Auto-start automático do servidor junto com o app Tauri
- ✅ Leitura em tempo real via porta serial `/dev/ttyS0`

#### ⚖️ Cálculo de Peso
- ✅ Correção: Total agora mostra peso **líquido** (sem tara das gaiolas)
- ✅ Label atualizado para "TOTAL LÍQUIDO"

#### 🎨 Interface Otimizada para Totem 15"
- ✅ Tabelas 40% mais compactas (320px → 192px)
- ✅ Campos touch-friendly (48px de altura)
- ✅ Tabela de gaiolas simplificada (6 → 4 colunas)
- ✅ Botões maiores e mais visíveis

### 📦 Instalação

**Ubuntu 20.04 LTS:**
```bash
wget https://github.com/ecolav/myecolav/releases/download/v0.1.0-20251015/ecolav-totem_0.1.0_amd64.deb
sudo dpkg -i ecolav-totem_0.1.0_amd64.deb
```

**Se precisar de dependências:**
```bash
sudo apt-get install -f
```

### 🚀 Como Usar

1. Execute o aplicativo pelo ícone no desktop ou: `ecolav-totem`
2. Configure em Configurações (⚙️):
   - Cliente (FIOCRUZ)
   - Tipo de totem (Limpa/Suja)
   - Porta serial da balança
3. O servidor da balança inicia automaticamente
4. Use a tela de pesagem normalmente

---

**Versão:** 0.1.0  
**Data:** 2025-10-15  
**Plataforma:** Ubuntu 20.04 LTS
```

### PASSO 3: Anexar o .deb

Na seção "Attach binaries by dropping them here or selecting them"

**Arraste ou selecione:**
```
/home/idtrack/myecolav/release-20251015-135211/ecolav-totem_0.1.0_amd64.deb
```

### PASSO 4: Publicar

Clique no botão verde: **"Publish release"**

---

## 🎉 PRONTO!

Após publicar, o .deb estará disponível em:
```
https://github.com/ecolav/myecolav/releases/tag/v0.1.0-20251015
```

Para instalar em qualquer máquina:
```bash
wget https://github.com/ecolav/myecolav/releases/download/v0.1.0-20251015/ecolav-totem_0.1.0_amd64.deb
sudo dpkg -i ecolav-totem_0.1.0_amd64.deb
```

---

**✅ Tudo pronto para publicar!**
