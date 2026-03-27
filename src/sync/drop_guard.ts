/**
 * A guard that runs a cleanup function when disposed.
 *
 * Mirrors the semantics of `tokio_util::sync::DropGuard`. Call
 * {@link disarm} to prevent the cleanup function from running.
 */
export class DropGuard {
	#fn: (() => void) | null;

	constructor(fn: () => void) {
		this.#fn = fn;
	}

	/**
	 * Prevent the cleanup function from running. After this call, disposing
	 * the guard is a no-op.
	 */
	disarm(): void {
		this.#fn = null;
	}

	/** Run the cleanup function unless the guard has been disarmed. */
	[Symbol.dispose](): void {
		if (this.#fn !== null) {
			this.#fn();
			this.#fn = null;
		}
	}
}
