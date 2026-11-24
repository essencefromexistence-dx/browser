// cdp-speedometer.mjs - run Speedometer in a Chromium browser and read the score over CDP.
//
//   node tools/cdp-speedometer.mjs --exe <chrome.exe> --profile <dir> [--port 9333] [--url ...]
//
// Why CDP: the browser window is GPU-composited, so PrintWindow returns a blank surface and
// the foreground lock blocks CopyFromScreen. Reading document.body.innerText is exact.

import { spawn } from "node:child_process";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const exe = arg("exe");
const profile = arg("profile");
const port = Number(arg("port", "9333"));
const url = arg(
  "url",
  "https://browserbench.org/Speedometer3.1/?startAutomatically=true&iterationCount=10&suite=TodoMVC-JavaScript-ES5",
);
const timeoutSeconds = Number(arg("timeout", "300"));
const attach = process.argv.includes("--attach");

if (!exe && !attach) {
  console.error("usage: node cdp-speedometer.mjs --exe <browser.exe> --profile <dir>");
  process.exit(2);
}

const child = attach
  ? { kill() {} }
  : spawn(exe, [
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      `--remote-debugging-port=${port}`,
      "--remote-allow-origins=*",
      "--window-size=1220,920",
      url,
    ], { stdio: "ignore", detached: false });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    return await res.json();
  } catch {
    return [];
  }
}

async function findPage() {
  for (let i = 0; i < 120; i++) {
    const list = await targets();
    const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (page) return page;
    await sleep(250);
  }
  throw new Error("no page target appeared");
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { try { ws.close(); } catch {} },
  };
}

async function main() {
  const page = await findPage();
  const session = connect(page.webSocketDebuggerUrl);
  await session.ready;
  await session.send("Runtime.enable");
  await session.send("Page.enable");
  await session.send("Page.navigate", { url });

  const deadline = Date.now() + timeoutSeconds * 1000;
  let text = "";
  while (Date.now() < deadline) {
    const res = await session.send("Runtime.evaluate", {
      expression: "document.title + '\\u0001' + document.body.innerText",
      returnByValue: true,
    });
    const value = res?.result?.result?.value ?? "";
    if (value.includes("Results Summary") || /Score\s+[\d.]+/.test(value)) {
      text = value;
      break;
    }
    await sleep(500);
  }

  if (!text) {
    console.log("RESULT: timeout, no results summary");
  } else {
    const title = text.split("\u0001")[0];
    const body = text.split("\u0001").slice(1).join("\u0001");
    const m = body.match(/Score\s+([0-9]+(?:\.[0-9]+)?)\s*±?\s*([0-9]+(?:\.[0-9]+)?)?/);
    const score = m ? `${m[1]} ± ${m[2] ?? "?"}` : "score not parsed";
    console.log(`RESULT: ${page.title}`);
    console.log(`TITLE: ${title}`);
    console.log(`SCORE: ${score}`);
  }

  session.close();
  try { child.kill(); } catch {}
  await sleep(500);
  process.exit(0);
}

main().catch((error) => {
  console.error("error:", error.message);
  try { child.kill(); } catch {}
  process.exit(1);
});
