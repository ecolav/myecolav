# 📝 CHANGELOG - MyEcolav Totem

## [1.1.0] - 2025-10-10

### ✅ Adicionado

#### Backend (pedidos.ecolav)
- **GET `/api/public/sectors`** - Endpoint público para carregar setores por clientId
- **POST `/api/public/totem/orders`** - Endpoint público para criar pedidos/solicitações de enxoval

#### Frontend (myecolav)
- **`useSectors` hook** - Hook para carregar setores da API
- **`DistributionAndOrdersScreen`** - Tela unificada para distribuição e pedidos
  - Modos: Distribuir Enxoval ou Solicitar Itens
  - Input: Manual ou RFID Automático
  - Formulário simplificado com 4 passos
  - Feedback visual de sucesso/erro
  
### 🔄 Modificado

#### Frontend
- **`DashboardScreen`** - Atualizado para usar tile único "Distribuição & Pedidos"
  - Ícone `Package` com gradient roxo
  - Filtro correto por tipo de totem (dirty/clean)
  
- **`App.tsx`** - Rotas atualizadas
  - Casos `distribution` e `distribution-orders` direcionam para `DistributionAndOrdersScreen`
  - Removidas importações de `DistributionScreen` e `RequestsScreen`

- **Configurações padrão** (`useSettings.ts`) - Já estavam corretas:
  - `scale.mode: 'mock'` (evita erros sem hardware)
  - `server.baseUrl: 'http://162.240.227.159:4000'`
  - `server.apiKey: 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea'`
  - `totem.type: 'dirty'`

### ❌ Removido

#### Frontend
- **`backend/`** - Pasta backend local (duplicado e desnecessário)
  - SQLite local não é mais usado
  - Prisma schema local removido
  - Scripts de backend local removidos do `package.json`

- **Telas antigas separadas:**
  - `DistributionScreen.tsx` (funcionalidade mantida na tela unificada)
  - `RequestsScreen.tsx` (funcionalidade mantida na tela unificada)

### 🐛 Corrigido

#### API
- **404 em `/api/public/sectors`** - Endpoint agora existe
- **404 em `/api/public/totem/orders`** - Endpoint agora existe
- **Setores não carregavam** - Agora carrega do servidor via `useSectors`
- **Pedidos falhavam** - Agora usa endpoint correto

#### Frontend
- **Dados não salvavam** - Agora conecta no servidor real
- **Backend duplicado** - Removido, só usa pedidos.ecolav
- **Telas fragmentadas** - Unificadas em uma interface coerente

---

## [1.0.0] - 2025-10-09

### ✅ Versão Inicial

- Tela de Dashboard
- Tela de Pesagem (formato tabela para RFID)
- Tela de Distribuição (separada)
- Tela de Solicitações (separada)
- Tela de ROLs Especiais
- Tela de Configurações
- Hook `useScaleReader` (mock/RS232/USB/TCP)
- Hook `useSettings`
- Hook `useClients`
- Hook `useRequests`
- Hook `useDistribution`
- Integração básica com API

---

## 📊 Resumo das Mudanças

| Item | Antes | Depois |
|------|-------|--------|
| **Backend** | Local (SQLite) | Apenas remoto (MySQL) |
| **Distribuição** | Tela separada | Tela unificada com pedidos |
| **Pedidos** | Tela separada | Tela unificada com distribuição |
| **Setores** | Fallback (derivado) | Endpoint real `/api/public/sectors` |
| **Orders** | Sem endpoint | Endpoint `/api/public/totem/orders` |
| **Dashboard** | 2 tiles separados | 1 tile unificado |
| **Arquitetura** | Frontend + Backend | Frontend conecta direto no pedidos.ecolav |

---

## 🎯 Próximos Passos

### Curto Prazo
- [ ] Testar em produção com clientes reais
- [ ] Implementar modo RFID real (hardware)
- [ ] Ajustar UI conforme feedback do usuário

### Médio Prazo
- [ ] Adicionar relatórios de pesagem no totem
- [ ] Implementar sincronização offline
- [ ] Adicionar notificações push

### Longo Prazo
- [ ] Integração com impressora térmica
- [ ] Dashboard de gestão para administradores
- [ ] App mobile para gestores

---

**Para ver a lógica completa do sistema, consulte:**
- 📋 `LOGICA_TOTEM_CENTRAL.md` - Documentação técnica completa
- 📊 `RESUMO_EXECUTIVO.md` - Visão executiva rápida
- 📖 `README_TOTEM_ECOLAV.md` - Guia do usuário


