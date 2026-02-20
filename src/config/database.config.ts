import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => {
  const useSsl = process.env.DB_SSL?.trim() === 'true';
  const sslExtra = useSsl ? { ssl: { rejectUnauthorized: false } } : {};

  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    return {
      type: 'postgres',
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      username: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
      autoLoadEntities: true,
      synchronize: false,
      retryAttempts: 3,
      retryDelay: 1000,
      extra: { ...sslExtra },
    };
  }

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'energy_ingestion',
    autoLoadEntities: true,
    synchronize: false,
    extra: { ...sslExtra },
  };
};
