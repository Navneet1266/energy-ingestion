import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('charging_sessions')
@Index('idx_charging_session_vehicle', ['vehicleId'])
@Index('idx_charging_session_meter', ['meterId'])
export class ChargingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @Column({ name: 'meter_id' })
  meterId: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
