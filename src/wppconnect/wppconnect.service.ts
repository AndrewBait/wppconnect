import { Injectable } from '@nestjs/common';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import axios from 'axios';
import { Subject } from 'rxjs';


@Injectable()
export class WppconnectService {
  private sessions: Map<string, Whatsapp> = new Map();
  private qrCodes: Map<string, Buffer> = new Map();
  private newMessageSubject = new Subject<any>();

  async createSession(sessionName: string): Promise<void> {
    if (this.sessions.has(sessionName)) {
      console.log(`Sessão ${sessionName} já está ativa.`);
      return;
    }

    const client = await create({
      session: sessionName,
      headless: true,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      catchQR: (base64Qr, asciiQR) => {
        console.log(`QR Code recebido para sessão ${sessionName}: ${asciiQR}`);        
        
        const matches = base64Qr.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          console.error('String base64 inválida para QR Code');
          return;
        }

        const imageBuffer = Buffer.from(matches[2], 'base64');
        this.qrCodes.set(sessionName, imageBuffer); // Armazena o buffer da imagem
      },
      logQR: false,
    });

    this.sessions.set(sessionName, client);

    client.onMessage(async (message) => {
      console.log(`[${sessionName}] Mensagem recebida:`, message);

      // Filtrar pra entender essa desgraca
      const formattedMessage = this.formatMessage({
        sessionName,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000).toLocaleString(), // Converte o timestamp p entender essa merdinha
        type: message.type,
        senderName: message.sender?.name,
      });

      this.newMessageSubject.next(formattedMessage); // Emitir mensagem filtrada para SSE

      try {
        await axios.post('http://localhost:3000/whatsapp/events', formattedMessage);
      } catch (error) {
        console.error(`Erro ao enviar a mensagem para o endpoint da sessão ${sessionName}:`, error.message);
      }
    });

    client.onStateChange((state) => {
      console.log(`[${sessionName}] Estado alterado:`, state);
    });

    console.log(`Sessão ${sessionName} criada com sucesso.`);
  }

  onNewMessage() {
    return this.newMessageSubject.asObservable(); // Retorna o fluxo observável para SSE pra entender essa porrinha
  }

  private formatMessage(message: any): string {
    return `
  Sessão: ${message.sessionName}
  De: ${message.from}
  Para: ${message.to}
  Mensagem: ${message.body}
  Tipo: ${message.type}
  Nome do Remetente: ${message.senderName}
  Data e Hora: ${message.timestamp}
  `.trim(); 
  }


  async removeSession(sessionName: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }
    await client.close(); 
    this.sessions.delete(sessionName); // Remove do mapa de sessões
    this.qrCodes.delete(sessionName); // Remove o QR code armazenado, se houver
    console.log(`Sessão ${sessionName} removida com sucesso.`);
  }

  async getQRCodeImage(sessionName: string): Promise<Buffer> {
    const qrCodeImage = this.qrCodes.get(sessionName);
    if (!qrCodeImage) {
      throw new Error(`QR Code para a sessão ${sessionName} não encontrado ou sessão já autenticada.`);
    }
    return qrCodeImage; // Retorna o buffer da imagem
  }

  async sendMessage(sessionName: string, to: string, message: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }
  
    try {
      await client.sendText(to, message);  
      
      const from = `${sessionName}@c.us`; 
  
      const formattedMessage = this.formatMessage({
        sessionName,
        from,
        to,
        body: message,
        timestamp: new Date().toLocaleString(),
        type: 'chat',
        senderName: 'Eu',
      });
  
      this.newMessageSubject.next(formattedMessage); // Emitir mensagem enviada para SSE
    } catch (error) {
      console.error(`Erro ao enviar mensagem na sessão ${sessionName}:`, error.message);
      throw new Error(`Erro ao enviar mensagem: ${error.message}`);
    }
  }

  getSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  async getSessionStatus(sessionName: string): Promise<string> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      return `Sessão ${sessionName} não encontrada.`;
    }
    return await client.getConnectionState(); // Retorna o estado de conexão da sessão
  }

  async reconnectSession(sessionName: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }

    await client.close(); 
    this.sessions.delete(sessionName); // Remove do mapa de sessões

    await this.createSession(sessionName); // Cria uma nova sessão com o mesmo nome
  }

  
}
