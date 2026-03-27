/**
 * The internal state of the cell. It is either uninitialized, currently being
 * initialized (with waiters queued), or fully initialized with a value.
 */
type State<T> =
	| { kind: "empty" }
	| { kind: "initializing"; waiters: Array<{ resolve: (value: T) => void; reject: (err: unknown) => void }> }
	| { kind: "ready"; value: T };

/**
 * An async cell that is written to at most once.
 *
 * Mirrors the semantics of `tokio::sync::OnceCell`. The first call to
 * {@link getOrInit} runs the provided function and caches the result. All
 * concurrent callers share the same result without running the function again.
 */
export class OnceCell<T> {
	#state: State<T> = { kind: "empty" };

	/**
	 * Return the stored value, or `undefined` if the cell has not been
	 * initialized yet.
	 */
	get(): T | undefined {
		if (this.#state.kind === "ready") {
			return this.#state.value;
		}
		return undefined;
	}

	/**
	 * Return the stored value if already initialized. Otherwise, run `fn` to
	 * produce a value, store it, and return it.
	 *
	 * If multiple tasks call this concurrently, only one invocation of `fn`
	 * will execute. The remaining callers will await its result.
	 */
	async getOrInit(fn: () => Promise<T>): Promise<T> {
		// Fast path: already initialized.
		if (this.#state.kind === "ready") {
			return this.#state.value;
		}

		// Another task is already running the initializer. Queue behind it.
		if (this.#state.kind === "initializing") {
			return new Promise<T>((resolve, reject) => {
				(this.#state as Extract<State<T>, { kind: "initializing" }>).waiters.push({ resolve, reject });
			});
		}

		// We are the first caller. Transition to "initializing".
		const waiters: Array<{ resolve: (value: T) => void; reject: (err: unknown) => void }> = [];
		this.#state = { kind: "initializing", waiters };

		try {
			const value = await fn();
			this.#state = { kind: "ready", value };
			for (const w of waiters) {
				w.resolve(value);
			}
			return value;
		} catch (err) {
			// Initialization failed. Reset to empty so a future call can retry.
			this.#state = { kind: "empty" };
			for (const w of waiters) {
				w.reject(err);
			}
			throw err;
		}
	}

	/**
	 * Like {@link getOrInit}, but if `fn` throws the cell remains unset so a
	 * subsequent call may retry initialization.
	 *
	 * This is functionally identical to {@link getOrInit} because that method
	 * also resets on failure. It is provided for parity with
	 * `tokio::sync::OnceCell::get_or_try_init`.
	 */
	getOrTryInit(fn: () => Promise<T>): Promise<T> {
		return this.getOrInit(fn);
	}

	/**
	 * Attempt to set the value of the cell.
	 *
	 * @returns `true` if the value was set, `false` if the cell was already
	 * initialized (the provided value is discarded).
	 */
	set(value: T): boolean {
		if (this.#state.kind !== "empty") {
			return false;
		}
		this.#state = { kind: "ready", value };
		return true;
	}

	/** Returns `true` if the cell contains a value. */
	isInitialized(): boolean {
		return this.#state.kind === "ready";
	}
}
