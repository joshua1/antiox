import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve, dirname } from "node:path";

const modules: [string, string][] = [
	["antiox/panic", "dist/panic.js"],
	["antiox/sync/mpsc", "dist/sync/mpsc.js"],
	["antiox/sync/oneshot", "dist/sync/oneshot.js"],
	["antiox/sync/watch", "dist/sync/watch.js"],
	["antiox/sync/broadcast", "dist/sync/broadcast.js"],
	["antiox/sync/semaphore", "dist/sync/semaphore.js"],
	["antiox/sync/notify", "dist/sync/notify.js"],
	["antiox/sync/mutex", "dist/sync/mutex.js"],
	["antiox/sync/rwlock", "dist/sync/rwlock.js"],
	["antiox/sync/barrier", "dist/sync/barrier.js"],
	["antiox/sync/select", "dist/sync/select.js"],
	["antiox/task", "dist/task.js"],
	["antiox/time", "dist/time.js"],
	["antiox/stream", "dist/stream.js"],
];

const root = resolve(import.meta.dirname, "..");

function collectFiles(entryPath: string): Set<string> {
	const visited = new Set<string>();
	const queue = [entryPath];
	while (queue.length > 0) {
		const file = queue.pop()!;
		if (visited.has(file)) continue;
		visited.add(file);
		const content = readFileSync(file, "utf-8");
		const importRegex = /from\s*"([^"]+)"/g;
		let match;
		while ((match = importRegex.exec(content)) !== null) {
			const importPath = match[1];
			if (importPath.startsWith(".")) {
				queue.push(resolve(dirname(file), importPath));
			}
		}
	}
	return visited;
}

console.log("| Module | Min | Gzip |");
console.log("|--------|-----|------|");

for (const [name, file] of modules) {
	const entryPath = resolve(root, file);
	const files = collectFiles(entryPath);
	let totalSize = 0;
	const allContent: Buffer[] = [];
	for (const f of files) {
		const buf = readFileSync(f);
		totalSize += buf.length;
		allContent.push(buf);
	}
	const combined = Buffer.concat(allContent);
	const gzSize = gzipSync(combined).length;
	console.log(`| \`${name}\` | ${formatBytes(totalSize)} | ${formatBytes(gzSize)} |`);
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} KB`;
}
