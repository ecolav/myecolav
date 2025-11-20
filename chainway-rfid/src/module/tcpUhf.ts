import * as net from 'net';
import { RFID } from './interface';

type PowerOptions = {
    antennas?: number[];
    saveToFlash?: boolean;
};

class TCPClient {
    private client: net.Socket | null = null;
    private readonly MIN_POWER = 0;
    private readonly MAX_POWER = 30;

    connect(host: string, port: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.client = new net.Socket();
            this.client.connect(port, host, () => {
                console.log(`Connected to ${host}:${port}`);
                resolve(true);
            });

            this.client.on('error', (err: Error) => {
                console.log("[Chainway-api] Err to Connect Hardware, please check your IP!");
                reject(false);
            });
        });
    }

    send(message: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.client) {
                if (this.client.destroyed) {
                    console.error('Send error: client socket already destroyed');
                    return reject(new Error('Client socket destroyed'));
                }
                this.client.write(message, (err: Error | null | undefined) => {
                    if (err) {
                        console.error('Send error:', err.message);
                        reject(err);
                    } else {
                        console.log('Message sent:', message);
                        resolve();
                    }
                });
            } else {
                reject(new Error('Client not connected'));
            }
        });
    }

    startScan(): Promise<void> {
        const _0xabc = [165, 90, 0, 10, 130, 39, 16, 191, 13, 10];
        const _0xdef = ['from', 'Buffer'];
        const _0xgh = _0xabc.map((v, i) => {
            return v ^ (i % 3 ? 0 : 1);
        });
        const _0xijk = (globalThis as any)[_0xdef[1]][_0xdef[0]](
            _0xgh.map((v, i) => v ^ (i % 3 ? 0 : 1))
        );
        return (this as any)['s' + 'end'](_0xijk);
    }

    stopScan(): Promise<void> {
        const _0xabc = [200, 140, 0, 8, 140, 132, 13, 10];
        const _0xdef = ['from', 'Buffer'];
        const _0xghi = _0xabc.map((v, i) => {
            return v ^ (i % 2 ? 0x0F : 0xFF);
        });
        const _0xjkl = (globalThis as any)[_0xdef[1]][_0xdef[0]](
            _0xghi.map((v, i) => v ^ (i % 2 ? 0x0F : 0xFF))
        );
        return (this as any)['s' + 'end'](_0xjkl);
    }

    received(cb?: (data: RFID ) => void): void {
        if (cb && this.client) {
            this.client.on('data', (data: Buffer) => {
                cb(f(data));
            });

            this.client.on('close', () => {
                console.log('Connection closed');
            });
        }
    }

    disconnect(): void {
        if (this.client) {
            try {
                // Remover todos os listeners antes de fechar
                this.client.removeAllListeners('data');
                this.client.removeAllListeners('error');
                this.client.removeAllListeners('close');
                
                // Fechar a conexão
                if (!this.client.destroyed) {
                    this.client.end(() => {
                        console.log('Disconnected from server');
                    });
                    
                    // Forçar destruição após um tempo se não fechar normalmente
                    setTimeout(() => {
                        if (this.client && !this.client.destroyed) {
                            this.client.destroy();
                            console.log('Connection forcefully destroyed');
                        }
                    }, 1000);
                }
                
                // Limpar referência
                this.client = null;
            } catch (error) {
                console.error('Error disconnecting:', error);
                this.client = null;
            }
        }
    }

    async setPower(power: number, options: PowerOptions = {}): Promise<void> {
        const payload = this.buildPowerPayload(power, options);
        const command = this.buildCommandFrame(0x10, payload);
        await this.send(command);
    }

    private buildPowerPayload(power: number, options: PowerOptions): Buffer {
        const { antennas, saveToFlash = true } = options;
        const normalizedPower = this.normalizePower(power);
        const antennaList = this.normalizeAntennas(antennas);
        const centiDbm = Math.round(normalizedPower * 100);
        const highByte = (centiDbm >> 8) & 0xff;
        const lowByte = centiDbm & 0xff;

        const payload: number[] = [];
        payload.push(saveToFlash ? 0x02 : 0x00);

        antennaList.forEach((antenna) => {
            payload.push(
                antenna & 0xff,
                highByte,
                lowByte,
                highByte,
                lowByte
            );
        });

        return Buffer.from(payload);
    }

    private normalizeAntennas(antennas?: number[]): number[] {
        const list = Array.isArray(antennas) && antennas.length ? antennas : [1];
        const sanitized = list
            .map((antenna) => Math.max(1, Math.min(8, Math.trunc(antenna))))
            .filter((antenna, index, self) => (
                antenna >= 1 &&
                antenna <= 8 &&
                self.indexOf(antenna) === index
            ));

        return sanitized.length ? sanitized : [1];
    }

    private normalizePower(power?: number): number {
        const numericPower = Number.isFinite(power) ? Number(power) : this.MIN_POWER;
        const clamped = Math.max(this.MIN_POWER, Math.min(this.MAX_POWER, numericPower));
        return Math.round(clamped * 100) / 100;
    }

    private buildCommandFrame(command: number, payload: Buffer): Buffer {
        const payloadLength = payload.length;
        const frameLength = payloadLength + 8;
        const buffer = Buffer.alloc(payloadLength + 8);

        buffer[0] = 0xA5;
        buffer[1] = 0x5A;
        buffer[2] = (frameLength >> 8) & 0xff;
        buffer[3] = frameLength & 0xff;
        buffer[4] = command & 0xff;
        payload.copy(buffer, 5);

        let checksum = 0x00;
        for (let i = 2; i < 5 + payloadLength; i++) {
            checksum ^= buffer[i];
        }

        buffer[5 + payloadLength] = checksum & 0xff;
        buffer[6 + payloadLength] = 0x0D;
        buffer[7 + payloadLength] = 0x0A;

        return buffer;
    }
}

// helper fucntion ===============================================================================================
const f = (data: Buffer): RFID  => {
    const HEADER_LENGTH = 5;
    const END_FRAME_LENGTH = 3;
    const TID_LENGTH = 12;
    const RSSI_LENGTH = 2;
    const ATN_LENGTH = 1;

    // Calculate EPC length dynamically
    const epcStart = HEADER_LENGTH;
    const epcLength = data.length - (HEADER_LENGTH + TID_LENGTH + RSSI_LENGTH + ATN_LENGTH + END_FRAME_LENGTH);
    const epcEnd = epcStart + epcLength;

    if (data.length < HEADER_LENGTH + TID_LENGTH + RSSI_LENGTH + ATN_LENGTH + END_FRAME_LENGTH) {
        return{
            epc: undefined,
            rssi: undefined,
            ant: undefined,
            tid: undefined
        }
    }
    

    // Extract EPC
    let epc = '';
    for (let i = epcStart; i < epcEnd; ++i) {
        if (data[i] < 0x10) epc += '0';  // Add leading zero for single hex digits
        epc += data[i].toString(16);  // Convert to hex string
    }
    epc = epc.toUpperCase();

    // Extract TID
    const tidStart = epcEnd;
    const tidEnd = tidStart + TID_LENGTH;
    let tid = '';
    for (let i = tidStart; i < tidEnd; ++i) {
        if (data[i] < 0x10) tid += '0';  // Add leading zero for single hex digits
        tid += data[i].toString(16);  // Convert to hex string
    }
    tid = tid.toUpperCase();

    // Extract RSSI
    const rssiStart = tidEnd;
    const rssiEnd = rssiStart + RSSI_LENGTH;
    let rssi = '';
    for (let i = rssiStart; i < rssiEnd; ++i) {
        if (data[i] < 0x10) rssi += '0';  // Add leading zero for single hex digits
        rssi += data[i].toString(16);  // Convert to hex string
    }

    // Extract ATN as a number
    const antStart = rssiEnd;
    const ant = data[antStart];  // Directly assign the numeric value

    // Return the extracted data in the RFID format
    return {
        epc,
        tid,
        rssi,
        ant
    };
};

export default new TCPClient();

