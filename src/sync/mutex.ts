import { Deque } from "../internal/deque";

interface Waiter<T> {
	resolve: (guard: MutexGuard<T>) => void;
	aborted?: boolean;
}

export class Mutex<T> {
	#value: T;
	#locked = false;
	#waiters: Deque<Waiter<T>> = new Deque();

	constructor(value: T) {
		this.#value = value;
	}

	lock(signal?: AbortSignal): Promise<MutexGuard<T>> {
		signal?.throwIfAborted();
		if (!this.#locked) {
			this.#locked = true;
			return Promise.resolve(new MutexGuard(this));
		}

		return new Promise<MutexGuard<T>>((resolve, reject) => {
			const waiter: Waiter<T> = { resolve };
			this.#waiters.push(waiter);
			if (signal) {
				const onAbort = () => { waiter.aborted = true; reject(signal.reason); };
				signal.addEventListener("abort", onAbort, { once: true });
				waiter.resolve = (g) => { signal.removeEventListener("abort", onAbort); resolve(g); };
			}
		});
	}

	tryLock(): MutexGuard<T> {
		if (this.#locked) {
			throw new Error("Mutex is already locked");
		}
		this.#locked = true;
		return new MutexGuard(this);
	}

	_getValue(): T {
		return this.#value;
	}

	_setValue(v: T): void {
		this.#value = v;
	}

	_unlock(): void {
		while (!this.#waiters.isEmpty()) {
			const waiter = this.#waiters.shift()!;
			if (!waiter.aborted) {
				waiter.resolve(new MutexGuard(this));
				return;
			}
		}
		this.#locked = false;
	}

	[Symbol.dispose](): void {
		if (this.#locked) {
			this._unlock();
		}
	}
}

export class MutexGuard<T> {
	#mutex: Mutex<T> | null;

	constructor(mutex: Mutex<T>) {
		this.#mutex = mutex;
	}

	get value(): T {
		if (this.#mutex === null) {
			throw new Error("MutexGuard has been released");
		}
		return this.#mutex._getValue();
	}

	set value(v: T) {
		if (this.#mutex === null) {
			throw new Error("MutexGuard has been released");
		}
		this.#mutex._setValue(v);
	}

	release(): void {
		if (this.#mutex === null) return;
		const mutex = this.#mutex;
		this.#mutex = null;
		mutex._unlock();
	}

	[Symbol.dispose](): void {
		this.release();
	}
}
