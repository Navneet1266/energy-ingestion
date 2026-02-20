-- =============================================================
-- Energy Ingestion Engine - Database Initialization
-- =============================================================
-- Strategy:
--   COLD (Historical) tables: partitioned by month for fast time-range scans
--   HOT  (Live Status) tables: single-row-per-device with UPSERT semantics
-- =============================================================

-- -----------------------------------------------
-- COLD STORE: Meter Telemetry History (Partitioned)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS meter_telemetry_history (
    id              UUID DEFAULT gen_random_uuid(),
    meter_id        VARCHAR(64)      NOT NULL,
    kwh_consumed_ac DOUBLE PRECISION NOT NULL,
    voltage         DOUBLE PRECISION NOT NULL,
    timestamp       TIMESTAMPTZ      NOT NULL,
    ingested_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

CREATE INDEX IF NOT EXISTS idx_meter_history_meter_ts
    ON meter_telemetry_history (meter_id, timestamp);

-- Create monthly partitions for current and next 3 months
DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    FOR i IN 0..3 LOOP
        partition_start := start_date + (i || ' months')::INTERVAL;
        partition_end   := start_date + ((i + 1) || ' months')::INTERVAL;
        partition_name  := 'meter_telemetry_history_' || to_char(partition_start, 'YYYY_MM');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF meter_telemetry_history
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_start, partition_end
        );
    END LOOP;
END $$;

-- -----------------------------------------------
-- COLD STORE: Vehicle Telemetry History (Partitioned)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_telemetry_history (
    id               UUID DEFAULT gen_random_uuid(),
    vehicle_id       VARCHAR(64)      NOT NULL,
    soc              DOUBLE PRECISION NOT NULL,
    kwh_delivered_dc DOUBLE PRECISION NOT NULL,
    battery_temp     DOUBLE PRECISION NOT NULL,
    timestamp        TIMESTAMPTZ      NOT NULL,
    ingested_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

CREATE INDEX IF NOT EXISTS idx_vehicle_history_vehicle_ts
    ON vehicle_telemetry_history (vehicle_id, timestamp);

DO $$
DECLARE
    start_date DATE := date_trunc('month', CURRENT_DATE);
    partition_name TEXT;
    partition_start DATE;
    partition_end DATE;
BEGIN
    FOR i IN 0..3 LOOP
        partition_start := start_date + (i || ' months')::INTERVAL;
        partition_end   := start_date + ((i + 1) || ' months')::INTERVAL;
        partition_name  := 'vehicle_telemetry_history_' || to_char(partition_start, 'YYYY_MM');

        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF vehicle_telemetry_history
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_start, partition_end
        );
    END LOOP;
END $$;

-- -----------------------------------------------
-- HOT STORE: Meter Live Status (one row per meter)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS meter_live_status (
    meter_id        VARCHAR(64)      PRIMARY KEY,
    kwh_consumed_ac DOUBLE PRECISION NOT NULL,
    voltage         DOUBLE PRECISION NOT NULL,
    last_seen       TIMESTAMPTZ      NOT NULL
);

-- -----------------------------------------------
-- HOT STORE: Vehicle Live Status (one row per vehicle)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_live_status (
    vehicle_id       VARCHAR(64)      PRIMARY KEY,
    soc              DOUBLE PRECISION NOT NULL,
    kwh_delivered_dc DOUBLE PRECISION NOT NULL,
    battery_temp     DOUBLE PRECISION NOT NULL,
    last_seen        TIMESTAMPTZ      NOT NULL
);

-- -----------------------------------------------
-- CORRELATION: Charging Sessions (links vehicle <-> meter)
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS charging_sessions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id  VARCHAR(64)  NOT NULL,
    meter_id    VARCHAR(64)  NOT NULL,
    started_at  TIMESTAMPTZ  NOT NULL,
    ended_at    TIMESTAMPTZ,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_charging_session_vehicle
    ON charging_sessions (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_charging_session_meter
    ON charging_sessions (meter_id);
CREATE INDEX IF NOT EXISTS idx_charging_session_active
    ON charging_sessions (vehicle_id, is_active) WHERE is_active = TRUE;
