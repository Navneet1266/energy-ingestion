import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => {
  const useSsl = process.env.DB_SSL === 'true';
  const ssl = useSsl ? { rejectUnauthorized: false } : false;

  const base: Partial<TypeOrmModuleOptions> = {
    type: 'postgres',
    autoLoadEntities: true,
    synchronize: false,
    retryAttempts: 3,
    retryDelay: 1000,
  };

  if (process.env.DATABASE_URL) {
    // Parse URL manually so TypeORM receives individual fields + explicit ssl
    const u = new URL(process.env.DATABASE_URL);
    return {
      ...(base as TypeOrmModuleOptions),
      host: u.hostname,
      port: u.port ? parseInt(u.port, 10) : 5432,
      username: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, ''),
      ssl,
    };
  }

  return {
    ...(base as TypeOrmModuleOptions),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'energy_ingestion',
    ssl,
  };
};
