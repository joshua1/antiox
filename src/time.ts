export class TimeoutError extends Error {
	constructor() {
		super("Operation timed out");
		this.name = "TimeoutError";
	}
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		if (signal?.aborted) {
			reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
			return;
		}

		const timer = setTimeout(() => {
			cleanup();
			resolve();
		}, ms);

		let onAbort: (() => void) | undefined;

		function cleanup() {
			if (onAbort && signal) {
				signal.removeEventListener("abort", onAbort);
			}
		}

		if (signal) {
			onAbort = () => {
				clearTimeout(timer);
				reject(signal.reason ?? new DOMException("The operation was aborted", "AbortError"));
			};
			signal.addEventListener("abort", onAbort, { once: true });
		}
	});
}

export async function timeout<T>(ms: number, promise: Promise<T>, signal?: AbortSignal): Promise<T> {
	signal?.throwIfAborted();
	const controller = new AbortController();

	if (signal) {
		signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
	}

	const timer = sleep(ms, controller.signal).then(() => {
		throw new TimeoutError();
	});

	try {
		const result = await Promise.race([promise, timer]);
		return result as T;
	} finally {
		controller.abort();
	}
}

export async function timeoutAt<T>(
	deadline: Date | number,
	promise: Promise<T>,
	signal?: AbortSignal,
): Promise<T> {
	const ms = (typeof deadline === "number" ? deadline : deadline.getTime()) - Date.now();
	return timeout(Math.max(ms, 0), promise, signal);
}

export async function* interval(ms: number, signal?: AbortSignal): AsyncIterable<number> {
	let tick = 0;
	while (true) {
		signal?.throwIfAborted();
		if (tick > 0) {
			await sleep(ms, signal);
		}
		yield tick++;
	}
}
