import { Module } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';
import { WppconnectController } from './wppconnect.controller';

@Module({
  controllers: [WppconnectController],
  providers: [WppconnectService],
})
export class WppconnectModule {}
