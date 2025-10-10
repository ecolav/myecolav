# 📋 LÓGICA CENTRAL DO TOTEM MYECOLAV

**Data:** 10/10/2025  
**Status:** DOCUMENTO DE PLANEJAMENTO - NÃO IMPLEMENTADO  
**Objetivo:** Definir a lógica de integração entre o Totem Cliente (myecolav) e o Sistema Entregas (pedidos.ecolav)

---

## 🎯 PREMISSAS FUNDAMENTAIS

### 1. ARQUITETURA DO SISTEMA

```
┌─────────────────────────────────────────────┐
│     TOTEM CLIENTE (myecolav)                │
│     ├── Desktop App (Tauri + React)         │
│     ├── Interface Touch (15.6")             │
│     └── Modo: SOMENTE ENTRADA DE DADOS      │
└─────────────────┬───────────────────────────┘
                  │
                  │ x-api-key auth
                  │ REST API
                  ▼
┌─────────────────────────────────────────────┐
│  SISTEMA ENTREGAS.ECOLAV (pedidos.ecolav)   │
│  ├── API Backend (Node + Express + Prisma) │
│  ├── Banco MySQL (162.240.227.159:3306)    │
│  └── Modo: GESTÃO E PROCESSAMENTO          │
└─────────────────────────────────────────────┘
```

### 2. PAPEL DO TOTEM

✅ **O QUE O TOTEM FAZ:**
- Coleta dados de pesagem (roupa suja)
- Registra distribuição/pedidos de enxoval
- Interface simplificada para uso em cabines RFID
- Envia dados para o servidor como "lançamento manual"
- **NÃO CRIA DADOS**: apenas consome e envia

❌ **O QUE O TOTEM NÃO FAZ:**
- Criar clientes, setores, leitos, itens
- Gerenciar usuários
- Gerar relatórios complexos
- Processar dados (isso é no entregas.ecolav)

### 3. CONTEXTO DE USO

**Cenário 1: Totem de Pesagem (Roupa Suja)**
- Local: Área de recebimento de roupas
- Função: Pesar e registrar roupas sujas do cliente
- Equipamento: Balança + Monitor Touch 15.6"
- Modo: Totem tipo "dirty" (suja)

**Cenário 2: Cabine RFID (Pesagem com Gaiolas)**
- Local: Câmara fechada com leitor RFID
- Função: Pesar gaiolas + ler tags RFID das peças
- Equipamento: Balança + Leitor RFID + Monitor Touch
- Formato: Tabela (atual) está perfeito para este caso

**Cenário 3: Distribuição/Pedidos**
- Local: Área de distribuição/recepção
- Função: Registrar distribuição de enxoval OU solicitar itens
- Modos: Manual (seleção) ou RFID (leitura automática)

---

## 🔄 FLUXO DE DADOS ATUAL vs FLUXO IDEAL

### ❌ PROBLEMA ATUAL

```
myecolav (Frontend)
    ├── Tenta criar controle local (SQLite)
    ├── API própria (backend local)
    └── NÃO conecta com pedidos.ecolav

Resultado: Dados ficam isolados, não há integração
```

### ✅ FLUXO IDEAL

```
1. TOTEM INICIA
   └── Carrega clientId das configurações
   └── Autentica com x-api-key no pedidos.ecolav

2. CARREGA DADOS DO SERVIDOR
   ├── GET /api/public/linens?clientId=X (itens de enxoval)
   ├── GET /api/public/beds?clientId=X (leitos)
   ├── GET /api/public/totem/gaiolas (gaiolas)
   └── (Setores são derivados dos leitos via sectorId)

3. PESAGEM (Roupa Suja)
   ├── POST /api/public/totem/controls/open { tipo: 'suja', clientId }
   │   └── Retorna: control_id (ou usa existente se já aberto hoje)
   ├── Usuário pesa na balança (leitura real via RS232/USB/TCP)
   ├── POST /api/public/totem/pesagens {
   │       control_id,
   │       cage_id (opcional),
   │       peso_tara,
   │       peso_total
   │   }
   └── Servidor recalcula totais automaticamente

4. DISTRIBUIÇÃO (Enxoval Limpo)
   ├── Modo Manual:
   │   ├── Usuário seleciona: Setor → Leito → Item → Quantidade
   │   └── POST /api/public/totem/distribute {
   │           linenItemId,
   │           bedId,
   │           quantity,
   │           reason: 'Distribuição via Totem'
   │       }
   │
   └── Modo RFID:
       ├── Leitor RFID identifica: bed.token (leito) + item.sku (item)
       ├── Busca IDs correspondentes no cache local
       └── POST /api/public/totem/distribute { linenItemId, bedId, quantity: 1 }

5. PEDIDOS (Solicitação de Itens Extras)
   ├── Usuário seleciona: Setor → Leito → Itens → Quantidades
   ├── POST /api/public/totem/orders {
   │       bedId,
   │       items: [{ itemId, quantity }],
   │       observations
   │   }
   └── Servidor cria Order + OrderItems + notifica lavanderia
```

---

## 📊 ESTRUTURA DE DADOS

### BANCO DE DADOS (pedidos.ecolav - MySQL)

```sql
-- Cliente (Hospital, Hotel, etc)
Client {
  id, name, document, contactName, contactPhone, whatsappNumber
}

-- Setores (Ala, Andar, Departamento)
Sector {
  id, name, description, clientId
}

-- Leitos (Quarto, Cama)
Bed {
  id, number, status (free|occupied), token (UUID para RFID), sectorId
}

-- Itens de Enxoval
LinenItem {
  id, name, sku, unit, currentStock, minimumStock, clientId
}

-- Gaiolas (para pesagem)
Cage {
  id, barcode, tareWeight
}

-- Controle de Pesagem (cabeçalho)
WeighingControl {
  id, clientId, kind (suja|limpa), laundryGrossWeight,
  clientTotalNetWeight, differenceWeight, differencePercent,
  referenceDate, expectedDeliveryDate, status (open|closed)
}

-- Entradas de Pesagem (itens)
WeighingEntry {
  id, controlId, cageId, tareWeight, totalWeight, netWeight
}

-- Itens Distribuídos
DistributedItem {
  id, linenItemId, bedId, status (allocated|pendingCollection|collected),
  clientId, allocatedAt
}

-- Pedidos
Order {
  id, bedId, status (pending|preparing|delivered|cancelled),
  observations, scheduledDelivery
}

OrderItem {
  id, orderId, itemId, quantity
}
```

### ENDPOINTS API PÚBLICA (x-api-key)

```typescript
// Autenticação
headers: {
  'x-api-key': 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea'
}

// === CONSULTA (READ) ===
GET  /api/public/clients?q=&page=&pageSize=
GET  /api/public/clients/:id
GET  /api/public/linens?clientId=&q=&page=&pageSize=
GET  /api/public/linens/:id
GET  /api/public/beds?clientId=&q=&page=&pageSize=
GET  /api/public/special-rolls?clientId=&number=&q=

// === TOTEM (WRITE) ===
GET  /api/public/totem/gaiolas
POST /api/public/totem/controls/open { tipo: 'suja'|'limpa', clientId }
POST /api/public/totem/pesagens { control_id, cage_id?, peso_tara, peso_total }
GET  /api/public/totem/pesagens/relatorio?start=YYYY-MM-DD&end=YYYY-MM-DD&clientId=
POST /api/public/totem/distribute { linenItemId, bedId, quantity, reason? }

// === NOTA: Endpoint de Orders NÃO EXISTE na API pública ===
// O totem precisará usar o endpoint privado ou criar um novo endpoint público
```

---

## 🔧 CONFIGURAÇÕES DO TOTEM

### settings.json (local)

```json
{
  "scale": {
    "name": "Balança Rouparia 01",
    "model": "",
    "deviceType": "plataforma",
    "mode": "mock|rs232|usb|tcpip",
    "port": "COM1",
    "baudRate": 9600,
    "dataBits": 8,
    "parity": "none",
    "stopBits": 1,
    "tcpHost": "192.168.1.100",
    "tcpPort": 9000
  },
  "rfid": {
    "access": "serial",
    "port": "COM3",
    "baudRate": 115200
  },
  "server": {
    "baseUrl": "http://162.240.227.159:4000",
    "apiKey": "aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea",
    "companyId": ""
  },
  "totem": {
    "type": "dirty|clean",
    "mode": "collection|distribution",
    "clientId": "cmeti8brb0000ngpxg05nf3pc"
  }
}
```

---

## 🎨 INTERFACE DO USUÁRIO (UX/UI)

### PRINCÍPIOS DE DESIGN

1. **Monitor Touch 15.6" SEM TECLADO FÍSICO**
   - Botões grandes (min 44px altura)
   - Fonte legível (16px+)
   - Espaçamento adequado
   - Teclado virtual quando necessário

2. **ESTILO ECOLAV**
   - Cores: Azul (#1e40af) + Verde (#059669)
   - Cards com sombra suave
   - Ícones Lucide React
   - Layout clean e profissional

3. **FLUXO SIMPLIFICADO**
   - Máximo 3 passos por operação
   - Feedback visual imediato
   - Confirmações claras
   - Mensagens de erro amigáveis

### TELAS DO TOTEM

#### 1. DASHBOARD (Tela Inicial)

```
┌─────────────────────────────────────────┐
│  🏥 TOTEM ECOLAV - Cliente: [Nome]      │
│  📡 Status: Conectado                   │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │   ⚖️ PESAGEM │  │ 📦 DISTRIB. │      │
│  │   Roupa Suja│  │  & PEDIDOS  │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │  🎯 ROLOS   │  │  ⚙️ CONFIG.  │      │
│  │  ESPECIAIS  │  │             │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
└─────────────────────────────────────────┘

Nota: Tiles aparecem conforme totem.type:
- dirty: Pesagem, Rolos Especiais, Configurações
- clean: Pesagem, Distribuição & Pedidos, Rolos, Config
```

#### 2. TELA DE PESAGEM (FORMATO ATUAL - MANTER!)

```
┌─────────────────────────────────────────┐
│  ⚖️ PESAGEM DE ROUPA SUJA               │
│  [← Voltar]                             │
├─────────────────────────────────────────┤
│  Controle Aberto: #123456               │
│  Data: 10/10/2025  Tipo: Suja          │
│  ┌─────────────────────────────────────┐│
│  │ Peso da Balança: 45.50 kg 🟢       ││
│  └─────────────────────────────────────┘│
│                                         │
│  [Selecionar Gaiola] [Informar Tara]   │
│                                         │
│  Gaiola: G-001  Tara: 2.5 kg           │
│  Tipo de Roupa: [▼ Hospitalar]         │
│  ┌─────────────────────────────────────┐│
│  │ [REGISTRAR PESAGEM]                ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  HISTÓRICO HOJE                         │
│  ┌───────────────────────────────────┐  │
│  │ Gaiola  │ Bruto │ Tara │ Líquido │  │
│  │ G-001   │ 45.5  │ 2.5  │  43.0  │  │
│  │ G-002   │ 38.2  │ 2.5  │  35.7  │  │
│  └───────────────────────────────────┘  │
│  Total Líquido: 78.7 kg                │
└─────────────────────────────────────────┘

✅ ESTE FORMATO ESTÁ PERFEITO PARA CABINES RFID!
Mantém a tabela e visão geral das pesagens.
```

#### 3. TELA DE DISTRIBUIÇÃO & PEDIDOS (UNIFICADA)

```
┌─────────────────────────────────────────┐
│  📦 DISTRIBUIÇÃO & PEDIDOS              │
│  [← Voltar]                             │
├─────────────────────────────────────────┤
│  ┌─────────────────┐ ┌────────────────┐│
│  │ 📝 DISTRIBUIR   │ │ 🛒 SOLICITAR   ││
│  │    ENXOVAL      │ │    ITENS       ││
│  └─────────────────┘ └────────────────┘│
├─────────────────────────────────────────┤
│                                         │
│  MODO: [○ Manual] [○ RFID Automático]  │
│                                         │
│  === MANUAL ===                         │
│  1️⃣ Setor:  [▼ Ala Norte]              │
│  2️⃣ Leito:  [▼ Quarto 101 - Leito A]   │
│  3️⃣ Item:   [▼ Lençol Hospitalar]      │
│  4️⃣ Qtd:    [− 5 +]                     │
│                                         │
│  [CONFIRMAR DISTRIBUIÇÃO]               │
│                                         │
│  === RFID ===                           │
│  📡 Aguardando leitura...               │
│  • Aproxime o item do leitor            │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔌 INTEGRAÇÃO COM HARDWARE

### BALANÇA (Scale Reader)

```typescript
interface ScaleConfig {
  mode: 'mock' | 'rs232' | 'usb' | 'tcpip';
  port?: string;         // COM1, COM2, etc
  baudRate?: number;     // 9600, 115200
  tcpHost?: string;      // 192.168.1.100
  tcpPort?: number;      // 9000
}

// Mock: Retorna peso aleatório/fixo para testes
// RS232: Lê via porta serial
// USB: Lê via USB HID
// TCP/IP: Conecta via socket TCP
```

### LEITOR RFID

```typescript
interface RFIDConfig {
  access: 'serial' | 'usb' | 'network';
  port: string;
  baudRate: number;
}

// Lê tags:
// - bed.token → Identifica leito
// - item.sku  → Identifica item de enxoval
```

---

## 🚨 PROBLEMAS A RESOLVER

### 1. ENDPOINT DE PEDIDOS (ORDERS)

**Problema:** API pública NÃO tem endpoint para criar pedidos (orders)

**Soluções:**

#### Opção A: Criar endpoint público no pedidos.ecolav
```typescript
// backend/src/index.ts
app.post('/api/public/totem/orders', requireApiKey, async (req, res) => {
  const { bedId, items, observations } = req.body;
  // Validar bed + items
  // Criar Order + OrderItems
  // Retornar order criado
});
```

#### Opção B: Usar `/api/public/totem/distribute` para tudo
- Distribuição E pedidos usam o mesmo endpoint
- Adicionar campo `type: 'distribution' | 'request'`

#### ✅ RECOMENDAÇÃO: Opção A
- Separa distribuição (OUT stock) de pedidos (REQUEST)
- Mantém semântica clara
- Facilita relatórios futuros

### 2. SETORES NÃO TÊM ENDPOINT PÚBLICO

**Problema:** `/api/public/sectors` não existe

**Solução Atual (Fallback):**
```typescript
// Derivar setores dos leitos carregados
const beds = await fetch('/api/public/beds?clientId=X');
const sectorIds = [...new Set(beds.map(b => b.sectorId))];
const sectors = sectorIds.map(id => ({
  id,
  name: `Setor ${id.substring(0, 6)}`
}));
```

**Solução Ideal:**
```typescript
// Adicionar endpoint público no backend
app.get('/api/public/sectors', requireApiKey, async (req, res) => {
  const clientId = String(req.query.clientId || '');
  const where = clientId ? { clientId } : {};
  const sectors = await prisma.sector.findMany({ where });
  res.json(sectors);
});
```

### 3. BACKEND LOCAL (myecolav/backend) É NECESSÁRIO?

**Situação Atual:**
- myecolav tem backend próprio (Express + Prisma + SQLite)
- Duplica lógica do pedidos.ecolav
- Cria confusão na arquitetura

**Análise:**

❌ **Manter backend local:**
- Duplica código
- Sincronização complexa
- Dados isolados

✅ **Remover backend local:**
- Frontend conecta DIRETO no pedidos.ecolav
- Menos complexidade
- Única fonte de verdade

**DECISÃO:** Remover backend local, usar APENAS pedidos.ecolav

---

## 📝 PLANO DE IMPLEMENTAÇÃO

### FASE 1: AJUSTES NO BACKEND (pedidos.ecolav)

```typescript
// 1. Adicionar endpoint de setores público
app.get('/api/public/sectors', requireApiKey, async (req, res) => {
  const clientId = String(req.query.clientId || '').trim();
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
  const where: any = {};
  if (clientId) where.clientId = clientId;
  const [total, data] = await Promise.all([
    prisma.sector.count({ where }),
    prisma.sector.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, description: true, clientId: true }
    })
  ]);
  res.json({ page, pageSize, total, data });
});

// 2. Adicionar endpoint de pedidos público
const publicOrderSchema = z.object({
  bedId: z.string().min(1),
  items: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().int().positive()
  })).min(1),
  observations: z.string().optional().nullable()
});

app.post('/api/public/totem/orders', requireApiKey, async (req, res) => {
  const parsed = publicOrderSchema.parse(req.body);
  const bed = await prisma.bed.findUnique({
    where: { id: parsed.bedId },
    include: { sector: true }
  });
  if (!bed) return res.status(400).json({ error: 'Invalid bedId' });

  // Validar itens
  for (const item of parsed.items) {
    const exists = await prisma.linenItem.findUnique({
      where: { id: item.itemId }
    });
    if (!exists) {
      return res.status(400).json({
        error: 'Invalid itemId',
        itemId: item.itemId
      });
    }
  }

  // Criar pedido
  const order = await prisma.order.create({
    data: {
      bedId: parsed.bedId,
      observations: parsed.observations ?? null,
      status: 'pending',
      items: {
        create: parsed.items.map(item => ({
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

### FASE 2: REMOVER BACKEND LOCAL (myecolav)

1. Deletar pasta `backend/`
2. Remover scripts de backend do `package.json`
3. Atualizar `README.md`

### FASE 3: AJUSTAR FRONTEND (myecolav)

#### 3.1. Atualizar `src/config/api.ts`

```typescript
export const API_CONFIG = {
  BASE_URL: 'http://162.240.227.159:4000',
  API_KEY: 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea',
  ENDPOINTS: {
    TOTEM: {
      GAIOLAS: '/api/public/totem/gaiolas',
      CONTROL_OPEN: '/api/public/totem/controls/open',
      WEIGHINGS: '/api/public/totem/pesagens',
      REPORT: '/api/public/totem/pesagens/relatorio',
      DISTRIBUTE: '/api/public/totem/distribute',
      ORDERS: '/api/public/totem/orders'
    },
    PUBLIC: {
      CLIENTS: '/api/public/clients',
      LINENS: '/api/public/linens',
      BEDS: '/api/public/beds',
      SECTORS: '/api/public/sectors',
      SPECIAL_ROLLS: '/api/public/special-rolls'
    }
  }
};
```

#### 3.2. Criar hook `useSectors.ts`

```typescript
export function useSectors(clientId?: string) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchSectors = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PUBLIC.SECTORS}?clientId=${clientId}&pageSize=200`;
      const response = await fetch(url, {
        headers: { 'x-api-key': API_CONFIG.API_KEY }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      setSectors(data.data || data || []);
    } catch (err) {
      console.error('Error fetching sectors:', err);
      setSectors([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchSectors();
  }, [fetchSectors]);

  return { sectors, loading, refetch: fetchSectors };
}
```

#### 3.3. Unificar `DistributionScreen` e `RequestsScreen`

```typescript
// src/components/screens/DistributionAndOrdersScreen.tsx
export function DistributionAndOrdersScreen({ onBack }: Props) {
  const [mode, setMode] = useState<'distribute' | 'order'>('distribute');
  const [inputMode, setInputMode] = useState<'manual' | 'rfid'>('manual');
  
  const { sectors } = useSectors(clientId);
  const { beds } = useBeds(clientId);
  const { items } = useLinenItems(clientId);

  const handleSubmit = async () => {
    if (mode === 'distribute') {
      await distributeItem(selectedItem, selectedBed, quantity);
    } else {
      await createOrder(selectedBed, itemsToOrder, observations);
    }
  };

  return (
    <div className="...">
      <div className="flex gap-4 mb-6">
        <button
          className={mode === 'distribute' ? 'active' : ''}
          onClick={() => setMode('distribute')}
        >
          📦 Distribuir Enxoval
        </button>
        <button
          className={mode === 'order' ? 'active' : ''}
          onClick={() => setMode('order')}
        >
          🛒 Solicitar Itens
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <label>
          <input
            type="radio"
            checked={inputMode === 'manual'}
            onChange={() => setInputMode('manual')}
          />
          Manual
        </label>
        <label>
          <input
            type="radio"
            checked={inputMode === 'rfid'}
            onChange={() => setInputMode('rfid')}
          />
          RFID Automático
        </label>
      </div>

      {inputMode === 'manual' ? (
        <ManualForm
          mode={mode}
          sectors={sectors}
          beds={beds}
          items={items}
          onSubmit={handleSubmit}
        />
      ) : (
        <RFIDReader
          mode={mode}
          onRead={handleRFIDRead}
        />
      )}
    </div>
  );
}
```

#### 3.4. Corrigir `WeighingScreen` para usar API real

```typescript
// src/components/screens/WeighingScreen.tsx

// 1. Ao iniciar, abrir controle
useEffect(() => {
  async function openControl() {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.CONTROL_OPEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_CONFIG.API_KEY
        },
        body: JSON.stringify({
          tipo: 'suja',
          clientId: settings.totem.clientId
        })
      }
    );
    const control = await response.json();
    setCurrentControl(control);
  }
  openControl();
}, []);

// 2. Ao registrar pesagem
async function handleWeighingSubmit() {
  const response = await fetch(
    `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOTEM.WEIGHINGS}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_CONFIG.API_KEY
      },
      body: JSON.stringify({
        control_id: currentControl.id,
        cage_id: selectedCage?.id,
        peso_tara: tareWeight,
        peso_total: scaleWeight
      })
    }
  );
  const result = await response.json();
  // Atualizar histórico local
  setEntries(prev => [result.entry, ...prev]);
}
```

#### 3.5. Atualizar `DashboardScreen`

```typescript
// src/components/screens/DashboardScreen.tsx

const tiles = [
  {
    id: 'weighing',
    title: 'Pesagem',
    icon: Scale,
    description: 'Registrar pesagem de roupa suja'
  },
  {
    id: 'distribution-orders',
    title: 'Distribuição & Pedidos',
    icon: Package,
    description: 'Distribuir enxoval ou solicitar itens'
  },
  {
    id: 'specialrolls',
    title: 'Rolos Especiais',
    icon: Package,
    description: 'Gerenciar ROLs especiais'
  },
  {
    id: 'settings',
    title: 'Configurações',
    icon: Settings,
    description: 'Ajustes do sistema'
  }
];

// Filtrar conforme totem.type
const availableTiles = settings.totem.type === 'dirty'
  ? tiles.filter(t => ['weighing', 'specialrolls', 'settings'].includes(t.id))
  : tiles;
```

### FASE 4: TESTES

#### 4.1. Teste de Pesagem

1. Configurar `totem.clientId` nas configurações
2. Configurar balança em modo `mock`
3. Abrir tela de pesagem
4. Verificar que controle é aberto/reaproveitado
5. Registrar pesagem com gaiola
6. Verificar que entrada aparece no histórico
7. Verificar no banco MySQL que dados foram salvos

#### 4.2. Teste de Distribuição

1. Abrir tela de Distribuição & Pedidos
2. Selecionar "Distribuir Enxoval"
3. Modo Manual:
   - Selecionar setor, leito, item, quantidade
   - Confirmar
   - Verificar sucesso
4. Modo RFID:
   - Ativar modo RFID
   - Simular leitura (se disponível)
   - Verificar registro

#### 4.3. Teste de Pedidos

1. Abrir tela de Distribuição & Pedidos
2. Selecionar "Solicitar Itens"
3. Selecionar setor, leito
4. Adicionar múltiplos itens com quantidades
5. Adicionar observações
6. Confirmar
7. Verificar que Order foi criado no banco

### FASE 5: DOCUMENTAÇÃO

1. Atualizar `README.md`
2. Atualizar `README_TOTEM_ECOLAV.md`
3. Criar guia de instalação para técnicos
4. Criar manual do usuário final

---

## 🎯 RESULTADO ESPERADO

### ANTES (Atual)

❌ Totem isolado, dados locais
❌ Backend duplicado
❌ Sem integração real
❌ Distribuição e Pedidos em páginas separadas
❌ Balança retornando valores falsos
❌ Setores/leitos não carregam

### DEPOIS (Ideal)

✅ Totem conectado ao sistema central
✅ Sem backend local, apenas frontend
✅ Integração completa via API pública
✅ Distribuição e Pedidos unificados
✅ Balança lendo valores reais (ou mock controlado)
✅ Setores/leitos/itens carregam do servidor
✅ Dados salvos diretamente no MySQL principal
✅ Tela de pesagem mantém formato tabela (para RFID)
✅ Interface touch-friendly sem perder identidade Ecolav

---

## 🔒 SEGURANÇA

### x-api-key

- Chave única por instalação/cliente
- Armazenada em `settings.server.apiKey`
- Enviada em todos os requests: `headers: { 'x-api-key': 'XXX' }`

### Validações no Backend

- `requireApiKey` middleware verifica chave
- Valida `clientId` em todas operações
- Managers só veem dados do seu cliente
- Admins veem tudo

---

## 📊 MONITORAMENTO

### Logs

```typescript
// Frontend
console.log('[TOTEM] Opened control:', controlId);
console.log('[TOTEM] Weighing registered:', entry);
console.log('[TOTEM] Distribution success:', result);

// Backend (pedidos.ecolav)
app.use(morgan('dev')); // Log automático de requests
```

### Health Check

```typescript
// Frontend verifica conexão periodicamente
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/health`,
        { headers: { 'x-api-key': API_CONFIG.API_KEY } }
      );
      setServerStatus(response.ok ? 'online' : 'offline');
    } catch {
      setServerStatus('offline');
    }
  }, 30000); // a cada 30s
  return () => clearInterval(interval);
}, []);
```

---

## 🏁 CONCLUSÃO

### ARQUITETURA FINAL

```
TOTEM (Frontend React + Tauri)
    ↓
    │ x-api-key
    ↓
ENTREGAS.ECOLAV (Backend Node + MySQL)
    ↓
    │ JWT auth
    ↓
DASHBOARD WEB (Frontend React)
```

### PRÓXIMOS PASSOS

1. ✅ Aprovar este documento de lógica
2. ⏳ Implementar endpoints no backend
3. ⏳ Ajustar frontend do totem
4. ⏳ Testes integrados
5. ⏳ Deploy em produção

---

**IMPORTANTE:** Este é um documento de PLANEJAMENTO. Nenhuma implementação foi feita ainda. Aguardando aprovação do usuário para prosseguir.



