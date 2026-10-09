import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

/** Publishes location-events to the Kafka event backbone (report section 3.3/4.2). */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'tracking-service',
      brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092'],
      retry: { retries: 3 },
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
    } catch (err) {
      this.logger.warn(`Kafka producer failed to connect (continuing without event publishing): ${err}`);
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.producer.disconnect();
    }
  }

  async publishLocationEvent(vehicleReg: string, payload: Record<string, unknown>) {
    if (!this.connected) return;
    try {
      await this.producer.send({
        topic: 'location-events',
        messages: [{ key: vehicleReg, value: JSON.stringify(payload) }],
      });
    } catch (err) {
      this.logger.warn(`Failed to publish location-event for ${vehicleReg}: ${err}`);
    }
  }
}
