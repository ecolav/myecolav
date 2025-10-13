# 🏥 MyEcolav - Totem Cliente

Sistema de totem touch screen para clientes da Ecolav 360.

## 🚀 Instalação Ubuntu 20.04 LTS

**Para instalar em um totem Ubuntu 20.04:**

```bash
git clone https://github.com/ecolav/myecolav.git
cd myecolav
bash install-ubuntu20.sh
```

O script irá:
- ✅ Instalar todas as dependências (WebKit, GTK, GLib, Node.js, Rust)
- ✅ Compilar o projeto (Tauri 1.x compatível com Ubuntu 20.04)
- ✅ Gerar e instalar o pacote .deb
- ✅ Deixar o app pronto para usar

⏱️ **Tempo estimado:** 15-20 minutos (primeira vez)

## 🚀 Desenvolvimento (Web)

```bash
npm install
npm run dev
```

Acesse: `http://localhost:5173`

## 📖 Documentação Completa

**Leia:** [README_TOTEM_ECOLAV.md](README_TOTEM_ECOLAV.md)

Contém:
- ✅ Visão geral completa
- ✅ Todas as funcionalidades
- ✅ Guia de instalação
- ✅ Guia de uso passo a passo
- ✅ Integração com API
- ✅ Problemas e soluções
- ✅ Configuração de produção

## ⚙️ Configuração Rápida

1. **Abra Configurações** (⚙️)
2. **Aba Totem:**
   - Cliente: Selecione FIOCRUZ
   - Tipo: Área Limpa ou Suja
3. **Aba Balança:**
   - Modo: Mock (para testes)
4. **Voltar e testar!**

## 🎯 Funcionalidades

- 🔵 **Pesagem** - Rouparia com RFID (conectado à API real)
- 🟣 **ROLs Especiais** - Cadastro e rastreamento
- 🟪 **Distribuição & Pedidos** - Tela unificada (manual ou RFID)
- ⚙️ **Configurações** - Balança, RFID, Cliente

## 🆕 Última Atualização (10/10/2025)

✅ **Backend local removido** - Conecta direto em `pedidos.ecolav`  
✅ **Telas unificadas** - Distribuição & Pedidos em uma só tela  
✅ **Novos endpoints** - GET `/api/public/sectors` e POST `/api/public/totem/orders`  
✅ **Hook `useSectors`** - Carrega setores do servidor  
✅ **Pronto para produção**

## 📊 Status

✅ **Build:** Zero erros  
✅ **API:** Conectada ao servidor real  
✅ **Console:** Limpo  
✅ **Pronto:** Para produção

## 🐧 Compatibilidade Ubuntu

| Ubuntu Version | Tauri | Status | Instalação |
|---------------|-------|--------|------------|
| **20.04 LTS** | 1.8.x | ✅ Compatível | `bash install-ubuntu20.sh` |
| **22.04 LTS** | 1.x ou 2.x | ✅ Compatível | `bash install-ubuntu.sh` |
| **24.04 LTS** | 1.x ou 2.x | ✅ Compatível | `bash install-ubuntu.sh` |

**Nota:** Este projeto usa Tauri 1.x para garantir compatibilidade com Ubuntu 20.04 (GLib 2.64).

## 📚 Documentação Adicional

- 📖 [INSTALACAO_UBUNTU_20.04.md](INSTALACAO_UBUNTU_20.04.md) - Guia completo Ubuntu 20.04
- 📖 [INSTALACAO_UBUNTU.md](INSTALACAO_UBUNTU.md) - Guia Ubuntu 22.04+
- 📖 [README_TOTEM_ECOLAV.md](README_TOTEM_ECOLAV.md) - Documentação completa do sistema

---

**Versão:** 1.0.0 (Tauri 1.x)  
**Data:** 2025-10-13  
**Desenvolvido para:** Ecolav 360

