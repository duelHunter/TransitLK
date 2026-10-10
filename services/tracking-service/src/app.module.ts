import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AuthModule, RedisModule, KafkaModule, TelemetryModule, VehiclesModule],
  controllers: [HealthController],
})
export class AppModule {}
