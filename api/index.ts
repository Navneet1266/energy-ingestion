import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { Client } from 'pg';

const server = express();
let isReady = false;

async function bootstrap() {
  if (isReady) return server;

  // Raw connection test to surface the real pg error
  const probe = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    await probe.connect();
    console.log('RAW PG PROBE: connected ok');
    await probe.end();
  } catch (e: any) {
    console.error('RAW PG PROBE ERROR:', e.message, e.code);
  }

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  isReady = true;
  return server;
}

export default async (req: any, res: any) => {
  await bootstrap();
  server(req, res);
};
