/**
 * Default comparator producing a max-heap for values that support the `>`
 * and `<` operators (numbers, strings, etc.).
 */
function defaultCompare<T>(a: T, b: T): number {
	if (a > b) return 1;
	if (a < b) return -1;
	return 0;
}

/**
 * A binary max-heap (priority queue).
 *
 * Mirrors the semantics of Rust's `std::collections::BinaryHeap`. The element
 * with the highest priority (as determined by the comparator) is always at the
 * top. Push and pop run in O(log n) time.
 *
 * By default the heap is a max-heap using natural ordering. Pass a custom
 * comparator to change the ordering. For a min-heap of numbers, use
 * `(a, b) => (a < b ? 1 : a > b ? -1 : 0)`.
 */
export class BinaryHeap<T> {
	#data: T[] = [];
	#compare: (a: T, b: T) => number;

	constructor(compare?: (a: T, b: T) => number) {
		this.#compare = compare ?? defaultCompare;
	}

	/** The number of elements in the heap. */
	get length(): number {
		return this.#data.length;
	}

	/** Returns `true` if the heap contains no elements. */
	isEmpty(): boolean {
		return this.#data.length === 0;
	}

	/** Add an element to the heap. */
	push(value: T): void {
		this.#data.push(value);
		this.#siftUp(this.#data.length - 1);
	}

	/**
	 * Remove and return the highest-priority element, or `undefined` if the
	 * heap is empty.
	 */
	pop(): T | undefined {
		const len = this.#data.length;
		if (len === 0) return undefined;
		if (len === 1) return this.#data.pop();

		const top = this.#data[0];
		this.#data[0] = this.#data.pop()!;
		this.#siftDown(0);
		return top;
	}

	/**
	 * Return the highest-priority element without removing it, or `undefined`
	 * if the heap is empty.
	 */
	peek(): T | undefined {
		return this.#data[0];
	}

	/**
	 * Return all elements as a sorted array (highest priority first).
	 *
	 * This does not modify the heap.
	 */
	toArray(): T[] {
		const sorted = this.#data.slice();
		sorted.sort((a, b) => -this.#compare(a, b));
		return sorted;
	}

	/** Remove all elements from the heap. */
	clear(): void {
		this.#data.length = 0;
	}

	/**
	 * Iterate over the elements in heap order (level-order traversal). The
	 * iteration order is not sorted.
	 */
	[Symbol.iterator](): Iterator<T> {
		let index = 0;
		const data = this.#data;
		return {
			next(): IteratorResult<T> {
				if (index >= data.length) {
					return { done: true, value: undefined };
				}
				return { done: false, value: data[index++] };
			},
		};
	}

	/** Restore the heap property by moving the element at `index` upward. */
	#siftUp(index: number): void {
		while (index > 0) {
			const parent = (index - 1) >> 1;
			if (this.#compare(this.#data[index]!, this.#data[parent]!) <= 0) break;
			this.#swap(index, parent);
			index = parent;
		}
	}

	/** Restore the heap property by moving the element at `index` downward. */
	#siftDown(index: number): void {
		const len = this.#data.length;
		while (true) {
			let largest = index;
			const left = 2 * index + 1;
			const right = 2 * index + 2;

			if (left < len && this.#compare(this.#data[left]!, this.#data[largest]!) > 0) {
				largest = left;
			}
			if (right < len && this.#compare(this.#data[right]!, this.#data[largest]!) > 0) {
				largest = right;
			}
			if (largest === index) break;

			this.#swap(index, largest);
			index = largest;
		}
	}

	#swap(i: number, j: number): void {
		const tmp = this.#data[i]!;
		this.#data[i] = this.#data[j]!;
		this.#data[j] = tmp;
	}
}
