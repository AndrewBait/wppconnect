import { Controller, Post, Body, Get, Param, Delete, Res, Sse } from '@nestjs/common'; // Certifique-se de importar Sse
import { WppconnectService } from './wppconnect.service';
import { ApiTags, ApiOperation, ApiBody, ApiExcludeEndpoint } from '@nestjs/swagger'; // Importa ApiExcludeEndpoint
import { SendMessageDto } from './dto/send-message.dto';
import { EventDto } from './dto/event.dto';
import { Response } from 'express';
import { Observable } from 'rxjs';  // Importa Observable de 'rxjs'
import { map, merge, share } from 'rxjs/operators';  // Importa operadores necessários do RxJS

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WppconnectController {
  private eventLog: any[] = []; // Log para armazenar eventos

  constructor(private readonly wppconnectService: WppconnectService) {
    this.wppconnectService.getEventObservable().subscribe((event) => {
      this.eventLog.push(event); // Armazena o evento no log
    });
  }


  @Sse('stream-events')
  @ApiExcludeEndpoint()
  streamEvents(): Observable<any> {
    return this.wppconnectService.getEventObservable().pipe(
      map((event) => ({ type: 'event', data: event }))
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
      res.send(qrCodeImage);
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
    return { status: 'Mensagem enviada com sucesso' };
  }

  @Post('events')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Receber eventos do WhatsApp' })
  @ApiBody({ type: EventDto })
  async handleEvent(@Body() event: EventDto) {
    this.wppconnectService.emitEvent(event); // Usa o método do serviço para emitir eventos
    this.eventLog.push(event); // Armazena o evento no log
    return { status: 'Evento recebido com sucesso' };
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

  @Post('send-contact-vcard/:sessionName')
  @ApiExcludeEndpoint()  // Remove da documentação Swagger
  async sendContactVcard(@Param('sessionName') sessionName: string, @Body() body: any) {
    const { to, contact, name } = body;
    await this.wppconnectService.sendContactVcard(sessionName, to, contact, name);
    return { status: 'Contato VCard enviado com sucesso!' };
  }

  @Post('send-location/:sessionName')
  @ApiExcludeEndpoint()  // Remove da documentação Swagger
  async sendLocation(@Param('sessionName') sessionName: string, @Body() body: any) {
    const { to, lat, long, name } = body;
    await this.wppconnectService.sendLocation(sessionName, to, lat, long, name);
    return { status: 'Localização enviada com sucesso!' };
  }
}
