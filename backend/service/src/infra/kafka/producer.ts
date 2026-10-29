import { Kafka, Producer, logLevel } from "kafkajs";
import { Logger } from "pino";

export class KafkaProducerManager {
    private kafka: Kafka;
    private producer: Producer;
    private isConnected = false;
    private logger: Logger;
    constructor(brokers: string[], clientId: string, logger: Logger) {
        this.logger = logger.child({ module: 'KafkaProducerManager' });
        this.kafka = new Kafka({ clientId, brokers: brokers.length > 0 ? brokers : ['localhost:9092'], logLevel: logLevel.NOTHING });
        this.producer = this.kafka.producer({ allowAutoTopicCreation: true, idempotent: true });
    }
    async connect(): Promise<void> {
        if (this.isConnected) return;
        try {
            this.logger.info('Connecting to the producer');
            await this.producer.connect();
            this.isConnected = true;
            this.logger.info('Kafka producer connected succesfully');
        } catch (err) {
            this.logger.error({ err }, 'Failed to connect kafka producer');
            throw err;
        }
    }
    async send(topic: string, key: string, payload: unknown): Promise<void> {
        if (!this.isConnected) {
            throw new Error(`Cannot Producer message: kafka producer is not connected`)
        }
        const value = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await this.producer.send({ topic, messages: [{ key, value }] })
    }
    async disconnect(): Promise<void> {
        if (!this.isConnected) return;
        try {
            this.logger.info(`Disconnecting Kafka Producer`)
            await this.producer.disconnect();
            this.isConnected = false;
            this.logger.info(`kafka producer disconnected`);
        } catch (err) {
            this.logger.warn({ err }, `Error during Kafka producer disconnect`)
        }
    }
}