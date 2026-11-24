// cdp-speedometer-multi.mjs - run Speedometer N times in a Chromium browser over CDP and report scores.
//   node tools/cdp-speedometer-multi.mjs --port 9333 --runs 5 [--url ...]
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const port = arg("port", "9333");
const runs = Number(arg("runs", "5"));
const url = arg("url", "https://browserbench.org/Speedometer3.1/?startAutomatically=true");
const timeoutSeconds = Number(arg("timeout", "300"));

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

const scores = [];
for (let run = 1; run <= runs; run++) {
  await send("Page.navigate", { url });
  const started = Date.now();
  let body = "";
  const deadline = started + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const res = await send("Runtime.evaluate", {
      expression: "document.body.innerText",
      returnByValue: true,
    });
    body = res?.result?.result?.value ?? "";
    if (/Score\s+[0-9]/.test(body) && /±/.test(body)) break;
    await sleep(400);
  }
  const m = body.match(/Score\s+([0-9]+(?:\.[0-9]+)?)\s*±\s*([0-9]+(?:\.[0-9]+)?)/);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (m) {
    scores.push({ run, score: Number(m[1]), sd: Number(m[2]), seconds });
    console.log(`run ${run}: ${m[1]} ± ${m[2]} (${seconds}s)`);
  } else {
    console.log(`run ${run}: NO SCORE (${seconds}s)`);
  }
  await sleep(800);
}

const values = scores.map((s) => s.score).sort((a, b) => a - b);
if (values.length) {
  const median = values.length % 2
    ? values[(values.length - 1) / 2]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
  console.log(`median=${median} min=${values[0]} max=${values[values.length - 1]} n=${values.length}`);
}
ws.close();
process.exit(0);
