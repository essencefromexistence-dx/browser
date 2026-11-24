// cdp-speedo-json.mjs - run the full Speedometer suite in Chrome and save its per-test JSON.
//   node tools/cdp-speedo-json.mjs --port 9333 --out G:\Temp\UserTemp\opencode\chrome-speedo.json
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const port = arg("port", "9333");
const out = arg("out", "G:\\Temp\\UserTemp\\opencode\\chrome-speedo.json");
const url = arg("url", "https://browserbench.org/Speedometer3.1/?startAutomatically=true");
const timeoutSeconds = Number(arg("timeout", "400"));

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === "page");
if (!page) { console.log("no page target"); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));

let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve) => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.navigate", { url });
const deadline = Date.now() + timeoutSeconds * 1000;
let ready = false;
while (Date.now() < deadline) {
  const res = await send("Runtime.evaluate", {
    expression: "document.title.includes('Results Summary')",
    returnByValue: true,
  });
  if (res?.result?.result?.value === true) { ready = true; break; }
  await sleep(500);
}
if (!ready) { console.log("speedometer did not finish"); process.exit(1); }
await sleep(1500);

const res = await send("Runtime.evaluate", {
  expression: "JSON.stringify(window.benchmarkClient._measuredValuesList)",
  returnByValue: true,
});
const json = res?.result?.result?.value;
if (!json) { console.log("no results object"); process.exit(1); }
writeFileSync(out, json);
console.log(`bytes=${json.length} -> ${out}`);
ws.close();
process.exit(0);
