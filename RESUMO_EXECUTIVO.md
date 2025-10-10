# 📋 RESUMO EXECUTIVO - TOTEM MYECOLAV

**Data:** 10/10/2025  
**Documento Completo:** Ver `LOGICA_TOTEM_CENTRAL.md`

---

## 🎯 O QUE É O TOTEM?

Interface de **ENTRADA DE DADOS** em monitor touch 15.6" para:
1. ⚖️ Pesar roupa suja do cliente
2. 📦 Distribuir enxoval limpo
3. 🛒 Solicitar itens extras
4. 🎯 Gerenciar ROLs especiais

---

## 🔄 ARQUITETURA

```
TOTEM (myecolav)
    ├── Frontend: React + Tauri
    ├── Hardware: Balança + RFID
    └── Interface: Touch 15.6"
         │
         │ x-api-key (API REST)
         ▼
ENTREGAS.ECOLAV (pedidos.ecolav)
    ├── Backend: Node + Express
    ├── Database: MySQL (162.240.227.159)
    └── Gestão: Dashboard Web
```

---

## ✅ O QUE FUNCIONA

### Backend (pedidos.ecolav)
- ✅ API pública com x-api-key
- ✅ Endpoints de clientes, itens, leitos
- ✅ Endpoints de pesagem (gaiolas, controles)
- ✅ Endpoint de distribuição
- ✅ Banco MySQL funcionando

### Frontend (myecolav)
- ✅ Tela de dashboard
- ✅ Tela de pesagem (formato tabela - perfeito para RFID)
- ✅ Tela de configurações
- ✅ Hook de leitura de balança (mock/RS232/USB/TCP)
- ✅ Estilo Ecolav (cores, layout)

---

## ❌ O QUE NÃO FUNCIONA

### Backend
- ❌ Endpoint `/api/public/sectors` não existe
- ❌ Endpoint `/api/public/totem/orders` não existe

### Frontend
- ❌ Backend local (duplicado e desnecessário)
- ❌ Dados não salvam no servidor real
- ❌ Balança configurada em RS232 (mostra valores falsos)
- ❌ Distribuição e Pedidos em páginas separadas
- ❌ Setores não carregam (endpoint não existe)
- ❌ Algumas chamadas ainda usam `localhost:3000`

---

## 🔧 CORREÇÕES NECESSÁRIAS

### 1. BACKEND (pedidos.ecolav)

#### Adicionar endpoint de setores
```typescript
app.get('/api/public/sectors', requireApiKey, async (req, res) => {
  const clientId = String(req.query.clientId || '').trim();
  const where = clientId ? { clientId } : {};
  const sectors = await prisma.sector.findMany({
    where,
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true, clientId: true }
  });
  res.json({ data: sectors });
});
```

#### Adicionar endpoint de pedidos
```typescript
app.post('/api/public/totem/orders', requireApiKey, async (req, res) => {
  const { bedId, items, observations } = req.body;
  const order = await prisma.order.create({
    data: {
      bedId,
      observations,
      status: 'pending',
      items: {
        create: items.map(item => ({
          itemId: item.itemId,
          quantity: item.quantity
        }))
      }
    },
    include: { items: true }
  });
  res.status(201).json(order);
});
```

### 2. FRONTEND (myecolav)

#### Remover backend local
```bash
rm -rf backend/
```

#### Unificar Distribuição e Pedidos
```
DistributionScreen + RequestsScreen
         ↓
DistributionAndOrdersScreen
   ├── Modo: Distribuir | Solicitar
   └── Input: Manual | RFID
```

#### Corrigir configurações padrão
```typescript
// src/hooks/useSettings.ts
const DEFAULTS = {
  scale: { mode: 'mock' }, // não 'rs232'
  server: {
    baseUrl: 'http://162.240.227.159:4000', // não localhost
    apiKey: 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea'
  },
  totem: {
    type: 'dirty',
    clientId: 'cmeti8brb0000ngpxg05nf3pc'
  }
};
```

#### Garantir uso de API_CONFIG.BASE_URL
```typescript
// SEMPRE usar:
`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.LINENS}`

// NUNCA usar:
`${settings.server.baseUrl}/api/...`
```

---

## 🎨 INTERFACE

### Dashboard
```
┌──────────────────────────────┐
│  ⚖️ PESAGEM  │  📦 DISTRIB.  │
│  Roupa Suja │  & Pedidos    │
├──────────────────────────────┤
│  🎯 ROLOS   │  ⚙️ CONFIG.   │
│  Especiais  │              │
└──────────────────────────────┘
```

### Pesagem (MANTER FORMATO ATUAL)
```
┌──────────────────────────────┐
│ Peso: 45.50 kg 🟢           │
│ [Selecionar Gaiola] [Tara]  │
│ [REGISTRAR PESAGEM]          │
├──────────────────────────────┤
│ Gaiola │ Bruto │ Tara │ Líq │
│ G-001  │ 45.5  │ 2.5  │ 43.0│
└──────────────────────────────┘
```

### Distribuição & Pedidos (NOVO)
```
┌──────────────────────────────┐
│ [📦 Distribuir] [🛒 Solicitar]│
│ [○ Manual] [○ RFID]          │
├──────────────────────────────┤
│ Setor:  [▼ Ala Norte]        │
│ Leito:  [▼ Quarto 101-A]     │
│ Item:   [▼ Lençol Hospital]  │
│ Qtd:    [− 5 +]              │
│ [CONFIRMAR]                  │
└──────────────────────────────┘
```

---

## 📊 ENDPOINTS API

### ✅ FUNCIONAM
```
GET  /api/public/clients
GET  /api/public/linens?clientId=X
GET  /api/public/beds?clientId=X
GET  /api/public/totem/gaiolas
POST /api/public/totem/controls/open
POST /api/public/totem/pesagens
POST /api/public/totem/distribute
```

### ❌ NÃO EXISTEM
```
GET  /api/public/sectors?clientId=X  ← CRIAR
POST /api/public/totem/orders         ← CRIAR
```

---

## 🔐 AUTENTICAÇÃO

```typescript
headers: {
  'x-api-key': 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea'
}
```

---

## 🏁 PLANO DE AÇÃO

### FASE 1: Backend (1-2 horas)
1. Adicionar `/api/public/sectors`
2. Adicionar `/api/public/totem/orders`
3. Testar endpoints com Postman/Insomnia

### FASE 2: Frontend (2-3 horas)
1. Deletar pasta `backend/`
2. Unificar `DistributionScreen` + `RequestsScreen`
3. Criar hook `useSectors`
4. Corrigir defaults em `useSettings`
5. Garantir uso de `API_CONFIG.BASE_URL`

### FASE 3: Testes (1 hora)
1. Teste de pesagem
2. Teste de distribuição (manual + RFID)
3. Teste de pedidos
4. Verificar dados no MySQL

### FASE 4: Documentação (30 min)
1. Atualizar README
2. Criar guia de instalação

**TOTAL: 5-7 horas de trabalho**

---

## 🎯 RESULTADO FINAL

### ANTES
❌ Totem desconectado
❌ Dados locais (SQLite)
❌ Backend duplicado
❌ Balança falsa
❌ Páginas separadas

### DEPOIS
✅ Totem integrado
✅ Dados no MySQL central
✅ Apenas frontend
✅ Balança real (ou mock controlado)
✅ Interface unificada
✅ Estilo Ecolav mantido
✅ Touch-friendly (44px mínimo)

---

## 💡 DECISÕES IMPORTANTES

### 1. Backend Local?
**REMOVER** - Frontend conecta direto no pedidos.ecolav

### 2. Distribuição + Pedidos?
**UNIFICAR** - Uma tela com 2 modos (distribuir/solicitar)

### 3. Formato da Pesagem?
**MANTER** - Tabela atual é perfeita para cabines RFID

### 4. Setores sem endpoint?
**CRIAR ENDPOINT** - Não confiar apenas em fallback

### 5. Modo da balança?
**MOCK** como padrão - Evita erros sem hardware

---

## 📞 PERGUNTAS PARA O USUÁRIO

1. ✅ **Aprovar esta lógica?**
2. ✅ **Posso implementar as correções?**
3. ❓ **Prioridade: Backend ou Frontend primeiro?**
4. ❓ **Testar em desenvolvimento ou direto em produção?**
5. ❓ **Já tem hardware (balança/RFID) para testar?**

---

**AGUARDANDO APROVAÇÃO PARA IMPLEMENTAR** 🚀



