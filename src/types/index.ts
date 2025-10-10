export interface User {
  id: string;
  name: string;
  matricula: string;
  role: 'operator' | 'supervisor' | 'admin';
  photo?: string;
}

export interface WeightEntry {
  id: string;
  type: string;
  weight: number;
  timestamp: Date;
  operator: string;
  observations?: string;
}

export interface RFIDTag {
  id: string;
  tagNumber: string;
  timestamp: Date;
  status: 'active' | 'inactive';
}

export interface NavigationState {
  currentScreen: string;
  history: string[];
  user: User | null;
}

export type ClothingType = 'industrial' | 'hospital' | 'common' | 'other';

export interface SpecialRoll {
  id: string;
  number: string;
  itemName: string;
  description?: string;
  quantity?: number;
  weight?: string;
  finalWeight?: string;
  expectedReturnAt?: string;
  status: 'received' | 'in_process' | 'ready' | 'dispatched' | 'returned';
  currentLocation?: string;
  priority?: number;
  attachments?: string;
  senderName?: string;
  qualityNotes?: string;
  receivedPhoto?: string;
  dispatchedPhoto?: string;
  dispatchedBy?: string;
  createdAt: string;
  clientId?: string;
  linenItemId?: string;
  client?: {
    id: string;
    name: string;
  };
  linenItem?: {
    id: string;
    name: string;
    sku: string;
  };
  events?: SpecialRollEvent[];
}

export interface SpecialRollEvent {
  id: string;
  rollId: string;
  eventType: 'received' | 'washed' | 'dried' | 'ironed' | 'quality_check' | 'dispatched' | 'note';
  note?: string;
  location?: string;
  userId?: string;
  details?: string;
  timestamp: string;
}