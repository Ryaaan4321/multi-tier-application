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
            this.isConnected = true;
            this.logger.info('Kafka producer connected succesfully');
        } catch (err) {
            this.logger.error({ err }, 'Failed to connect kafka producer');
            throw err;
        }

    }
}