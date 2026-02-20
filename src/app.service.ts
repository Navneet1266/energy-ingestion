import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      name: 'Energy Ingestion Engine',
      status: 'ok',
      version: '1.0.0',
      description:
        'High-scale telemetry ingestion for 10,000+ Smart Meters and EV Fleets',
      endpoints: {
        ingestion: {
          'POST /v1/ingestion/meter': 'Ingest a single smart meter reading',
          'POST /v1/ingestion/vehicle': 'Ingest a single vehicle/charger reading',
          'POST /v1/ingestion/meter/batch': 'Bulk ingest meter readings',
          'POST /v1/ingestion/vehicle/batch': 'Bulk ingest vehicle readings',
        },
        analytics: {
          'GET /v1/analytics/performance/:vehicleId':
            '24-hour energy performance summary for a vehicle',
        },
      },
    };
  }
}
