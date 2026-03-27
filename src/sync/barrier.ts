import { Deque } from "../internal/deque";

export class BarrierWaitResult {
	#leader: boolean;

	constructor(leader: boolean) {
		this.#leader = leader;
	}

	isLeader(): boolean {
		return this.#leader;
	}
}

interface Waiter {
	resolve: (result: BarrierWaitResult) => void;
	aborted?: boolean;
}

// Reusable barrier: n tasks synchronize, then the barrier resets for the next generation.
// The last task to arrive is the leader.
export class Barrier {
	#n: number;
	#count = 0;
	#generation = 0;
	#waiters: Deque<Waiter> = new Deque();

	constructor(n: number) {
		if (n < 1) throw new RangeError("Barrier size must be >= 1");
		this.#n = n;
	}

	wait(signal?: AbortSignal): Promise<BarrierWaitResult> {
		signal?.throwIfAborted();
		this.#count++;

		if (this.#count === this.#n) {
			const result = new BarrierWaitResult(true);

			while (!this.#waiters.isEmpty()) {
				const w = this.#waiters.shift()!;
				if (!w.aborted) w.resolve(new BarrierWaitResult(false));
			}

			this.#count = 0;
			this.#generation++;

			return Promise.resolve(result);
		}

		return new Promise<BarrierWaitResult>((resolve, reject) => {
			const waiter: Waiter = { resolve };
			this.#waiters.push(waiter);
			if (signal) {
				const gen = this.#generation;
				const onAbort = () => {
					waiter.aborted = true;
					// Only decrement if still in the same generation
					if (this.#generation === gen) this.#count--;
					reject(signal.reason);
				};
				signal.addEventListener("abort", onAbort, { once: true });
				waiter.resolve = (v) => { signal.removeEventListener("abort", onAbort); resolve(v); };
			}
		});
	}
}
