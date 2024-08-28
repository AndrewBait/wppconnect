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
      // Aqui eu envio os eventos para o meu endpoint
    try {
      await axios.post('http://localhost:3000/whatsapp/events', message);
      } catch (error) {
        console.error('Error sending message to endpoint:', error);
      }
    });

    this.client.onStateChange((state) => {
      console.log('State changed:', state);
    });
  }

  async sendMessage(to: string, message: string) {
    await this.client.sendText(to, message);
  }
}
