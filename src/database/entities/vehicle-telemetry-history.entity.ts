import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('vehicle_telemetry_history')
@Index('idx_vehicle_history_vehicle_ts', ['vehicleId', 'timestamp'])
export class VehicleTelemetryHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @Column({ type: 'double precision' })
  soc: number;

  @Column({ name: 'kwh_delivered_dc', type: 'double precision' })
  kwhDeliveredDc: number;

  @Column({ name: 'battery_temp', type: 'double precision' })
  batteryTemp: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'ingested_at', type: 'timestamptz', default: () => 'NOW()' })
  ingestedAt: Date;
}
