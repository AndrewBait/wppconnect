// src/wppconnect/wppconnect.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';

@Controller('whatsapp')
export class WppconnectController {
  constructor(private readonly wppconnectService: WppconnectService) {}

  @Post('send-message')
  async sendMessage(@Body() body: { to: string; message: string }) {
    const { to, message } = body;
    await this.wppconnectService.sendMessage(to, message);
    return { status: 'Message sent' };
  }
  
  @Post('events')
  async handleEvent(@Body() event: any) {
    console.log('Event received:', event);
    // Lide com o evento como quiser
    return { status: 'Event received' };
  }
}
