import { Module } from '@nestjs/common';
import { EtaModule } from '../eta/eta.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [TelemetryModule, EtaModule],
  controllers: [VehiclesController],
})
export class VehiclesModule {}
