import { Controller, Post, Body } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { EventDto } from './dto/event.dto';


@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WppconnectController {
  constructor(private readonly wppconnectService: WppconnectService) {}

  @Post('send-message')
  @ApiOperation({ summary: 'Enviar uma mensagem via WhatsApp' })
  @ApiBody({ type: SendMessageDto })
  async sendMessage(@Body() body: SendMessageDto) {
    const { to, message } = body;
    await this.wppconnectService.sendMessage(to, message);
    return { status: 'Mensagem enviada papai' };
  }
  
  @Post('events')
  @ApiOperation({ summary: 'Receber eventos do WhatsApp' })
  @ApiBody({ type: EventDto })
  async handleEvent(@Body() event: EventDto) {
    console.log('EEvento Recebido:', event);
    // POSSO SALVAR DEPOIS SE EU QUISER O EVENTO NO BANCO
    return { status: 'Evento recebido, ainnn que demaisss' };
  }
}
