interface Request {
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
  fnToCall: (...args: any[]) => Promise<any>;
  args: any[];
}

export class Semaphore {
  private maxConcurrentRequests: number;
  private currentRequests: Request[];
  private runningRequests: number;

  constructor(maxConcurrentRequests = 1) {
    if (maxConcurrentRequests < 1) {
      throw new Error('maxConcurrentRequests must be greater than or equal to 1');
    }
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.currentRequests = [];
    this.runningRequests = 0;
  }

  public callFunction(fnToCall: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any> {
    if (typeof fnToCall !== 'function') {
      return Promise.reject(new Error('fnToCall must be a function'));
    }

    return new Promise((resolve, reject) => {
      const request: Request = {
        resolve,
        reject,
        fnToCall,
        args,
      };

      if (this.runningRequests < this.maxConcurrentRequests) {
        this.executeRequest(request);
      } else {
        this.currentRequests.push(request);
      }
    });
  }

  private executeRequest(request: Request): void {
    this.runningRequests++;

    try {
      const req = request.fnToCall(...request.args) as any;

      if (!(req instanceof Promise) || !(req?.then instanceof Function)) {
        throw new Error('Function passed to callFunction() must return a Promise');
      }

      req
        .then((result) => {
          request.resolve(result);
        })
        .catch((error) => {
          request.reject(error);
        })
        .finally(() => {
          this.runningRequests--;
          this.processNextRequest();
        });
    } catch (err) {
      request.reject(err);
      this.runningRequests--;
      this.processNextRequest();
    }
  }

  private processNextRequest(): void {
    if (this.currentRequests.length > 0 && this.runningRequests < this.maxConcurrentRequests) {
      const nextRequest = this.currentRequests.shift()!;
      this.executeRequest(nextRequest);
    }
  }
}
