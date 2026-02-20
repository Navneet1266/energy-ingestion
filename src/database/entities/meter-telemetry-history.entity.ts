import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('meter_telemetry_history')
@Index('idx_meter_history_meter_ts', ['meterId', 'timestamp'])
export class MeterTelemetryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'meter_id' })
  meterId: string;

  @Column({ name: 'kwh_consumed_ac', type: 'double precision' })
  kwhConsumedAc: number;

  @Column({ type: 'double precision' })
  voltage: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'ingested_at', type: 'timestamptz', default: () => 'NOW()' })
  ingestedAt: Date;
}
