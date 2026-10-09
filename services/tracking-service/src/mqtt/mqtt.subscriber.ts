import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { TelemetryService } from '../telemetry/telemetry.service';

/**
 * Mirrors "GPS units publish MQTT over TLS to AWS IoT Core, which streams telemetry into
 * the tracking service" (deployment diagram). Locally this subscribes to a Mosquitto
 * broker on `vehicles/+/telemetry` in place of AWS IoT Core.
 */
@Injectable()
export class MqttSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttSubscriber.name);
  private client: mqtt.MqttClient | undefined;

  constructor(private readonly telemetryService: TelemetryService) {}

  onModuleInit() {
    const url = process.env.MQTT_URL;
    if (!url) {
      this.logger.warn('MQTT_URL not set - skipping MQTT telemetry ingestion (REST endpoint still available)');
      return;
    }

    this.client = mqtt.connect(url, { reconnectPeriod: 3000 });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${url}`);
      this.client?.subscribe('vehicles/+/telemetry');
    });

    this.client.on('message', async (topic, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        await this.telemetryService.ingest(data);
      } catch (err) {
        this.logger.warn(`Discarding malformed telemetry message on ${topic}: ${err}`);
      }
    });

    this.client.on('error', (err) => this.logger.warn(`MQTT error: ${err.message}`));
  }

  onModuleDestroy() {
    this.client?.end();
  }
}
