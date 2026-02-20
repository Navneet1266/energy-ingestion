import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('meter_live_status')
export class MeterLiveStatus {
  @PrimaryColumn({ name: 'meter_id' })
  meterId: string;

  @Column({ name: 'kwh_consumed_ac', type: 'double precision' })
  kwhConsumedAc: number;

  @Column({ type: 'double precision' })
  voltage: number;

  @Column({ name: 'last_seen', type: 'timestamptz' })
  lastSeen: Date;
}
