import { IsString, IsNumber, IsDateString, IsNotEmpty } from 'class-validator';

export class VehicleReadingDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsNumber()
  soc: number;

  @IsNumber()
  kwhDeliveredDc: number;

  @IsNumber()
  batteryTemp: number;

  @IsDateString()
  timestamp: string;
}
