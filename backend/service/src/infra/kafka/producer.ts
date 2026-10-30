import { Kafka, Producer, logLevel } from "kafkajs";
import { Logger } from "pino";

export interface KafkaAuthOptions {
    brokers: string[];
    clientId: string;
    username?: string;
    password?: string;
    mechanism?: 'plain' | 'scram-sha-256' | 'scram-sha-512'
}
export class KafkaProducerManager {
    private kafka: Kafka;
    private producer: Producer;
    private isConnected = false;
    private logger: Logger;
    constructor(options: KafkaAuthOptions, logger: Logger) {
        this.logger = logger.child({ module: 'KafkaProducerManager' });
        const sasl = options.username && options.password ?
            {
                mechanism: (options.mechanism || 'scram-sha-256') as any,
                username: options.username,
                password: options.password
            } : undefined
        this.kafka = new Kafka(
            {
                clientId: options.clientId,
                brokers: options.brokers.length > 0 ? options.brokers : ['localhost:9092'],
                ssl: sasl ? true : false,
                sasl,
                logLevel: logLevel.NOTHING
            }
        );
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