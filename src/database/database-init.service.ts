import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseInitService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseInitService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit() {
    try {
      const sqlPath = path.join(process.cwd(), 'db', 'init.sql');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await this.dataSource.query(sql);
      this.logger.log('Database schema initialized');
    } catch (error) {
      this.logger.warn(`Schema init skipped or already applied: ${error.message}`);
    }
  }
}
