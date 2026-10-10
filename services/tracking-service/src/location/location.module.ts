import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LocationGateway } from './location.gateway';

@Module({
  imports: [AuthModule],
  providers: [LocationGateway],
  exports: [LocationGateway],
})
export class LocationModule {}
