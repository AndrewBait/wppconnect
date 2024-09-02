import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';


async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync('server.key'), 
    cert: fs.readFileSync('server.cert'), 
  };

  const app = await NestFactory.create(AppModule, { httpsOptions });
  
  // Configurandinho do Swagger
  const config = new DocumentBuilder()
    .setTitle('WhatsApp Bot API')
    .setDescription('API para automatizar mensagens e eventos do WhatsApp usando WPPConnect')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  await app.listen(3000);
}
bootstrap();
