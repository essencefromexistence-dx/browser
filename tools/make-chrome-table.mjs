// make-chrome-table.mjs - turn the exported Speedometer JSON into a markdown table.
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
const out = process.argv[3];
const iterations = JSON.parse(readFileSync(src, "utf8"));
const last = iterations[iterations.length - 1];
const rows = Object.entries(last.tests)
  .map(([name, value]) => `| ${name} | ${value.total.toFixed(1)} |`)
  .sort((a, b) => parseFloat(b.split("|")[2]) - parseFloat(a.split("|")[2]))
  .join("\n");

const md = `# Chrome 158 per-workload times (Speedometer 3.1, full run)

Exported ${new Date().toISOString().slice(0, 10)} from a single full run: score ${last.score.toFixed(2)},
geomean ${last.geomean.toFixed(1)} ms, ${iterations.length} iterations.

| Workload | total ms |
| --- | --- |
${rows}
`;
writeFileSync(out, md);
console.log(`wrote ${out} (${md.length} chars)`);
