// cdp-eval.mjs - evaluate an expression in the first page target of a Chromium browser.
//   node tools/cdp-eval.mjs --port 9333 --expr "document.title"
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}
const port = arg("port", "9333");
const expr = arg("expr", "document.title");

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === "page");
if (!page) { console.log("no page target"); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => ws.addEventListener("open", resolve));

const result = await new Promise((resolve) => {
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id === 1) resolve(msg);
  });
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
});

console.log(JSON.stringify(result.result?.result?.value ?? result, null, 2));
ws.close();
process.exit(0);
