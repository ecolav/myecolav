// Configuração da API do sistema de pedidos
export const API_CONFIG = {
  // URL base da API - ajuste conforme necessário
  BASE_URL: 'http://162.240.227.159:4000',
  
  // Chave da API para acesso público
  API_KEY: 'lavanderia_ecolav_@2022',
  
  // Endpoints da API
  ENDPOINTS: {
    // Autenticação
    AUTH: {
      LOGIN: '/auth/login',
      ME: '/auth/me',
      BOOTSTRAP: '/auth/bootstrap-admin'
    },
    
    // Clientes
    CLIENTS: '/clients',
    
    // Setores
    SECTORS: '/sectors',
    
    // Leitos
    BEDS: '/beds',
    
    // Itens de enxoval
    ITEMS: '/items',
    
    // Pedidos
    ORDERS: '/orders',
    
    // Movimentações de estoque
    STOCK_MOVEMENTS: '/stock-movements',
    
    // Gaiolas
    CAGES: '/gaiolas',
    
    // Controles de pesagem
    WEIGHING_CONTROLS: '/controles',
    
    // Entradas de pesagem
    WEIGHING_ENTRIES: '/pesagens',
    
    // Itens distribuídos
    DISTRIBUTED_ITEMS: '/distributed-items',
    
    // ROLs especiais
    SPECIAL_ROLLS: '/special-rolls'
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
export async function login(email: string, password: string) {
  const response = await apiRequest<{
    id: string;
    name: string;
    email: string;
    role: string;
    clientId?: string;
    token: string;
  }>(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  
  // Salvar token no localStorage
  localStorage.setItem('token', response.token);
  
  return response;
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
  return await apiRequest<{
    id: string;
    email: string;
    role: string;
    clientId?: string;
  }>(API_CONFIG.ENDPOINTS.AUTH.ME);
}
