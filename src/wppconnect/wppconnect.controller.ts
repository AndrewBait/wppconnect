import { Controller, Post, Body, Get, Param, Delete, Res, Sse } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { EventDto } from './dto/event.dto';
import { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';


@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WppconnectController {
  private messageSubject = new Subject<any>(); // Sujeito para gerenciar mensagens novas

  constructor(private readonly wppconnectService: WppconnectService) {
    // Observa novas mensagens e emite para o fluxo SSE
    this.wppconnectService.onNewMessage().subscribe((message) => {
      this.messageSubject.next(message);
    });
  }

  @Sse('stream-messages')
  @ApiOperation({ summary: 'Stream de novas mensagens via SSE' })
  streamMessages(): Observable<any> {
    return this.messageSubject.asObservable().pipe(
      map((message) => ({ data: message }))
    );
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
      res.setHeader('Content-Type', 'image/png'); // Define o tipo de resposta como imagem PNG
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
}
