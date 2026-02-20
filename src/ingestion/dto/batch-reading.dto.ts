import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { MeterReadingDto } from './meter-reading.dto';
import { VehicleReadingDto } from './vehicle-reading.dto';

export class BatchMeterReadingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeterReadingDto)
  readings: MeterReadingDto[];
}

export class BatchVehicleReadingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleReadingDto)
  readings: VehicleReadingDto[];
}
