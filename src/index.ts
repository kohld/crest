import { think } from "./think";
import { selfAnalysis } from "./self-analysis";
import { seedling } from "./seedling";
import { buildSite } from "./site";
import { recordMemoryLoss } from "./memory-loss";

let mode = undefined;

// Check for --mode=value
const equalsArg = Bun.argv.find(arg => arg.startsWith("--mode="));
if (equalsArg) {
  mode = equalsArg.split("=")[1];
} else {
  // Check for --mode value
  const index = Bun.argv.indexOf("--mode");
  if (index !== -1 && Bun.argv[index + 1] !== undefined) {
    mode = Bun.argv[index + 1];
  }
}

if (!mode) {
  console.error("Usage: bun run src/index.ts --mode <think|self-analysis|act|site|memory-loss>");
  process.exit(1);
}

switch (mode) {
  case "think":
    await think();
    break;
  case "self-analysis":
    await selfAnalysis();
    break;
  case "act":
  case "seedling":
    await seedling();
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