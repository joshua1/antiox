import { Deque } from "../internal/deque";

interface Waiter {
	resolve: () => void;
	aborted?: boolean;
}

export class Notify {
	#waiters: Deque<Waiter> = new Deque();
	#permit = false;

	notifyOne(): void {
		while (!this.#waiters.isEmpty()) {
			const waiter = this.#waiters.shift()!;
			if (!waiter.aborted) {
				waiter.resolve();
				return;
			}
		}
		this.#permit = true;
	}

	notifyWaiters(): void {
		while (!this.#waiters.isEmpty()) {
			const waiter = this.#waiters.shift()!;
			if (!waiter.aborted) waiter.resolve();
		}
	}

	notified(signal?: AbortSignal): Promise<void> {
		signal?.throwIfAborted();
		if (this.#permit) {
			this.#permit = false;
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const waiter: Waiter = { resolve };
			this.#waiters.push(waiter);
			if (signal) {
				const onAbort = () => { waiter.aborted = true; reject(signal.reason); };
				signal.addEventListener("abort", onAbort, { once: true });
				waiter.resolve = () => { signal.removeEventListener("abort", onAbort); resolve(); };
			}
		});
	}

	[Symbol.dispose](): void {
		this.notifyWaiters();
	}
}
