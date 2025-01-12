import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  private static instance: EventBus;
  private currentShellId: string | null = null;

  private constructor() {
    super();
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  setCurrentShellId(shellId: string) {
    this.currentShellId = shellId;
    this.emit('shellIdChanged', shellId);
  }

  getCurrentShellId(): string | null {
    return this.currentShellId;
  }
}

export const eventBus = EventBus.getInstance(); 