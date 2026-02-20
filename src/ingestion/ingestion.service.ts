import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  MeterTelemetryHistory,
  VehicleTelemetryHistory,
  MeterLiveStatus,
  VehicleLiveStatus,
} from '../database/entities';
import { MeterReadingDto } from './dto/meter-reading.dto';
import { VehicleReadingDto } from './dto/vehicle-reading.dto';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(MeterTelemetryHistory)
    private readonly meterHistoryRepo: Repository<MeterTelemetryHistory>,
    @InjectRepository(VehicleTelemetryHistory)
    private readonly vehicleHistoryRepo: Repository<VehicleTelemetryHistory>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Ingest a single meter reading:
   *  1. INSERT into cold store (append-only history)
   *  2. UPSERT into hot store (latest status)
   */
  async ingestMeterReading(dto: MeterReadingDto): Promise<void> {
    const ts = new Date(dto.timestamp);

    await this.dataSource.transaction(async (manager) => {
      // COLD PATH: append-only INSERT for audit trail
      await manager
        .createQueryBuilder()
        .insert()
        .into(MeterTelemetryHistory)
        .values({
          meterId: dto.meterId,
          kwhConsumedAc: dto.kwhConsumedAc,
          voltage: dto.voltage,
          timestamp: ts,
        })
        .execute();

      // HOT PATH: UPSERT – keep only the latest reading per meter
      await manager
        .createQueryBuilder()
        .insert()
        .into(MeterLiveStatus)
        .values({
          meterId: dto.meterId,
          kwhConsumedAc: dto.kwhConsumedAc,
          voltage: dto.voltage,
          lastSeen: ts,
        })
        .orUpdate(
          ['kwh_consumed_ac', 'voltage', 'last_seen'],
          ['meter_id'],
        )
        .execute();
    });

    this.logger.debug(`Ingested meter reading: ${dto.meterId}`);
  }

  /**
   * Ingest a single vehicle reading:
   *  1. INSERT into cold store (append-only history)
   *  2. UPSERT into hot store (latest status)
   */
  async ingestVehicleReading(dto: VehicleReadingDto): Promise<void> {
    const ts = new Date(dto.timestamp);

    await this.dataSource.transaction(async (manager) => {
      // COLD PATH: append-only INSERT for audit trail
      await manager
        .createQueryBuilder()
        .insert()
        .into(VehicleTelemetryHistory)
        .values({
          vehicleId: dto.vehicleId,
          soc: dto.soc,
          kwhDeliveredDc: dto.kwhDeliveredDc,
          batteryTemp: dto.batteryTemp,
          timestamp: ts,
        })
        .execute();

      // HOT PATH: UPSERT – keep only the latest reading per vehicle
      await manager
        .createQueryBuilder()
        .insert()
        .into(VehicleLiveStatus)
        .values({
          vehicleId: dto.vehicleId,
          soc: dto.soc,
          kwhDeliveredDc: dto.kwhDeliveredDc,
          batteryTemp: dto.batteryTemp,
          lastSeen: ts,
        })
        .orUpdate(
          ['soc', 'kwh_delivered_dc', 'battery_temp', 'last_seen'],
          ['vehicle_id'],
        )
        .execute();
    });

    this.logger.debug(`Ingested vehicle reading: ${dto.vehicleId}`);
  }

  /**
   * Batch ingest meter readings for high-throughput scenarios.
   * Uses bulk INSERT for history + individual UPSERTs for live status.
   */
  async ingestMeterBatch(readings: MeterReadingDto[]): Promise<{ ingested: number }> {
    await this.dataSource.transaction(async (manager) => {
      // Bulk INSERT into cold store
      const historyRows = readings.map((r) => ({
        meterId: r.meterId,
        kwhConsumedAc: r.kwhConsumedAc,
        voltage: r.voltage,
        timestamp: new Date(r.timestamp),
      }));

      await manager
        .createQueryBuilder()
        .insert()
        .into(MeterTelemetryHistory)
        .values(historyRows)
        .execute();

      // UPSERT each into hot store (latest wins)
      for (const r of readings) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(MeterLiveStatus)
          .values({
            meterId: r.meterId,
            kwhConsumedAc: r.kwhConsumedAc,
            voltage: r.voltage,
            lastSeen: new Date(r.timestamp),
          })
          .orUpdate(
            ['kwh_consumed_ac', 'voltage', 'last_seen'],
            ['meter_id'],
          )
          .execute();
      }
    });

    this.logger.log(`Batch ingested ${readings.length} meter readings`);
    return { ingested: readings.length };
  }

  /**
   * Batch ingest vehicle readings for high-throughput scenarios.
   */
  async ingestVehicleBatch(readings: VehicleReadingDto[]): Promise<{ ingested: number }> {
    await this.dataSource.transaction(async (manager) => {
      // Bulk INSERT into cold store
      const historyRows = readings.map((r) => ({
        vehicleId: r.vehicleId,
        soc: r.soc,
        kwhDeliveredDc: r.kwhDeliveredDc,
        batteryTemp: r.batteryTemp,
        timestamp: new Date(r.timestamp),
      }));

      await manager
        .createQueryBuilder()
        .insert()
        .into(VehicleTelemetryHistory)
        .values(historyRows)
        .execute();

      // UPSERT each into hot store (latest wins)
      for (const r of readings) {
        await manager
          .createQueryBuilder()
          .insert()
          .into(VehicleLiveStatus)
          .values({
            vehicleId: r.vehicleId,
            soc: r.soc,
            kwhDeliveredDc: r.kwhDeliveredDc,
            batteryTemp: r.batteryTemp,
            lastSeen: new Date(r.timestamp),
          })
          .orUpdate(
            ['soc', 'kwh_delivered_dc', 'battery_temp', 'last_seen'],
            ['vehicle_id'],
          )
          .execute();
      }
    });

    this.logger.log(`Batch ingested ${readings.length} vehicle readings`);
    return { ingested: readings.length };
  }
}
