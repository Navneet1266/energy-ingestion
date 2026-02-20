five # Energy Ingestion Engine

High-scale backend for ingesting telemetry from 10,000+ Smart Meters and EV Fleets, built with NestJS, TypeScript, and PostgreSQL.

## Quick Start

```bash
# Start PostgreSQL + App with Docker
docker-compose up --build

# Or run locally (requires PostgreSQL running)
npm install
npm run build
npm run start
```

The API will be available at `http://localhost:3000`.

## Architecture

### Data Flow

```
Smart Meter (AC) ──┐                  ┌── meter_telemetry_history (COLD)
                   ├─→ Ingestion API ─┤
EV / Charger (DC) ─┘                  ├── vehicle_telemetry_history (COLD)
                                       ├── meter_live_status (HOT)
                                       └── vehicle_live_status (HOT)
```

### Hot vs Cold Data Strategy

The system separates storage into two tiers optimized for different access patterns:

**Cold Store (Historical)** — `*_telemetry_history` tables
- **Purpose**: Append-only audit trail of every 60-second heartbeat.
- **Operation**: Pure `INSERT` — no updates, no deletes. Every reading is preserved.
- **Optimization**: Tables are **partitioned by month** on the `timestamp` column. PostgreSQL automatically prunes irrelevant partitions during time-range queries, preventing full table scans.
- **Indexing**: Composite B-tree index on `(device_id, timestamp)` enables fast range scans for per-device analytics.

**Hot Store (Live Status)** — `*_live_status` tables
- **Purpose**: Dashboard-ready "current state" — one row per device.
- **Operation**: `UPSERT` (INSERT ... ON CONFLICT UPDATE) — atomically creates or overwrites the row.
- **Benefit**: Reading the current SoC or voltage is a single primary-key lookup, not a `MAX(timestamp)` scan over millions of rows.

### Data Correlation

Smart Meters and EVs are independent hardware. The `charging_sessions` table creates the logical link:

```
charging_sessions
├── vehicle_id  →  identifies the vehicle
├── meter_id    →  identifies which meter is measuring AC for this vehicle
├── started_at  →  session start
├── ended_at    →  session end (NULL if active)
└── is_active   →  fast filter for current sessions
```

The analytics endpoint uses this table to discover which meter(s) provided AC power to a specific vehicle, then joins their telemetry for the efficiency calculation.

### Handling 14.4 Million Records/Day

With 10,000 meters + 10,000 vehicles reporting every 60 seconds:
- **10,000 × 1,440 min/day = 14.4M meter readings/day**
- **10,000 × 1,440 min/day = 14.4M vehicle readings/day**
- **Total: ~28.8M rows/day across both streams**

The system handles this through:

1. **Monthly Partitioning**: Each partition holds ~30 days of data. Queries with `WHERE timestamp >= X` only scan relevant partitions. Old partitions can be detached and archived without impacting live performance.

2. **Composite Indexes**: `(device_id, timestamp)` indexes allow the DB to jump directly to a device's readings within a time window — no sequential scan needed.

3. **Hot/Cold Separation**: Dashboard queries ("What's vehicle X's current SoC?") hit the tiny live-status table (max 10K rows) instead of scanning hundreds of millions of history rows.

4. **Batch Ingestion**: The `/batch` endpoints accept arrays of readings, reducing HTTP overhead and enabling bulk `INSERT` statements.

5. **Transactional Writes**: Each ingestion atomically writes to both hot and cold stores within a single PostgreSQL transaction, ensuring consistency without sacrificing throughput.

## API Reference

### Ingestion Endpoints

#### POST `/v1/ingestion/meter`
Ingest a single smart meter heartbeat.

```json
{
  "meterId": "METER-001",
  "kwhConsumedAc": 12.5,
  "voltage": 230.1,
  "timestamp": "2026-02-10T14:30:00Z"
}
```

#### POST `/v1/ingestion/vehicle`
Ingest a single vehicle/charger heartbeat.

```json
{
  "vehicleId": "VH-001",
  "soc": 72.5,
  "kwhDeliveredDc": 10.8,
  "batteryTemp": 32.4,
  "timestamp": "2026-02-10T14:30:00Z"
}
```

#### POST `/v1/ingestion/meter/batch`
Bulk ingest meter readings.

```json
{
  "readings": [
    { "meterId": "METER-001", "kwhConsumedAc": 12.5, "voltage": 230.1, "timestamp": "2026-02-10T14:30:00Z" },
    { "meterId": "METER-002", "kwhConsumedAc": 8.3, "voltage": 229.8, "timestamp": "2026-02-10T14:30:00Z" }
  ]
}
```

#### POST `/v1/ingestion/vehicle/batch`
Bulk ingest vehicle readings.

```json
{
  "readings": [
    { "vehicleId": "VH-001", "soc": 72.5, "kwhDeliveredDc": 10.8, "batteryTemp": 32.4, "timestamp": "2026-02-10T14:30:00Z" },
    { "vehicleId": "VH-002", "soc": 45.0, "kwhDeliveredDc": 6.2, "batteryTemp": 28.1, "timestamp": "2026-02-10T14:30:00Z" }
  ]
}
```

### Analytics Endpoint

#### GET `/v1/analytics/performance/:vehicleId`

Returns a 24-hour energy performance summary.

**Response:**
```json
{
  "vehicleId": "VH-001",
  "periodStart": "2026-02-09T14:30:00.000Z",
  "periodEnd": "2026-02-10T14:30:00.000Z",
  "totalAcConsumedKwh": 150.234,
  "totalDcDeliveredKwh": 128.7,
  "efficiencyRatio": 0.8567,
  "avgBatteryTemp": 31.25,
  "readingsCount": {
    "vehicle": 1440,
    "meter": 1440
  }
}
```

**Key fields:**
- `efficiencyRatio`: DC Delivered / AC Consumed. Values below 0.85 suggest hardware faults or energy leakage.
- `avgBatteryTemp`: Mean battery temperature over 24h — elevated values indicate potential thermal issues.

## Database Schema

```
┌─────────────────────────────────┐  ┌──────────────────────────────────┐
│  meter_telemetry_history (COLD) │  │ vehicle_telemetry_history (COLD) │
│  Partitioned by month           │  │ Partitioned by month             │
│─────────────────────────────────│  │──────────────────────────────────│
│  id (UUID)                      │  │  id (UUID)                       │
│  meter_id                       │  │  vehicle_id                      │
│  kwh_consumed_ac                │  │  soc                             │
│  voltage                        │  │  kwh_delivered_dc                │
│  timestamp (partition key)      │  │  battery_temp                    │
│  ingested_at                    │  │  timestamp (partition key)       │
│  IDX: (meter_id, timestamp)     │  │  ingested_at                    │
└─────────────────────────────────┘  │  IDX: (vehicle_id, timestamp)   │
                                     └──────────────────────────────────┘

┌──────────────────────┐  ┌───────────────────────┐  ┌─────────────────────┐
│ meter_live_status    │  │ vehicle_live_status    │  │ charging_sessions   │
│ (HOT)                │  │ (HOT)                  │  │ (CORRELATION)       │
│──────────────────────│  │───────────────────────│  │─────────────────────│
│ meter_id (PK)        │  │ vehicle_id (PK)        │  │ id (UUID, PK)       │
│ kwh_consumed_ac      │  │ soc                    │  │ vehicle_id          │
│ voltage              │  │ kwh_delivered_dc       │  │ meter_id            │
│ last_seen            │  │ battery_temp           │  │ started_at          │
└──────────────────────┘  │ last_seen              │  │ ended_at            │
                          └───────────────────────┘  │ is_active           │
                                                      └─────────────────────┘
```

## Project Structure

```
src/
├── main.ts                        # Bootstrap with validation pipe
├── app.module.ts                  # Root module wiring
├── config/
│   └── database.config.ts         # TypeORM PostgreSQL configuration
├── database/
│   └── entities/                  # TypeORM entity definitions
│       ├── meter-telemetry-history.entity.ts
│       ├── vehicle-telemetry-history.entity.ts
│       ├── meter-live-status.entity.ts
│       ├── vehicle-live-status.entity.ts
│       └── charging-session.entity.ts
├── ingestion/
│   ├── ingestion.module.ts
│   ├── ingestion.controller.ts    # POST endpoints for meter & vehicle
│   ├── ingestion.service.ts       # INSERT (cold) + UPSERT (hot) logic
│   └── dto/                       # Validation DTOs
│       ├── meter-reading.dto.ts
│       ├── vehicle-reading.dto.ts
│       └── batch-reading.dto.ts
└── analytics/
    ├── analytics.module.ts
    ├── analytics.controller.ts    # GET /performance/:vehicleId
    └── analytics.service.ts       # 24h aggregation with correlation
```

## Environment Variables

| Variable      | Default       | Description             |
|---------------|---------------|-------------------------|
| `DB_HOST`     | `localhost`   | PostgreSQL host         |
| `DB_PORT`     | `5432`        | PostgreSQL port         |
| `DB_USERNAME` | `postgres`    | Database user           |
| `DB_PASSWORD` | `postgres`    | Database password       |
| `DB_NAME`     | `energy_ingestion` | Database name      |
| `PORT`        | `3000`        | Application port        |
