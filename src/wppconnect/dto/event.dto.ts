import { ApiProperty } from '@nestjs/swagger';

export class EventDto {
  @ApiProperty({ example: 'example_id', description: 'ID da mensagem recebida.' })
  id: string;

  @ApiProperty({ example: 'Ain pai para', description: 'Conteúdo da mensagem recebida.' })
  body: string;

  @ApiProperty({ example: '5512997886488', description: 'Número de telefone do remetente no formato internacional.' })
  from: string;

}