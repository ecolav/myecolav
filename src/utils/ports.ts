export async function listSerialPorts(): Promise<string[]> {
  // Web Serial API (quando disponível no navegador)
  const nav = (navigator as any);
  if (nav && nav.serial && nav.serial.getPorts) {
    try {
      const ports = await nav.serial.getPorts();
      // Sem acesso a detalhes port.path em browsers; retornar índices
      return ports.map((_, idx: number) => `SERIAL-${idx+1}`);
    } catch {
      return [];
    }
  }
  // Fallback: sem detecção
  return [];
}

export async function requestSerialPortPermission(): Promise<void> {
  const nav = (navigator as any);
  if (nav && nav.serial && nav.serial.requestPort) {
    await nav.serial.requestPort();
  }
}

export async function listUsbDevices(): Promise<Array<{ vendorId: number; productId: number }>> {
  const nav = (navigator as any);
  if (nav && nav.usb && nav.usb.getDevices) {
    try {
      const devices = await nav.usb.getDevices();
      return devices.map((d: any) => ({ vendorId: d.vendorId, productId: d.productId }));
    } catch {
      return [];
    }
  }
  return [];
}

export async function requestUsbDevicePermission(): Promise<void> {
  const nav = (navigator as any);
  if (nav && nav.usb && nav.usb.requestDevice) {
    try {
      await nav.usb.requestDevice({ filters: [] });
    } catch {}
  }
}


