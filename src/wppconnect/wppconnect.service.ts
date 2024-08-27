// src/wppconnect/wppconnect.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { create, Whatsapp } from '@wppconnect-team/wppconnect';
import axios from 'axios';

@Injectable()
export class WppconnectService implements OnModuleInit {
  private client: Whatsapp;

  async onModuleInit() {
    this.client = await create({
      session: 'whatsapp-session',
      headless: true,
      puppeteerOptions: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.client.onMessage(async(message) => {
      console.log('Received message:', message);
      // Aqui você pode enviar os eventos para o seu endpoint

      await axios.post('http://localhost:3000/whatsapp/events', message);
    });

    this.client.onStateChange((state) => {
      console.log('State changed:', state);
    });
  }

  async sendMessage(to: string, message: string) {
    await this.client.sendText(to, message);
  }
}
