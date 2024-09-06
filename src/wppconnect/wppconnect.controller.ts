import { Controller, Post, Body, Get, Param, Delete, Res, Sse, UseGuards } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { EventDto } from './dto/event.dto';
import { Response } from 'express';
import { Observable, Subject, merge } from 'rxjs';
import { map } from 'rxjs/operators';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WppconnectController {
  private messageSubject = new Subject<any>(); // Gerencia mensagens novas
  private eventSubject = new Subject<any>();   // Gerencia outros eventos
  private eventLog: any[] = []; // Adicionado: Log para armazenar eventos


  constructor(private readonly wppconnectService: WppconnectService) {
    // Observa novas mensagens e emite para o fluxo SSE
    this.wppconnectService.onNewMessage().subscribe((message) => {
      this.messageSubject.next(message);
    });

    // Observa outros eventos e emite para o fluxo SSE
    this.wppconnectService.onNewEvent().subscribe((event) => {
      this.eventSubject.next(event);
    });
  }


  @Sse('stream-events')
  @ApiOperation({ summary: 'Stream de novas mensagens e eventos via SSE' })
  streamEvents(): Observable<any> {
    return merge(
      this.messageSubject.asObservable().pipe(map((message) => ({ type: 'message', data: message }))),
      this.eventSubject.asObservable().pipe(map((event) => ({ type: 'event', data: event })))
    );
  }

  @Get('events-log')
  @ApiOperation({ summary: 'Obter o log de todos os eventos do WhatsApp' })
  getEventsLog() {
    return this.eventLog;
  }

  @Post('create-session/:sessionName')
  @ApiOperation({ summary: 'Criar uma nova sessão do WhatsApp' })
  async createSession(@Param('sessionName') sessionName: string) {
    await this.wppconnectService.createSession(sessionName);
    return { status: `Sessão ${sessionName} criada com sucesso` };
  }

  @Get('get-qr-code/:sessionName')
  @ApiOperation({ summary: 'Obter o QR Code de uma sessão do WhatsApp' })
  async getQRCode(@Param('sessionName') sessionName: string, @Res() res: Response) {
    try {
      const qrCodeImage = await this.wppconnectService.getQRCodeImage(sessionName);
      res.setHeader('Content-Type', 'image/png'); 
      res.send(qrCodeImage); // Envia a imagem como resposta
    } catch (error) {
      res.status(404).json({ message: error.message });
    }
  }

  @Delete('remove-session/:sessionName')
  @ApiOperation({ summary: 'Remover uma sessão do WhatsApp' })
  async removeSession(@Param('sessionName') sessionName: string) {
    await this.wppconnectService.removeSession(sessionName);
    return { status: `Sessão ${sessionName} removida com sucesso` };
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
    this.eventSubject.next(event); // Envia o evento para o stream SSE
    this.eventLog.push(event); // Adicionado: Armazena o evento no log
    return { status: 'Evento recebido, ainnn que demaisss' };
  }
  
  @Get('sessions')
  @ApiOperation({ summary: 'Listar todas as sessões ativas' })
  async getSessions() {
    return this.wppconnectService.getSessions();
  }

  @Get('status/:sessionName')
  @ApiOperation({ summary: 'Obter o status de uma sessão do WhatsApp' })
  async getStatus(@Param('sessionName') sessionName: string) {
    const status = await this.wppconnectService.getSessionStatus(sessionName);
    return { status };
  }

  @Post('reconnect/:sessionName')
  @ApiOperation({ summary: 'Reconectar uma sessão do WhatsApp' })
  async reconnectSession(@Param('sessionName') sessionName: string) {
    await this.wppconnectService.reconnectSession(sessionName);
    return { status: `Sessão ${sessionName} reconectada com sucesso` };
  }

  // Novos endpoints para enviar diferentes tipos de mensagens como sendContactVcard, sendLocation, sendLinkPreview etc.

  @Post('send-contact-vcard/:sessionName')
  @ApiOperation({ summary: 'Enviar contato VCard via WhatsApp' })
  async sendContactVcard(@Param('sessionName') sessionName: string, @Body() body: any) {
    const { to, contact, name } = body;
    await this.wppconnectService.sendContactVcard(sessionName, to, contact, name);
    return { status: 'Contato VCard enviado com sucesso!' };
  }

  @Post('send-location/:sessionName')
  @ApiOperation({ summary: 'Enviar localização via WhatsApp' })
  async sendLocation(@Param('sessionName') sessionName: string, @Body() body: any) {
    const { to, lat, long, name } = body;
    await this.wppconnectService.sendLocation(sessionName, to, lat, long, name);
    return { status: 'Localização enviada com sucesso!' };
  }
}
