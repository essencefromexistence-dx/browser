// make-ratio-table.mjs - Speedometer per-workload ratio: dx-browser vs Chrome.
//
//   node tools/make-ratio-table.mjs --dx <dx.json> --chrome <chrome.json> --out <md>
//
// Both payloads are the benchmarkClient._measuredValuesList arrays. The last iteration is used;
// each workload carries tests.<name>.tests.{Sync,Async} in milliseconds.
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const dx = JSON.parse(readFileSync(arg("dx"), "utf8"));
const chrome = JSON.parse(readFileSync(arg("chrome"), "utf8"));
const out = arg("out", "SPEEDOMETER-RATIO.md");

function last(list) {
  return list[list.length - 1];
}

function phaseTotal(entry, phase) {
  let sum = 0;
  for (const test of Object.values(entry.tests)) {
    const value = test.tests?.[phase];
    if (typeof value === "number") sum += value;
  }
  return sum;
}

const dxLast = last(dx);
const chromeLast = last(chrome);

const rows = [];
for (const [name, dxEntry] of Object.entries(dxLast.tests)) {
  const chromeEntry = chromeLast.tests[name];
  if (!chromeEntry) continue;
  rows.push({
    name,
    dx: dxEntry.total,
    chrome: chromeEntry.total,
    ratio: dxEntry.total / chromeEntry.total,
    dxSync: phaseTotal(dxEntry, "Sync"),
    chromeSync: phaseTotal(chromeEntry, "Sync"),
    dxAsync: phaseTotal(dxEntry, "Async"),
    chromeAsync: phaseTotal(chromeEntry, "Async"),
  });
}
rows.sort((a, b) => b.ratio - a.ratio);

const fmt = (value) => value.toFixed(1).padStart(8);
const syncRatio = (row) => (row.chromeSync > 0 ? (row.dxSync / row.chromeSync).toFixed(2) : "n/a");
const asyncRatio = (row) => (row.chromeAsync > 0 ? (row.dxAsync / row.chromeAsync).toFixed(2) : "n/a");

const header = [
  "# Speedometer 3.1 per-workload ratio: dx-browser vs Chrome 158",
  "",
  `dx score ${dxLast.score.toFixed(2)} (geomean ${dxLast.geomean.toFixed(1)} ms, ${dx.length} iterations)  `,
  `Chrome score ${chromeLast.score.toFixed(2)} (geomean ${chromeLast.geomean.toFixed(1)} ms, ${chrome.length} iterations)`,
  "",
  "| Workload | dx ms | Chrome ms | ratio | dx Sync | Chrome Sync | sync ratio | dx Async | Chrome Async | async ratio |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];

const body = rows.map((row) =>
  `| ${row.name} | ${fmt(row.dx)} | ${fmt(row.chrome)} | ${row.ratio.toFixed(2)}x | ${fmt(row.dxSync)} | ${fmt(row.chromeSync)} | ${syncRatio(row)} | ${fmt(row.dxAsync)} | ${fmt(row.chromeAsync)} | ${asyncRatio(row)} |`,
);

const md = header.concat(body).join("\n") + "\n";
writeFileSync(out, md);
console.log(`wrote ${out}: ${rows.length} workloads, worst ${rows[0].name} ${rows[0].ratio.toFixed(2)}x`);
