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