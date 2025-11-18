// Configuração da API do sistema de pedidos
export const API_CONFIG = {
  // URL base da API - ajuste conforme necessário
  BASE_URL: 'http://162.240.227.159:4000',
  
  // Chave da API para acesso público
  API_KEY: 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea',
  
  // Endpoints da API
  ENDPOINTS: {
    // Totem público (x-api-key)
    TOTEM: {
      CAGES: '/api/public/totem/gaiolas',
      CONTROL_OPEN: '/api/public/totem/controls/open',
      WEIGHINGS: '/api/public/totem/pesagens',
      REPORT: '/api/public/totem/pesagens/relatorio',
      DISTRIBUTE: '/api/public/totem/distribute',
      ORDERS: '/api/public/totem/orders',
      RFID_LOOKUP: '/api/public/totem/rfid/lookup',
      RFID_PENDING_BATCHES: '/api/public/totem/rfid/pending-batches',
      RFID_ASSOCIATE_BATCH: (batchNumber: string | number) =>
        `/api/public/totem/rfid/batch/${batchNumber}/associate`,
      RFID_ASSOCIATE_TAG: '/api/public/totem/rfid/associate-tag',
      RFID_REPLACE_TAG: '/api/public/totem/rfid/replace-tag',
      RFID_DETACH_TAG: '/api/public/totem/rfid/detach-tag',
      RFID_NONCONFORMITY: '/api/public/totem/rfid/nonconformity',
      RFID_RETIRE: '/api/public/totem/rfid/retire',
      RFID_DISTRIBUTE: '/api/public/totem/rfid/distribute',
      STOCK_MOVEMENTS: '/api/public/totem/stock-movements',
      LAUNDRY_EXPORT: '/api/public/totem/laundry/export',
      RFID_RECEPTION: '/api/public/totem/rfid/reception',
      LAUNDRY_EXPURGO_QUEUE: '/api/public/totem/laundry/expurgo',
      LAUNDRY_EXPURGO_READ: '/api/public/totem/laundry/expurgo/read',
      LAUNDRY_COMPARATIVE: '/api/public/totem/laundry/comparative'
    },
    // Público (consulta)
    PUBLIC: {
      CLIENTS: '/api/public/clients',
      LINENS: '/api/public/linens',
      BEDS: '/api/public/beds',
      SECTORS: '/api/public/sectors',
      SPECIAL_ROLLS: '/api/public/special-rolls',
      USERS: '/api/public/users'
    }
  },
  
  // Configurações de timeout
  TIMEOUT: 10000, // 10 segundos
  
  // Configurações de retry
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 segundo
};

// Função para obter a URL completa de um endpoint
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

// Função para obter headers padrão com autenticação
export function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_CONFIG.API_KEY,
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
}

// Função para fazer requisições HTTP com tratamento de erro
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(endpoint);
  const headers = getAuthHeaders();
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  };
  
  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Função para fazer login
export async function login(_email: string, _password: string) {
  throw new Error('Login indisponível neste modo (totem público por x-api-key)');
}

// Função para fazer logout
export function logout() {
  localStorage.removeItem('token');
}

// Função para verificar se o usuário está autenticado
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

// Função para obter informações do usuário atual
export async function getCurrentUser() {
  return null as any;
}
