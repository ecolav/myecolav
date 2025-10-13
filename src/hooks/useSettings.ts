import { useEffect, useState } from 'react';

export type ScaleMode = 'mock' | 'rs232' | 'usb' | 'tcpip';
export interface ScaleSettings {
  name?: string;
  model?: string; // fabricante/modelo
  deviceType?: 'carga' | 'plataforma' | 'suspensa';
  mode: ScaleMode;
  // RS232
  port?: string;
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  parity?: 'none' | 'even' | 'odd';
  stopBits?: 1 | 1.5 | 2;
  // USB HID
  vendorId?: number;
  productId?: number;
}

export interface PrinterSettings {
  defaultPrinter?: string;
  address?: string; // IP/host para impressora de rede
  port?: number;
  emulateESCPos?: boolean;
}

export type RfidAccess = 'serial' | 'tcpip' | 'usb';
export interface RfidSettings {
  access: RfidAccess;
  port?: string; // para serial
  baudRate?: number;
  host?: string; // para tcpip
  tcpPort?: number;
}

export interface ServerSettings {
  baseUrl: string;
  apiKey?: string;
  companyId?: string;
}

export interface NetworkSettings {
  enabled: boolean;
  port: number;
  host: string; // IP ou hostname para bind
  autoStart: boolean;
}

export type TotemType = 'clean' | 'dirty';
export type TotemMode = 'distribution' | 'collection';

export interface TotemSettings {
  type: TotemType;
  mode: TotemMode;
  clientId?: string;
}

export interface Settings {
  scale: ScaleSettings;
  printer: PrinterSettings;
  rfid: RfidSettings;
  server: ServerSettings;
  totem: TotemSettings;
  network: NetworkSettings;
}

const DEFAULTS: Settings = {
  scale: { name: 'Balança Rouparia 01', model: 'Balança Genérica (Protocolo H/L)', deviceType: 'plataforma', mode: 'rs232', port: '/dev/ttyS0', baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
  printer: { defaultPrinter: '', emulateESCPos: true },
  rfid: { access: 'serial', port: '/dev/ttyS1', baudRate: 115200 },
  server: { baseUrl: 'http://162.240.227.159:4000', apiKey: 'aa439ecb1dc29734874073b8bf581f528acb4e5c179b11ea', companyId: '' },
  totem: { type: 'dirty', mode: 'collection', clientId: undefined },
  network: { enabled: false, port: 3000, host: '0.0.0.0', autoStart: false },
};

const STORAGE_KEY = 'myecolav:settings:v1';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [loaded, settings]);

  return { settings, setSettings };
}


