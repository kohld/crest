import { think } from "./think";
import { selfAnalysis } from "./self-analysis";

const mode = Bun.argv.find((a) => a.startsWith("--mode="))?.split("=")[1]
  ?? Bun.argv[Bun.argv.indexOf("--mode") + 1];

if (!mode) {
  console.error("Usage: bun run src/index.ts --mode <think|act|self-analysis|site>");
  process.exit(1);
}

switch (mode) {
  case "think":
    await think();
    break;
  case "self-analysis":
    await selfAnalysis();
    break;
  default:
    console.error(`Unknown mode: ${mode}`);
    process.exit(1);
}
