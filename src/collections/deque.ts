/**
 * A double-ended queue backed by a growable ring buffer.
 *
 * This is the public, full-featured deque. It supports O(1) amortized
 * push/pop at both ends, peeking, iteration, and conversion to an array.
 */
export class Deque<T> {
	#buf: (T | undefined)[];
	#head = 0;
	#len = 0;

	constructor(capacity = 4) {
		this.#buf = new Array(Math.max(capacity, 4));
	}

	/** The number of elements currently in the deque. */
	get length(): number {
		return this.#len;
	}

	/** Returns `true` if the deque contains no elements. */
	isEmpty(): boolean {
		return this.#len === 0;
	}

	/** Push a value onto the back of the deque. */
	push(value: T): void {
		if (this.#len === this.#buf.length) {
			this.#grow();
		}
		const idx = (this.#head + this.#len) % this.#buf.length;
		this.#buf[idx] = value;
		this.#len++;
	}

	/** Push a value onto the front of the deque. */
	pushFront(value: T): void {
		if (this.#len === this.#buf.length) {
			this.#grow();
		}
		this.#head = (this.#head - 1 + this.#buf.length) % this.#buf.length;
		this.#buf[this.#head] = value;
		this.#len++;
	}

	/** Remove and return the front element, or `undefined` if empty. */
	shift(): T | undefined {
		if (this.#len === 0) return undefined;
		const value = this.#buf[this.#head];
		this.#buf[this.#head] = undefined;
		this.#head = (this.#head + 1) % this.#buf.length;
		this.#len--;
		return value;
	}

	/** Remove and return the back element, or `undefined` if empty. */
	pop(): T | undefined {
		if (this.#len === 0) return undefined;
		const idx = (this.#head + this.#len - 1) % this.#buf.length;
		const value = this.#buf[idx];
		this.#buf[idx] = undefined;
		this.#len--;
		return value;
	}

	/** Return the front element without removing it, or `undefined` if empty. */
	peekFront(): T | undefined {
		if (this.#len === 0) return undefined;
		return this.#buf[this.#head];
	}

	/** Return the back element without removing it, or `undefined` if empty. */
	peekBack(): T | undefined {
		if (this.#len === 0) return undefined;
		const idx = (this.#head + this.#len - 1) % this.#buf.length;
		return this.#buf[idx];
	}

	/** Return all elements as an array, from front to back. */
	toArray(): T[] {
		const result: T[] = new Array(this.#len);
		for (let i = 0; i < this.#len; i++) {
			result[i] = this.#buf[(this.#head + i) % this.#buf.length] as T;
		}
		return result;
	}

	/** Remove all elements from the deque. */
	clear(): void {
		for (let i = 0; i < this.#len; i++) {
			this.#buf[(this.#head + i) % this.#buf.length] = undefined;
		}
		this.#head = 0;
		this.#len = 0;
	}

	/** Iterate over elements from front to back. */
	[Symbol.iterator](): Iterator<T> {
		let index = 0;
		const self = this;
		return {
			next(): IteratorResult<T> {
				if (index >= self.#len) {
					return { done: true, value: undefined };
				}
				const value = self.#buf[(self.#head + index) % self.#buf.length] as T;
				index++;
				return { done: false, value };
			},
		};
	}

	#grow(): void {
		const newBuf: (T | undefined)[] = new Array(this.#buf.length * 2);
		for (let i = 0; i < this.#len; i++) {
			newBuf[i] = this.#buf[(this.#head + i) % this.#buf.length];
		}
		this.#buf = newBuf;
		this.#head = 0;
	}
}
