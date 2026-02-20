import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('vehicle_live_status')
export class VehicleLiveStatus {
  @PrimaryColumn({ name: 'vehicle_id' })
  vehicleId: string;

  @Column({ type: 'double precision' })
  soc: number;

  @Column({ name: 'kwh_delivered_dc', type: 'double precision' })
  kwhDeliveredDc: number;

  @Column({ name: 'battery_temp', type: 'double precision' })
  batteryTemp: number;

  @Column({ name: 'last_seen', type: 'timestamptz' })
  lastSeen: Date;
}
