import { ApiProperty } from '@nestjs/swagger';

export class EventDto {
  @ApiProperty({ example: 'example_id', description: 'ID da mensagem recebida.' })
  id: string;

  @ApiProperty({ example: 'Esta é uma mensagem de teste', description: 'Conteúdo da mensagem recebida.' })
  body: string;

  @ApiProperty({ example: '559999999999999', description: 'Número de telefone do remetente no formato internacional.' })
  from: string;

}