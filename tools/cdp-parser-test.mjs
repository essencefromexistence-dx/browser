// cdp-parser-test.mjs - load the local parser harness in a Chromium browser and read the result.
//   node tools/cdp-parser-test.mjs --port 9333
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const port = arg("port", "9333");
const url = arg("url", "file:///G:/Dx/browser/tools/shell-ui/parser-test.html");

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
let title = "";
const deadline = Date.now() + 30000;
while (Date.now() < deadline) {
  const res = await send("Runtime.evaluate", { expression: "document.title", returnByValue: true });
  title = res?.result?.result?.value ?? "";
  if (/^PARSER-TEST/.test(title)) break;
  await sleep(200);
}
console.log("chrome: " + title);
ws.close();
process.exit(0);
