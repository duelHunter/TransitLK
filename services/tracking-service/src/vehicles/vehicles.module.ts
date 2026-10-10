import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EtaModule } from '../eta/eta.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [AuthModule, TelemetryModule, EtaModule],
  controllers: [VehiclesController],
})
export class VehiclesModule {}
