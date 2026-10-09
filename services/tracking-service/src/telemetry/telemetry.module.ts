import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { MqttSubscriber } from '../mqtt/mqtt.subscriber';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

@Module({
  imports: [LocationModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, MqttSubscriber],
  exports: [TelemetryService],
})
export class TelemetryModule {}
