import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: '5599999999999', description: 'Número de telefone do destinatário no formato internacional.' })
  to: string;

  @ApiProperty({ example: 'Olá!', description: 'Conteúdo da mensagem a ser enviada.' })
  message: string;
}