import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { EtaService } from '../eta/eta.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('api/vehicles')
export class VehiclesController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly etaService: EtaService,
  ) {}

  @Get()
  async listLive() {
    return this.telemetryService.getAllLive();
  }

  @Get(':reg')
  async getOne(@Param('reg') reg: string) {
    const live = await this.telemetryService.getLive(reg);
    if (!live) {
      throw new NotFoundException(`No live position for vehicle ${reg} (offline or unseen)`);
    }
    return live;
  }

  @Get(':reg/eta')
  async eta(
    @Param('reg') reg: string,
    @Query('destLat') destLat: string,
    @Query('destLon') destLon: string,
  ) {
    if (!destLat || !destLon) {
      throw new BadRequestException('destLat and destLon query params are required');
    }
    const live = await this.telemetryService.getLive(reg);
    if (!live) {
      throw new NotFoundException(`No live position for vehicle ${reg}`);
    }
    const lat2 = parseFloat(destLat);
    const lon2 = parseFloat(destLon);
    const distanceKm = this.etaService.haversineKm(live.lat, live.lon, lat2, lon2);
    const etaSeconds = this.etaService.etaSeconds(live.lat, live.lon, lat2, lon2, live.speedKmh);
    return { vehicleReg: reg, distanceKm: Math.round(distanceKm * 100) / 100, etaSeconds, current: live };
  }
}
