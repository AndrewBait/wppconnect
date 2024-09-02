import { Injectable, OnModuleInit } from '@nestjs/common';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import axios from 'axios';

@Injectable()
export class WppconnectService {
  private sessions: Map<string, Whatsapp> = new Map();

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
