import { join } from "path";

const ROOT = import.meta.dir.replace("/src", "");

export function memoryPath(filename: string): string {
  return join(ROOT, filename);
}

export async function readMemory(filename: string): Promise<string> {
  const path = memoryPath(filename);
  const file = Bun.file(path);
  if (!(await file.exists())) return "";
  return file.text();
}

export async function prependEntry(filename: string, entry: string): Promise<void> {
  const existing = await readMemory(filename);
  const content = existing ? `${entry}\n\n---\n\n${existing}` : entry;
  await Bun.write(memoryPath(filename), content);
}

export async function appendEntry(filename: string, entry: string): Promise<void> {
  const existing = await readMemory(filename);
  const content = existing ? `${existing}\n\n---\n\n${entry}` : entry;
  await Bun.write(memoryPath(filename), content);
}

export async function overwrite(filename: string, content: string): Promise<void> {
  await Bun.write(memoryPath(filename), content);
}

// Returns the last `count` date-entries (## headings) from a memory file
export async function readLastEntries(filename: string, count: number): Promise<string> {
  const content = await readMemory(filename);
  if (!content) return "";
  const entries = content.split(/(?=^## )/m).filter(Boolean);
  return entries.slice(0, count).join("\n\n---\n\n");
}
