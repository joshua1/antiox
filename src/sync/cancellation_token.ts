/**
 * A token that signals cancellation to one or more tasks.
 *
 * Mirrors the semantics of `tokio_util::sync::CancellationToken`. Tokens
 * form a tree: cancelling a parent automatically cancels all of its children,
 * but cancelling a child does not affect the parent.
 */
export class CancellationToken {
	#controller: AbortController;
	#children: Set<CancellationToken> = new Set();
	#parent: CancellationToken | null = null;

	constructor() {
		this.#controller = new AbortController();
	}

	/**
	 * Cancel this token and all of its descendants. Resolves every pending
	 * {@link cancelled} promise in the subtree.
	 */
	cancel(): void {
		if (this.#controller.signal.aborted) return;
		this.#controller.abort();

		for (const child of this.#children) {
			child.cancel();
		}
	}

	/** Returns `true` if this token has been cancelled. */
	isCancelled(): boolean {
		return this.#controller.signal.aborted;
	}

	/**
	 * Return a promise that resolves when this token is cancelled.
	 *
	 * If the token is already cancelled the promise resolves immediately.
	 */
	cancelled(): Promise<void> {
		if (this.#controller.signal.aborted) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			this.#controller.signal.addEventListener("abort", () => resolve(), { once: true });
		});
	}

	/**
	 * Create a child token. The child is automatically cancelled when this
	 * token is cancelled, but cancelling the child has no effect on the parent.
	 */
	child(): CancellationToken {
		const child = new CancellationToken();
		child.#parent = this;
		this.#children.add(child);

		// If the parent is already cancelled, cancel the child immediately.
		if (this.#controller.signal.aborted) {
			child.cancel();
		}

		return child;
	}

	/**
	 * Remove this token from its parent's child set. This is useful to avoid
	 * retaining references to long-lived parent tokens after the child is no
	 * longer needed.
	 */
	#detach(): void {
		if (this.#parent !== null) {
			this.#parent.#children.delete(this);
			this.#parent = null;
		}
	}

	/** Cancel this token on dispose. */
	[Symbol.dispose](): void {
		this.cancel();
		this.#detach();
	}
}
