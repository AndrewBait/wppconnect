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
        
        // Converte o QR code base64 para um buffer de imagem
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

      // Filtrar e formatar informações relevantes
      const formattedMessage = this.formatMessage({
        sessionName,
        from: message.from,
        to: message.to,
        body: message.body,
        timestamp: new Date(message.timestamp * 1000).toLocaleString(), // Converte o timestamp para um formato legível
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
    return this.newMessageSubject.asObservable(); // Retorna o fluxo observável para SSE
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
  `.trim(); // Remove espaços em branco das extremidades
  }

  
  async removeSession(sessionName: string): Promise<void> {
    const client = this.sessions.get(sessionName);
    if (!client) {
      throw new Error(`Sessão ${sessionName} não encontrada.`);
    }
    await client.close(); // Fecha a sessão
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
    await client.sendText(to, message);
  }

  getSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}
