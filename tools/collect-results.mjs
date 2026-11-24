// collect-results.mjs - static server + one-shot result receiver on the same origin.
//
//   node tools/collect-results.mjs --port 8787 --root tools/speedometer-3.1 \
//        --out G:\Temp\UserTemp\opencode\dx-speedo.json
//
// Serves the benchmark tree at http://127.0.0.1:<port>/ and accepts POST /results from the
// same origin, which is what removes both the mixed-content block and CORS. The hook script is
// injected into the served index.html, so the upstream tree stays untouched.
//
// The process exits the moment a payload arrives, which doubles as the completion signal.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const port = Number(arg("port", "8787"));
const out = arg("out", "results.json");
const root = arg("root", "");
const hookPath = arg("hook", join(import.meta.dirname, "speedometer-hook.js"));
const timeoutSeconds = Number(arg("timeout", "900"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(response, status, type, body) {
  response.writeHead(status, { "Content-Type": type, "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
  response.end(body);
}

function serveStatic(request, response, url) {
  const path = decodeURIComponent(url.pathname.split("?")[0]);
  if (path === "/speedometer-hook.js") {
    send(response, 200, MIME[".js"], readFileSync(hookPath));
    return;
  }
  if (!root) {
    send(response, 404, "text/plain", "no --root configured");
    return;
  }
  const relative = path === "/" ? "index.html" : path.replace(/^\/+/, "");
  const file = resolve(root, normalize(relative));
  if (!file.startsWith(resolve(root))) {
    send(response, 403, "text/plain", "outside root");
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    send(response, 404, "text/plain", "not found: " + relative);
    return;
  }

  const type = MIME[extname(file).toLowerCase()] || "application/octet-stream";
  let body = readFileSync(file);

  if (type.startsWith("text/html")) {
    const html = body.toString("utf8");
    if (!html.includes("speedometer-hook.js")) {
      body = Buffer.from(html.replace("</body>", '<script src="/speedometer-hook.js"></script>\n</body>'), "utf8");
    }
  }
  send(response, 200, type, body);
}

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    response.end();
    return;
  }

  if (request.method === "POST" && request.url.split("?")[0] === "/results") {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks);
      writeFileSync(out, body);
      response.writeHead(204, { "Access-Control-Allow-Origin": "*" }).end();
      console.log(`received ${body.length} bytes -> ${out}`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 300);
    });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveStatic(request, response, new URL(request.url, `http://127.0.0.1:${port}`));
    return;
  }

  send(response, 405, "text/plain", "unsupported");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`serving ${root || "(no root)"} on http://127.0.0.1:${port}/`);
  console.log(`results endpoint http://127.0.0.1:${port}/results`);
});

setTimeout(() => {
  console.error(`timeout after ${timeoutSeconds}s, nothing received`);
  process.exit(1);
}, timeoutSeconds * 1000);
