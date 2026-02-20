import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /v1/analytics/performance/:vehicleId
   * Returns 24-hour energy performance summary for a vehicle.
   */
  @Get('performance/:vehicleId')
  async getPerformance(@Param('vehicleId') vehicleId: string) {
    return this.analyticsService.getPerformanceSummary(vehicleId);
  }
}
