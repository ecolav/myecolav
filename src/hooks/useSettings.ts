import { useEffect, useState } from 'react';

export type ScaleMode = 'rs232' | 'usb';
export interface ScaleSettings {
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

export interface Settings {
  scale: ScaleSettings;
  printer: PrinterSettings;
  rfid: RfidSettings;
  server: ServerSettings;
}

const DEFAULTS: Settings = {
  scale: { mode: 'rs232', port: 'COM1', baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 },
  printer: { defaultPrinter: '', emulateESCPos: true },
  rfid: { access: 'serial', port: 'COM3', baudRate: 115200 },
  server: { baseUrl: 'http://localhost:3000', apiKey: '', companyId: '' },
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


