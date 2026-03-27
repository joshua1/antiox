/**
 * Single-value broadcast channel with version tracking, mirroring tokio::sync::watch.
 *
 * One sender holds the current value. Multiple receivers can observe changes
 * and wait for updates.
 *
 * @module
 */

/** Thrown when all receivers have been closed. */
export class SendError<T> extends Error {
	readonly value: T;

	constructor(value: T) {
		super("Failed to send: all receivers are closed");
		this.name = "SendError";
		this.value = value;
	}
}

/** Thrown when the sender has been closed and no new values will arrive. */
export class RecvError extends Error {
	constructor() {
		super("Watch channel closed");
		this.name = "RecvError";
	}
}

interface Waiter {
	resolve: () => void;
	reject: (error: RecvError) => void;
}

interface SharedState<T> {
	value: T;
	version: number;
	senderClosed: boolean;
	receiverCount: number;
	waiters: Set<Waiter>;
}

/**
 * Create a watch channel with an initial value.
 *
 * Returns a `[sender, receiver]` pair. The sender updates the current value
 * and all receivers are notified of changes.
 */
export function watch<T>(initial: T): [WatchSender<T>, WatchReceiver<T>] {
	const state: SharedState<T> = {
		value: initial,
		version: 1,
		senderClosed: false,
		receiverCount: 1,
		waiters: new Set(),
	};

	return [new WatchSender(state), new WatchReceiver(state, state.version)];
}

/** Sends updated values to all paired {@link WatchReceiver} instances. */
export class WatchSender<T> {
	#state: SharedState<T>;
	#closed = false;

	/** @internal */
	constructor(state: SharedState<T>) {
		this.#state = state;
	}

	/**
	 * Update the watched value and notify all receivers.
	 *
	 * @throws {SendError} If all receivers have been closed.
	 */
	send(value: T): void {
		if (this.#closed) {
			throw new SendError(value);
		}
		if (this.#state.receiverCount === 0) {
			throw new SendError(value);
		}

		this.#state.value = value;
		this.#state.version++;

		for (const waiter of this.#state.waiters) {
			waiter.resolve();
		}
		this.#state.waiters.clear();
	}

	/**
	 * Update the value only if the predicate returns true.
	 * Avoids waking receivers for no-op changes.
	 *
	 * The predicate receives a mutable reference to the current value.
	 * If it returns true, receivers are notified. If false, nothing happens.
	 */
	sendIfModified(modify: (current: T) => boolean): boolean {
		if (this.#closed) return false;
		if (this.#state.receiverCount === 0) return false;

		if (!modify(this.#state.value)) return false;

		this.#state.version++;
		for (const waiter of this.#state.waiters) {
			waiter.resolve();
		}
		this.#state.waiters.clear();
		return true;
	}

	/** Read the current value without marking it as seen. */
	borrow(): T {
		return this.#state.value;
	}

	/**
	 * Create a new receiver that starts at the current version.
	 *
	 * The new receiver will see the current value as already observed.
	 * Call {@link WatchReceiver.changed} to wait for the next update.
	 */
	subscribe(): WatchReceiver<T> {
		this.#state.receiverCount++;
		return new WatchReceiver(this.#state, this.#state.version);
	}

	/** Returns `true` if there are no active receivers. */
	isClosed(): boolean {
		return this.#state.receiverCount === 0;
	}

	/** Close the sender, rejecting all pending `changed()` calls on receivers. */
	close(): void {
		if (this.#closed) {
			return;
		}
		this.#closed = true;
		this.#state.senderClosed = true;

		for (const waiter of this.#state.waiters) {
			waiter.reject(new RecvError());
		}
		this.#state.waiters.clear();
	}

	/** Dispose of the sender, equivalent to {@link close}. */
	[Symbol.dispose](): void {
		this.close();
	}
}

/** Receives value updates from the paired {@link WatchSender}. */
export class WatchReceiver<T> {
	#state: SharedState<T>;
	#lastSeenVersion: number;
	#closed = false;

	/** @internal */
	constructor(state: SharedState<T>, initialVersion: number) {
		this.#state = state;
		this.#lastSeenVersion = initialVersion;
	}

	/** Read the current value without marking it as seen. */
	borrow(): T {
		return this.#state.value;
	}

	/** Read the current value and mark this version as seen. */
	borrowAndUpdate(): T {
		this.#lastSeenVersion = this.#state.version;
		return this.#state.value;
	}

	/**
	 * Wait until the value changes since the last call to {@link borrowAndUpdate}.
	 *
	 * Resolves immediately if the value has already changed since the last
	 * `borrowAndUpdate` call.
	 *
	 * @throws {RecvError} If the sender is closed.
	 */
	changed(): Promise<void> {
		if (this.#state.senderClosed) {
			return Promise.reject(new RecvError());
		}
		if (this.#state.version !== this.#lastSeenVersion) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve, reject) => {
			const waiter: Waiter = { resolve, reject };
			this.#state.waiters.add(waiter);
		});
	}

	/**
	 * Create a clone of this receiver sharing the same channel.
	 *
	 * The clone starts with the same seen-version as this receiver.
	 */
	clone(): WatchReceiver<T> {
		this.#state.receiverCount++;
		return new WatchReceiver(this.#state, this.#lastSeenVersion);
	}

	/** Close this receiver, decrementing the receiver count. */
	close(): void {
		if (this.#closed) {
			return;
		}
		this.#closed = true;
		this.#state.receiverCount--;
	}

	/** Dispose of this receiver, equivalent to {@link close}. */
	[Symbol.dispose](): void {
		this.close();
	}
}
