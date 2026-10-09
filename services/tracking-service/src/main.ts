import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8083;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`tracking-service listening on :${port}`);
}
bootstrap();
