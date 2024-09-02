import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WppconnectModule } from './wppconnect/wppconnect.module';

@Module({
  imports: [WppconnectModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
