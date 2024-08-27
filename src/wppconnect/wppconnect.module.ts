// src/wppconnect/wppconnect.module.ts
import { Module } from '@nestjs/common';
import { WppconnectService } from './wppconnect.service';

@Module({
  providers: [WppconnectService],
  exports: [WppconnectService],
})
export class WppconnectModule {}
