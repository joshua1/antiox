import { describe, it, expect } from "vitest";
import {
	map,
	filter,
	andThen,
	filterMap,
	take,
	skip,
	takeWhile,
	skipWhile,
	chunks,
	collect,
	fold,
	merge,
	chain,
	zip,
	flatten,
	tap,
	pipe,
	bufferUnordered,
	buffered,
} from "../src/stream";
import { sleep } from "../src/time";

async function* fromArray<T>(items: T[]): AsyncIterable<T> {
	for (const item of items) yield item;
}

describe("map", () => {
	it("transforms each element", async () => {
		const result = await collect(map(fromArray([1, 2, 3]), (x) => x * 2));
		expect(result).toEqual([2, 4, 6]);
	});
});

describe("filter", () => {
	it("removes elements", async () => {
		const result = await collect(
			filter(fromArray([1, 2, 3, 4, 5]), (x) => x % 2 === 0),
		);
		expect(result).toEqual([2, 4]);
	});
});

describe("then", () => {
	it("async maps each element", async () => {
		const result = await collect(
			andThen(fromArray([1, 2, 3]), async (x) => x + 10),
		);
		expect(result).toEqual([11, 12, 13]);
	});
});

describe("filterMap", () => {
	it("combined filter and map", async () => {
		const result = await collect(
			filterMap(fromArray([1, 2, 3, 4, 5]), (x) =>
				x % 2 === 0 ? x * 10 : null,
			),
		);
		expect(result).toEqual([20, 40]);
	});
});

describe("take", () => {
	it("first N elements", async () => {
		const result = await collect(take(fromArray([1, 2, 3, 4, 5]), 3));
		expect(result).toEqual([1, 2, 3]);
	});

	it("less than N available", async () => {
		const result = await collect(take(fromArray([1, 2]), 5));
		expect(result).toEqual([1, 2]);
	});
});

describe("skip", () => {
	it("first N elements", async () => {
		const result = await collect(skip(fromArray([1, 2, 3, 4, 5]), 2));
		expect(result).toEqual([3, 4, 5]);
	});

	it("skip more than available", async () => {
		const result = await collect(skip(fromArray([1, 2]), 5));
		expect(result).toEqual([]);
	});
});

describe("takeWhile", () => {
	it("yields while predicate is true", async () => {
		const result = await collect(
			takeWhile(fromArray([1, 2, 3, 4, 5]), (x) => x < 4),
		);
		expect(result).toEqual([1, 2, 3]);
	});
});

describe("skipWhile", () => {
	it("skips while predicate is true, then yields rest", async () => {
		const result = await collect(
			skipWhile(fromArray([1, 2, 3, 4, 5]), (x) => x < 3),
		);
		expect(result).toEqual([3, 4, 5]);
	});
});

describe("chunks", () => {
	it("batches correctly with partial last chunk", async () => {
		const result = await collect(chunks(fromArray([1, 2, 3, 4, 5]), 2));
		expect(result).toEqual([[1, 2], [3, 4], [5]]);
	});

	it("exact multiple", async () => {
		const result = await collect(chunks(fromArray([1, 2, 3, 4]), 2));
		expect(result).toEqual([
			[1, 2],
			[3, 4],
		]);
	});
});

describe("collect", () => {
	it("gathers all elements", async () => {
		const result = await collect(fromArray([10, 20, 30]));
		expect(result).toEqual([10, 20, 30]);
	});

	it("empty iterable", async () => {
		const result = await collect(fromArray([]));
		expect(result).toEqual([]);
	});
});

describe("fold", () => {
	it("reduces to a single value", async () => {
		const result = await fold(fromArray([1, 2, 3, 4]), 0, (acc, x) => acc + x);
		expect(result).toBe(10);
	});

	it("uses initial value for empty source", async () => {
		const result = await fold(fromArray<number>([]), 99, (acc, x) => acc + x);
		expect(result).toBe(99);
	});
});

describe("merge", () => {
	it("interleaves from multiple sources", async () => {
		async function* delayed(values: number[], delayMs: number) {
			for (const v of values) {
				await sleep(delayMs);
				yield v;
			}
		}

		const a = delayed([1, 3, 5], 10);
		const b = delayed([2, 4, 6], 15);

		const result = await collect(merge(a, b));
		expect(result.sort()).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("empty sources", async () => {
		const result = await collect(merge<number>());
		expect(result).toEqual([]);
	});
});

describe("chain", () => {
	it("concatenates in order", async () => {
		const result = await collect(
			chain(fromArray([1, 2]), fromArray([3, 4]), fromArray([5])),
		);
		expect(result).toEqual([1, 2, 3, 4, 5]);
	});
});

describe("zip", () => {
	it("pairs elements", async () => {
		const result = await collect(
			zip(fromArray([1, 2, 3]), fromArray(["a", "b", "c"])),
		);
		expect(result).toEqual([
			[1, "a"],
			[2, "b"],
			[3, "c"],
		]);
	});

	it("stops at shorter source", async () => {
		const result = await collect(
			zip(fromArray([1, 2, 3]), fromArray(["a", "b"])),
		);
		expect(result).toEqual([
			[1, "a"],
			[2, "b"],
		]);
	});
});

describe("flatten", () => {
	it("flattens nested iterables", async () => {
		const nested = fromArray([fromArray([1, 2]), fromArray([3, 4, 5])]);
		const result = await collect(flatten(nested));
		expect(result).toEqual([1, 2, 3, 4, 5]);
	});
});

describe("tap", () => {
	it("executes side effects without modifying stream", async () => {
		const seen: number[] = [];
		const result = await collect(
			tap(fromArray([1, 2, 3]), (x) => seen.push(x)),
		);
		expect(result).toEqual([1, 2, 3]);
		expect(seen).toEqual([1, 2, 3]);
	});
});

describe("pipe", () => {
	it("composes operators left-to-right", async () => {
		const result = await collect(
			pipe(
				fromArray([1, 2, 3, 4, 5]),
				(s) => filter(s, (x: number) => x % 2 !== 0),
				(s) => map(s, (x: number) => x * 10),
			),
		);
		expect(result).toEqual([10, 30, 50]);
	});
});

describe("bufferUnordered", () => {
	it("runs concurrently and yields all results", async () => {
		async function* tasks(): AsyncIterable<Promise<number>> {
			for (let i = 0; i < 5; i++) {
				yield new Promise<number>((resolve) =>
					setTimeout(() => resolve(i), 10),
				);
			}
		}

		const result = await collect(bufferUnordered(tasks(), 3));
		expect(result.sort()).toEqual([0, 1, 2, 3, 4]);
	});

	it("respects concurrency limit", async () => {
		let maxConcurrent = 0;
		let current = 0;

		async function* tasks(): AsyncIterable<Promise<number>> {
			for (let i = 0; i < 6; i++) {
				yield new Promise<number>((resolve) => {
					current++;
					if (current > maxConcurrent) maxConcurrent = current;
					setTimeout(() => {
						current--;
						resolve(i);
					}, 20);
				});
			}
		}

		const result = await collect(bufferUnordered(tasks(), 2));
		expect(result.sort()).toEqual([0, 1, 2, 3, 4, 5]);
		expect(maxConcurrent).toBeLessThanOrEqual(2);
	});
});

describe("buffered", () => {
	it("preserves source order", async () => {
		async function* tasks(): AsyncIterable<Promise<number>> {
			yield new Promise<number>((resolve) => setTimeout(() => resolve(1), 30));
			yield new Promise<number>((resolve) => setTimeout(() => resolve(2), 20));
			yield new Promise<number>((resolve) => setTimeout(() => resolve(3), 10));
		}

		const result = await collect(buffered(tasks(), 3));
		expect(result).toEqual([1, 2, 3]);
	});

	it("yields all results with limited concurrency", async () => {
		async function* tasks(): AsyncIterable<Promise<number>> {
			for (let i = 0; i < 5; i++) {
				yield new Promise<number>((resolve) =>
					setTimeout(() => resolve(i), 10),
				);
			}
		}

		const result = await collect(buffered(tasks(), 2));
		expect(result).toEqual([0, 1, 2, 3, 4]);
	});
});
