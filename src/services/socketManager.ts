import { io, Socket } from 'socket.io-client';

class SocketManager {
  private socket: Socket | null = null;
  private readonly url = 'http://localhost:3001';

  getSocket(): Socket {
    if (!this.socket) {
      this.socket = io(this.url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      this.socket.on('connect', () => {
        console.log('✅ [Socket.IO] Conectado ao servidor');
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 [Socket.IO] Desconectado do servidor');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ [Socket.IO] Erro de conexão:', error.message);
      });
    }

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketManager = new SocketManager();






