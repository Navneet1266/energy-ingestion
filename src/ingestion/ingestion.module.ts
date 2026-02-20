import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import {
  MeterTelemetryHistory,
  VehicleTelemetryHistory,
  MeterLiveStatus,
  VehicleLiveStatus,
} from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MeterTelemetryHistory,
      VehicleTelemetryHistory,
      MeterLiveStatus,
      VehicleLiveStatus,
    ]),
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
