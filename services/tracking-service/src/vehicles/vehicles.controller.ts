import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AccessService, bearerToken } from '../auth/access.service';
import { EtaService } from '../eta/eta.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('api/vehicles')
export class VehiclesController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly etaService: EtaService,
    private readonly accessService: AccessService,
  ) {}

  @Get()
  async listLive(@Headers('authorization') auth?: string) {
    const access = this.accessService.authorize(bearerToken(auth));
    if (access.kind !== 'fleet') {
      throw new ForbiddenException('Fleet view is for staff only');
    }
    return this.telemetryService.getAllLive();
  }

  @Get(':reg')
  async getOne(@Param('reg') reg: string, @Headers('authorization') auth?: string) {
    this.requireVehicle(auth, reg);
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
    @Headers('authorization') auth?: string,
  ) {
    this.requireVehicle(auth, reg);
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

  private requireVehicle(auth: string | undefined, reg: string) {
    const access = this.accessService.authorize(bearerToken(auth));
    if (!this.accessService.canView(access, reg)) {
      throw new ForbiddenException('Your ticket does not cover this vehicle');
    }
  }
}
