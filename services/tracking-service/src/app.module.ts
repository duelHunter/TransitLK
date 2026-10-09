import { Module } from '@nestjs/common';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { HealthController } from './health.controller';

@Module({
  imports: [RedisModule, KafkaModule, TelemetryModule, VehiclesModule],
  controllers: [HealthController],
})
export class AppModule {}
