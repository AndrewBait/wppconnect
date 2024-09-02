import { Injectable } from '@nestjs/common';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import axios from 'axios';
import * as QRCode from 'qrcode';

@Injectable()
export class WppconnectService {
  private sessions: Map<string, Whatsapp> = new Map();
  private qrCodes: Map<string, Buffer> = new Map();

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
      try {
        await axios.post('http://localhost:3000/whatsapp/events', { session: sessionName, ...message });
      } catch (error) {
        console.error(`Erro ao enviar a mensagem para o endpoint da sessão ${sessionName}:`, error.message);
      }
    });

    client.onStateChange((state) => {
      console.log(`[${sessionName}] Estado alterado:`, state);
    });

    console.log(`Sessão ${sessionName} criada com sucesso.`);
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
