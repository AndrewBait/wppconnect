import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WppconnectModule } from './wppconnect/wppconnect.module';
import { WppconnectController } from './wppconnect/wppconnect.controller';


@Module({
  imports: [WppconnectModule],
  controllers: [WppconnectController],
  providers: [AppService],
})
export class AppModule {}
