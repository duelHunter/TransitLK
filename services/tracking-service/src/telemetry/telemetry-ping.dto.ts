import { IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** Mirrors the class diagram's LocationPing entity (lat/long/speed/heading/timestamp). */
export class TelemetryPingDto {
  @IsString()
  vehicleReg: string;

  @IsLatitude()
  lat: number;

  @IsLongitude()
  lon: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  speedKmh?: number;

  @IsNumber()
  @IsOptional()
  heading?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}
