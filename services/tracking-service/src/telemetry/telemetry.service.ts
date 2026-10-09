import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { KafkaService } from '../kafka/kafka.service';
import { LocationGateway } from '../location/location.gateway';
import { TelemetryPingDto } from './telemetry-ping.dto';

const LIVE_KEY_PREFIX = 'vehicle:live:';
const LIVE_GEO_KEY = 'vehicle:geo';
const LIVE_TTL_SECONDS = 60; // a vehicle silent for 60s is considered stale/offline

/**
 * Telemetry Ingestor (component diagram). Handles a GPS ping regardless of whether it
 * arrived over the REST fallback endpoint or the MQTT subscriber: write live state to
 * Redis (NFR1 - sub-3s propagation), fan the update out over WebSocket, and publish a
 * location-event onto Kafka for downstream consumers (analytics, notifications).
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly kafka: KafkaService,
    private readonly gateway: LocationGateway,
  ) {}

  async ingest(ping: TelemetryPingDto): Promise<void> {
    const timestamp = ping.timestamp ?? new Date().toISOString();
    const record = {
      vehicleReg: ping.vehicleReg,
      lat: ping.lat,
      lon: ping.lon,
      speedKmh: ping.speedKmh ?? 0,
      heading: ping.heading ?? 0,
      timestamp,
    };

    await this.redis.client.set(
      `${LIVE_KEY_PREFIX}${ping.vehicleReg}`,
      JSON.stringify(record),
      'EX',
      LIVE_TTL_SECONDS,
    );
    await this.redis.client.geoadd(LIVE_GEO_KEY, ping.lon, ping.lat, ping.vehicleReg);

    this.gateway.broadcastLocation(ping.vehicleReg, record);
    await this.kafka.publishLocationEvent(ping.vehicleReg, { eventType: 'LOCATION_PING', ...record });

    this.logger.debug(`Ingested ping for ${ping.vehicleReg}`);
  }

  async getLive(vehicleReg: string) {
    const raw = await this.redis.client.get(`${LIVE_KEY_PREFIX}${vehicleReg}`);
    return raw ? JSON.parse(raw) : null;
  }

  async getAllLive() {
    const keys = await this.redis.client.keys(`${LIVE_KEY_PREFIX}*`);
    if (keys.length === 0) return [];
    const values = await this.redis.client.mget(...keys);
    return values.filter(Boolean).map((v) => JSON.parse(v as string));
  }
}
