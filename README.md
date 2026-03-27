<p align="center">
  <img src=".github/media/antiox.svg" alt="antiox" />
</p>

<h2 align="center">Antiox</h2>

<h3 align="center">Zero-Cost Rust and Tokio-like primitives for TypeScript (Anti Oxide)</h3>

<p align="center">
  No custom DSL, no wrapper types, no extra allocations, and no dependencies.<br />
  Just the control flow and concurrency patterns you miss from Rust, mapped onto native JS primitives.<br />
  <i>Because let's be honest, you wish you were writing Rust instead.</i>
</p>

<p align="center">
  <a href="https://github.com/rivet-dev/antiox">GitHub</a> — <a href="https://www.npmjs.com/package/antiox">npm</a>
</p>

> **Pre-release:** This library is used in production but the API is subject to change.

```
npm install antiox
```

This library intentionally does **not** implement `Result`, `Option`, or `match`. These require wrapper objects on every call, which adds allocation overhead that defeats the purpose. TypeScript's `T | null`, union types, and `switch` already cover these patterns at zero cost.

## Overview

The biggest win from antiox is **channels** and **streams** — primitives that give you structured concurrency and backpressure without callbacks, event emitters, or custom DSLs. Combine them with tasks to build actor-like patterns:

```typescript
import { channel } from "antiox/sync/mpsc";
import { oneshot, OneshotSender } from "antiox/sync/oneshot";
import { spawn } from "antiox/task";

type Msg =
  | { type: "increment"; amount: number }
  | { type: "get"; resTx: OneshotSender<number> };

const [tx, rx] = channel<Msg>(32);

// Actor loop
spawn(async () => {
  let count = 0;
  for await (const msg of rx) {
    switch (msg.type) {
      case "increment":
        count += msg.amount;
        break;
      case "get":
        msg.resTx.send(count);
        break;
    }
  }
});

// Fire-and-forget
await tx.send({ type: "increment", amount: 5 });

// Request-response via oneshot channel
const [resTx, resRx] = oneshot<number>();
await tx.send({ type: "get", resTx });
const value = await resRx;
```

Bounded channels give you backpressure, `for await` gives you clean shutdown on disconnect, and oneshot channels give you typed request-response — all without locks or shared mutable state.

## Modules

| Module | Mirrors | Min | Gzip | Docs |
|--------|---------|-----|------|------|
| [`antiox/panic`](#antioxpanic) | `std::panic!`, `std::todo!`, `std::unreachable!` | 273 B | 199 B | [std](https://doc.rust-lang.org/std/) |
| [`antiox/sync/mpsc`](#antioxsyncmpsc) | `tokio::sync::mpsc` | 4.6 KB | 1.3 KB | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/mpsc/) |
| [`antiox/sync/oneshot`](#antioxsynconeshot) | `tokio::sync::oneshot` | 1.7 KB | 625 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/oneshot/) |
| [`antiox/sync/watch`](#antioxsyncwatch) | `tokio::sync::watch` | 1.5 KB | 635 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/watch/) |
| [`antiox/sync/broadcast`](#antioxsyncbroadcast) | `tokio::sync::broadcast` | 2.4 KB | 936 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/broadcast/) |
| [`antiox/sync/semaphore`](#antioxsyncsemaphore) | `tokio::sync::Semaphore` | 2.0 KB | 845 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/struct.Semaphore.html) |
| [`antiox/sync/notify`](#antioxsyncnotify) | `tokio::sync::Notify` | 934 B | 466 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/struct.Notify.html) |
| [`antiox/sync/mutex`](#antioxsyncmutex) | `tokio::sync::Mutex` | 1.4 KB | 606 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html) |
| [`antiox/sync/rwlock`](#antioxsyncrwlock) | `tokio::sync::RwLock` | 2.2 KB | 778 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/struct.RwLock.html) |
| [`antiox/sync/barrier`](#antioxsyncbarrier) | `tokio::sync::Barrier` | 1.1 KB | 528 B | [docs.rs](https://docs.rs/tokio/latest/tokio/sync/struct.Barrier.html) |
| [`antiox/sync/select`](#antioxsyncselect) | `tokio::select!` | 338 B | 260 B | [docs.rs](https://docs.rs/tokio/latest/tokio/macro.select.html) |
| [`antiox/task`](#antioxtask) | `tokio::task` | 1.7 KB | 795 B | [docs.rs](https://docs.rs/tokio/latest/tokio/task/) |
| [`antiox/time`](#antioxtime) | `tokio::time` | 807 B | 469 B | [docs.rs](https://docs.rs/tokio/latest/tokio/time/) |
| [`antiox/stream`](#antioxstream) | `tokio_stream` / `futures::stream` | 9.7 KB | 2.9 KB | [docs.rs](https://docs.rs/tokio-stream/latest/tokio_stream/) |

---

### `antiox/sync/mpsc`

Multi-producer, single-consumer channels with backpressure and disconnection detection. Mirrors `tokio::sync::mpsc`.

```typescript
import { channel, unboundedChannel } from "antiox/sync/mpsc";

// Bounded channel with backpressure
const [tx, rx] = channel<string>(32);

await tx.send("hello");
const msg = await rx.recv(); // "hello"

// Clone senders for multi-producer
const tx2 = tx.clone();
await tx2.send("from tx2");

// Async iteration
for await (const msg of rx) {
  console.log(msg);
}

// Unbounded channel (never blocks on send)
const [utx, urx] = unboundedChannel<number>();
utx.send(42); // sync, never blocks
```

### `antiox/task`

Task spawning with cooperative cancellation via AbortSignal. Mirrors `tokio::task`.

```typescript
import { spawn, JoinSet, yieldNow } from "antiox/task";

// Spawn a task (returns awaitable JoinHandle)
const handle = spawn(async (signal) => {
  const res = await fetch("https://example.com", { signal });
  return res.text();
});

const result = await handle;

// Abort a task
handle.abort();

// JoinSet for managing multiple tasks
const set = new JoinSet<number>();
set.spawn(async () => 1);
set.spawn(async () => 2);
set.spawn(async () => 3);

for await (const result of set) {
  console.log(result); // 1, 2, 3 (in completion order)
}

// Yield to event loop
await yieldNow();
```

### `antiox/panic`

Diverging functions for halting execution. Mirrors `panic!`, `todo!`, and `unreachable!` from Rust.

```typescript
import { panic, todo, unreachable } from "antiox/panic";

// Halt with a message
if (!isValid) panic("invariant violated");

// Stub unfinished code
function processEvent(event: Event): Result {
  switch (event.type) {
    case "click": return handleClick(event);
    case "hover": todo("hover support");
  }
}

// Exhaustive type checking
type Direction = "north" | "south" | "east" | "west";

function move(dir: Direction) {
  switch (dir) {
    case "north": return [0, 1];
    case "south": return [0, -1];
    case "east": return [1, 0];
    case "west": return [-1, 0];
    default: unreachable(dir); // compile error if cases missed
  }
}
```

### `antiox/sync/oneshot`

Single-use channel. Send exactly one value. Receiver is awaitable.

```typescript
import { oneshot } from "antiox/sync/oneshot";

const [tx, rx] = oneshot<string>();
tx.send("done");
const value = await rx; // "done"
```

### `antiox/sync/watch`

Single-value broadcast. One sender updates a value, many receivers observe changes.

```typescript
import { watch } from "antiox/sync/watch";

const [tx, rx] = watch("initial");
const rx2 = tx.subscribe();

tx.send("updated");
await rx.changed();
console.log(rx.borrowAndUpdate()); // "updated"
```

### `antiox/sync/broadcast`

Multi-producer, multi-consumer bounded channel. Every receiver gets every message.

```typescript
import { broadcast } from "antiox/sync/broadcast";

const [tx, rx1] = broadcast<string>(16);
const rx2 = tx.subscribe();

tx.send("hello");
console.log(await rx1.recv()); // "hello"
console.log(await rx2.recv()); // "hello"
```

### `antiox/sync/semaphore`

Counting semaphore for limiting concurrency.

```typescript
import { Semaphore } from "antiox/sync/semaphore";

const sem = new Semaphore(3);
const permit = await sem.acquire();
// ... do work ...
permit.release();
```

### `antiox/sync/notify`

Simplest synchronization primitive. Wake one or all waiters.

```typescript
import { Notify } from "antiox/sync/notify";

const notify = new Notify();
// In one task:
await notify.notified();
// In another:
notify.notifyOne();
```

### `antiox/sync/mutex`

Async mutex guaranteeing exclusive access across await points.

```typescript
import { Mutex } from "antiox/sync/mutex";

const mutex = new Mutex({ count: 0 });
const guard = await mutex.lock();
guard.value = { count: guard.value.count + 1 };
guard.release();
```

### `antiox/sync/rwlock`

Multiple concurrent readers OR one exclusive writer.

```typescript
import { RwLock } from "antiox/sync/rwlock";

const lock = new RwLock({ data: "hello" });
const reader = await lock.read();
console.log(reader.value);
reader.release();

const writer = await lock.write();
writer.value = { data: "world" };
writer.release();
```

### `antiox/sync/barrier`

N tasks wait, all released when the Nth arrives.

```typescript
import { Barrier } from "antiox/sync/barrier";

const barrier = new Barrier(3);
const result = await barrier.wait();
if (result.isLeader()) console.log("I'm the leader");
```

### `antiox/sync/select`

Race multiple async branches, cancel losers. TypeScript narrows the result type.

```typescript
import { select } from "antiox/sync/select";
import { sleep } from "antiox/time";

const result = await select({
  msg: (signal) => rx.recv(),
  timeout: (signal) => sleep(5000, signal),
});

if (result.key === "msg") {
  console.log(result.value); // narrowed type
}
```

### `antiox/time`

Timer primitives with AbortSignal integration.

```typescript
import { sleep, timeout, interval, TimeoutError } from "antiox/time";

await sleep(1000);

try {
  const data = await timeout(5000, fetchData());
} catch (e) {
  if (e instanceof TimeoutError) console.log("timed out");
}

for await (const tick of interval(1000)) {
  console.log(`Tick ${tick}`);
  if (tick >= 4) break;
}
```

### `antiox/stream`

Async stream combinators. All functions take and return `AsyncIterable<T>`. Zero wrapper objects.

```typescript
import { map, filter, bufferUnordered, collect, pipe, merge, chunks } from "antiox/stream";

const results = await collect(
  bufferUnordered(
    map(urls, (url) => fetch(url)),
    10,
  ),
);

const processed = pipe(
  source,
  (s) => filter(s, (x) => x > 0),
  (s) => map(s, (x) => x * 2),
  (s) => chunks(s, 10),
);

for await (const item of merge(stream1, stream2, stream3)) {
  console.log(item);
}
```

## Filling the Gaps

Rust crates that antiox doesn't cover, and what to use instead in TypeScript:

| Rust | TypeScript Replacement | Why |
|------|----------------------|-----|
| `Result` / `Option` | [better-result](https://github.com/user/better-result) | Typed Result/Option without wrapper overhead |
| `tracing` | [pino](https://github.com/pinojs/pino) | Structured logging, zero-overhead when disabled |
| `serde` | [zod](https://github.com/colinhacks/zod) | Schema validation and parsing |
| `reqwest` | Native `fetch` | Built into the runtime |
| `anyhow` / `thiserror` | Native `Error` + `cause` | TS union types + `instanceof` |

## Who's using this?

- [RivetKit](https://github.com/rivet-dev/rivet)

## Wish List

- `tokio-console`-like observability
- `pino` integration

## Why not Effect?

[Effect](https://effect.website) is excellent, but antiox exists for a different niche:

- **Lightweight enough to ship inside libraries.** Effect's runtime is too heavy as a transitive dependency end users didn't opt into.
- **Mirrors Rust/Tokio APIs.** Same structure, naming, and control flow across both codebases — the TypeScript reads like the Rust it was ported from.
- **No new DSL.** Plain `async`/`await`, `AbortSignal`, and `AsyncIterator`. No wrapper types, no effect system, no generator-based control flow.

## License

MIT
