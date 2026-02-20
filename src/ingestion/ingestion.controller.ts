import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { MeterReadingDto } from './dto/meter-reading.dto';
import { VehicleReadingDto } from './dto/vehicle-reading.dto';
import {
  BatchMeterReadingDto,
  BatchVehicleReadingDto,
} from './dto/batch-reading.dto';

@Controller('v1/ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Single meter heartbeat ingestion.
   * POST /v1/ingestion/meter
   */
  @Post('meter')
  @HttpCode(HttpStatus.CREATED)
  async ingestMeter(@Body() dto: MeterReadingDto) {
    await this.ingestionService.ingestMeterReading(dto);
    return { status: 'ok', type: 'meter', meterId: dto.meterId };
  }

  /**
   * Single vehicle heartbeat ingestion.
   * POST /v1/ingestion/vehicle
   */
  @Post('vehicle')
  @HttpCode(HttpStatus.CREATED)
  async ingestVehicle(@Body() dto: VehicleReadingDto) {
    await this.ingestionService.ingestVehicleReading(dto);
    return { status: 'ok', type: 'vehicle', vehicleId: dto.vehicleId };
  }

  /**
   * Batch meter ingestion for bulk loading.
   * POST /v1/ingestion/meter/batch
   */
  @Post('meter/batch')
  @HttpCode(HttpStatus.CREATED)
  async ingestMeterBatch(@Body() dto: BatchMeterReadingDto) {
    const result = await this.ingestionService.ingestMeterBatch(dto.readings);
    return { status: 'ok', type: 'meter_batch', ...result };
  }

  /**
   * Batch vehicle ingestion for bulk loading.
   * POST /v1/ingestion/vehicle/batch
   */
  @Post('vehicle/batch')
  @HttpCode(HttpStatus.CREATED)
  async ingestVehicleBatch(@Body() dto: BatchVehicleReadingDto) {
    const result = await this.ingestionService.ingestVehicleBatch(dto.readings);
    return { status: 'ok', type: 'vehicle_batch', ...result };
  }
}
