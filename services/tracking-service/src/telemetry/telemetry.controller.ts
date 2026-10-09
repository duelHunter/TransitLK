import { Body, Controller, Post } from '@nestjs/common';
import { TelemetryPingDto } from './telemetry-ping.dto';
import { TelemetryService } from './telemetry.service';

/**
 * REST fallback for the MQTT ingestion path (useful for devices/tools that can't speak
 * MQTT, and for exercising the flow with curl/Postman during development).
 */
@Controller('api/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  async ingest(@Body() ping: TelemetryPingDto) {
    await this.telemetryService.ingest(ping);
    return { status: 'accepted' };
  }
}
