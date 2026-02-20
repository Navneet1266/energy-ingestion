import { IsString, IsNumber, IsDateString, IsNotEmpty } from 'class-validator';

export class MeterReadingDto {
  @IsString()
  @IsNotEmpty()
  meterId: string;

  @IsNumber()
  kwhConsumedAc: number;

  @IsNumber()
  voltage: number;

  @IsDateString()
  timestamp: string;
}
