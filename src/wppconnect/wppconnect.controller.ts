// src/wppconnect/wppconnect.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { EventDto } from './dto/event.dto';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WppconnectController {
  constructor(private readonly wppconnectService: WppconnectService) {}

  @Post('create-session/:sessionName')
  @ApiOperation({ summary: 'Criar uma nova sessão do WhatsApp' })
  async createSession(@Param('sessionName') sessionName: string) {
    await this.wppconnectService.createSession(sessionName);
    return { status: `Sessão ${sessionName} criada com sucesso` };
  }

  @Post('send-message/:sessionName')
  @ApiOperation({ summary: 'Enviar uma mensagem via WhatsApp em uma sessão específica' })
  @ApiBody({ type: SendMessageDto })
  async sendMessage(@Param('sessionName') sessionName: string, @Body() body: SendMessageDto) {
    const { to, message } = body;
    await this.wppconnectService.sendMessage(sessionName, to, message);
    return { status: 'Mensagem enviada papai' };
  }

  @Post('events')
  @ApiOperation({ summary: 'Receber eventos do WhatsApp' })
  @ApiBody({ type: EventDto })
  async handleEvent(@Body() event: EventDto) {
    console.log('Evento Recebido:', event);
    return { status: 'Evento recebido, ainnn que demaisss' };
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Listar todas as sessões ativas' })
  async getSessions() {
    return this.wppconnectService.getSessions();
  }
}
