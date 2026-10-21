import { IEventPublisher } from './event.interface.js';

export class NullEventPublisher implements IEventPublisher {
  async publish(_eventName: string, _payload: Record<string, unknown>): Promise<void> {}
}
