import { MODEL } from "./src/config.ts";

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  const json = await res.json();
  
  const freeWithTools = json.data.filter((m: any) => 
    m.id.endsWith(":free") && 
    m.supported_parameters?.includes("tools")
  );
  
  console.log("Free models with tool support:");
  freeWithTools.forEach((m: any) => {
    console.log(`  ${m.id} — ${m.name} (${m.context_length} context)`);
  });
  
  const current = freeWithTools.find((m: any) => m.id === MODEL);
  console.log(`\nCurrent model: ${MODEL}`);
  console.log(`Current context: ${current?.context_length || 0}`);
  
  const upgrades = freeWithTools.filter((m: any) => 
    m.id !== MODEL && m.context_length > (current?.context_length || 0)
  );
  
  console.log(`\nUpgrades available: ${upgrades.length}`);
  upgrades.sort((a: any, b: any) => b.context_length - a.context_length);
  upgrades.forEach((m: any) => {
    console.log(`  ${m.id} — ${m.name} (${m.context_length} context)`);
  });
}

main().catch(console.error);