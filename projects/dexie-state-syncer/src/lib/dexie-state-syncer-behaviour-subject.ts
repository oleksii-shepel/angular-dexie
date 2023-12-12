export class BehaviorSubject<T> {
  private value: T;
  private observers: ((value: T) => void)[] = [];

  constructor(initialValue: T) {
    this.value = initialValue;
  }

  subscribe(observer: (value: T) => void) {
    this.observers.push(observer);
    observer(this.value);

    return {
      unsubscribe: () => {
        const index = this.observers.indexOf(observer);
        if (index >= 0) {
          this.observers.splice(index, 1);
        }
      },
    };
  }

  next(value: T) {
    this.value = value;
    this.observers.forEach((observer) => observer(value));
  }

  getValue(): T {
    return this.value;
  }
}
