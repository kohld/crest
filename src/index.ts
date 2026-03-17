import { think } from "./think";
import { selfAnalysis } from "./self-analysis";
import { buildSite } from "./site";
import { recordMemoryLoss } from "./memory-loss";

const mode = Bun.argv.find((a) => a.startsWith("--mode="))?.split("=")[1]
  ?? Bun.argv[Bun.argv.indexOf("--mode") + 1];

if (!mode) {
  console.error("Usage: bun run src/index.ts --mode <think|self-analysis|memory-loss|site>");
  process.exit(1);
}

switch (mode) {
  case "think":
    await think();
    break;
  case "self-analysis":
    await selfAnalysis();
    break;
  case "site":
    await buildSite();
    break;
  case "memory-loss":
    await recordMemoryLoss();
    break;
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
