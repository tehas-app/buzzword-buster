// A static server for the game, for a person at a desk and for the smoke test.
// Serves the repository's files read-only, nothing outside it.
//
//   node scripts/serve.mjs [port]      (default 8080, 127.0.0.1)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".ttf": "font/ttf", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json",
};
const SERVED = ["index.html", "src" + sep, "fonts" + sep];

export function serve(port = 8080, host = "127.0.0.1") {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const rel = normalize(path === "/" ? "index.html" : path.slice(1));
    if (rel.startsWith("..") || !SERVED.some((s) => rel === s || rel.startsWith(s))) {
      res.writeHead(404).end("not found\n");
      return;
    }
    try {
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { "content-type": TYPES[extname(rel)] || "application/octet-stream", "cache-control": "no-store" }).end(body);
    } catch {
      res.writeHead(404).end("not found\n");
    }
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8080;
  serve(port).then(() => console.log(`Buzzword Buster on http://127.0.0.1:${port}/`));
}
