import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface PerformanceSummary {
  vehicleId: string;
  periodStart: string;
  periodEnd: string;
  totalAcConsumedKwh: number;
  totalDcDeliveredKwh: number;
  efficiencyRatio: number | null;
  avgBatteryTemp: number;
  readingsCount: {
    vehicle: number;
    meter: number;
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * GET /v1/analytics/performance/:vehicleId
   *
   * Returns a 24-hour performance summary by:
   *  1. Looking up the meter(s) correlated with this vehicle via charging_sessions.
   *  2. Querying the COLD store with time-bounded + index-backed scans.
   *  3. Computing efficiency = DC_delivered / AC_consumed.
   *
   * The composite index (vehicle_id, timestamp) and (meter_id, timestamp)
   * on the partitioned history tables ensures no full table scan occurs;
   * PostgreSQL prunes irrelevant partitions and uses index range scans.
   */
  async getPerformanceSummary(vehicleId: string): Promise<PerformanceSummary> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Step 1: Get correlated meter IDs for this vehicle
    const sessions = await this.dataSource.query(
      `SELECT DISTINCT meter_id FROM charging_sessions
       WHERE vehicle_id = $1
         AND (is_active = TRUE OR ended_at > $2)`,
      [vehicleId, twentyFourHoursAgo],
    );

    if (sessions.length === 0) {
      throw new NotFoundException(
        `No active charging session found for vehicle ${vehicleId}`,
      );
    }

    const meterIds: string[] = sessions.map(
      (s: { meter_id: string }) => s.meter_id,
    );

    // Step 2: Aggregate vehicle telemetry (DC side) – index scan on (vehicle_id, timestamp)
    const vehicleAgg = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(kwh_delivered_dc), 0) AS total_dc_kwh,
         COALESCE(AVG(battery_temp), 0)     AS avg_battery_temp,
         COUNT(*)                            AS readings_count
       FROM vehicle_telemetry_history
       WHERE vehicle_id = $1
         AND timestamp >= $2
         AND timestamp <= $3`,
      [vehicleId, twentyFourHoursAgo, now],
    );

    // Step 3: Aggregate meter telemetry (AC side) – index scan on (meter_id, timestamp)
    const meterPlaceholders = meterIds
      .map((_, i) => `$${i + 3}`)
      .join(', ');

    const meterAgg = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(kwh_consumed_ac), 0) AS total_ac_kwh,
         COUNT(*)                           AS readings_count
       FROM meter_telemetry_history
       WHERE meter_id IN (${meterPlaceholders})
         AND timestamp >= $1
         AND timestamp <= $2`,
      [twentyFourHoursAgo, now, ...meterIds],
    );

    const totalAc = parseFloat(meterAgg[0].total_ac_kwh);
    const totalDc = parseFloat(vehicleAgg[0].total_dc_kwh);
    const avgTemp = parseFloat(vehicleAgg[0].avg_battery_temp);

    // Efficiency = DC delivered / AC consumed (null if no AC data)
    const efficiency = totalAc > 0 ? totalDc / totalAc : null;

    return {
      vehicleId,
      periodStart: twentyFourHoursAgo.toISOString(),
      periodEnd: now.toISOString(),
      totalAcConsumedKwh: Math.round(totalAc * 1000) / 1000,
      totalDcDeliveredKwh: Math.round(totalDc * 1000) / 1000,
      efficiencyRatio: efficiency !== null
        ? Math.round(efficiency * 10000) / 10000
        : null,
      avgBatteryTemp: Math.round(avgTemp * 100) / 100,
      readingsCount: {
        vehicle: parseInt(vehicleAgg[0].readings_count, 10),
        meter: parseInt(meterAgg[0].readings_count, 10),
      },
    };
  }
}
