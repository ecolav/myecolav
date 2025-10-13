export type TestResult = { ok: boolean; raw: string };

export interface ScaleDriver {
  id: string;
  label: string;
  mode: 'rs232' | 'usb';
  defaults?: Partial<{ baudRate: number; parity: 'none' | 'even' | 'odd'; vendorId: number; productId: number }>;
  test: (options: Record<string, any>) => Promise<TestResult>;
}

// Drivers simulados; integração real pode ser adicionada depois
export const SCALE_DRIVERS: ScaleDriver[] = [
  {
    id: 'digitron-300',
    label: 'Digitron 300kg',
    mode: 'rs232',
    defaults: { baudRate: 9600, parity: 'none' },
    async test() {
      const raw = `READ\r\n+ST,${(Math.random()*5+0.5).toFixed(2)}kg`;
      return { ok: true, raw };
    }
  },
  {
    id: 'toledo-prix',
    label: 'Toledo Prix',
    mode: 'rs232',
    defaults: { baudRate: 4800, parity: 'even' },
    async test() {
      const raw = `PESO:${(Math.random()*5+0.5).toFixed(2)};UN:KG;ST:OK`;
      return { ok: true, raw };
    }
  },
  {
    id: 'ricelake-x',
    label: 'Rice Lake X',
    mode: 'usb',
    defaults: { vendorId: 1155, productId: 22336 },
    async test() {
      const raw = JSON.stringify({ weight: Number((Math.random()*5+0.5).toFixed(2)), unit: 'kg', status: 'OK' });
      return { ok: true, raw };
    }
  },
  {
    id: 'custom-hl-protocol',
    label: 'Balança Genérica (Protocolo H/L)',
    mode: 'rs232',
    defaults: { baudRate: 9600, parity: 'none' },
    async test() {
      // Testar servidor HTTP local que lê a balança real
      try {
        const response = await fetch('http://localhost:3001/scale/weight');
        if (response.ok) {
          const data = await response.json();
          return { 
            ok: data.connected, 
            raw: `✅ Peso: ${data.weight.toFixed(2)} kg - ${data.connected ? 'Conectado (/dev/ttyS0)' : '❌ Desconectado'}` 
          };
        } else {
          return { ok: false, raw: '❌ Servidor não responde' };
        }
      } catch (error) {
        return { ok: false, raw: '❌ Servidor de balança não encontrado. Execute: node scale-server.cjs' };
      }
    }
  }
];

export function getDriverByLabel(label?: string): ScaleDriver | undefined {
  return SCALE_DRIVERS.find(d => d.label === label);
}


