import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global API prefix
  app.setGlobalPrefix('api/v1');

  const webUrl = configService.get<string>("WEB_URL") ?? "http://localhost:3000";
  app.enableCors({
    origin: webUrl,
    credentials: true,
    allowedHeaders: ["Content-Type", "x-admin-token", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('GongGu Wish API')
    .setDescription('Instagram 공동구매 수집, 검수, 알림 API')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(configService.get<number>('API_PORT') ?? 3000);
}

void bootstrap();
