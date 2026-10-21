export interface IEventPublisher {
  publish(eventName: string, payload: Record<string, unknown>): Promise<void>;
}
