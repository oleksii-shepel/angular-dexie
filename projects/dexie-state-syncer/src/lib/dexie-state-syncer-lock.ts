export class Lock {
  private isLocked: boolean = false;
  private queue: (() => void)[] = [];

  constructor() {}

  private async lock(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isLocked) {
        this.queue.push(resolve);
      } else {
        this.isLocked = true;
        resolve();
      }
    });
  }

  private unlock(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next();
      }
    } else {
      this.isLocked = false;
    }
  }

  async handle(action: any, next: (store: any) => (action: any) => void) {
    await this.lock();

    try {
      await next(action);
    } finally {
      this.unlock();
    }
  }
}
