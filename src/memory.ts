import { join, dirname, basename } from "path";
import { promises as fs } from "node:fs";

const ROOT = import.meta.dir.replace("/src", "");

export function memoryPath(filename: string): string {
  return join(ROOT, filename);
}

function lockPath(filename: string): string {
  return `${memoryPath(filename)}.lock`;
}

async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const dir = dirname(targetPath);
  const filename = basename(targetPath);
  const tempPath = join(dir, `.${filename}.${process.pid}.${Date.now()}.tmp`);

  try {
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, targetPath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      // ignore cleanup errors
    }
    throw error;
  }
}

async function acquireLock(lockFile: string, timeout = 10000, staleThreshold = 300000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      // Try to create lock file exclusively (atomic)
      const fd = await fs.open(lockFile, "wx");
      // Write lock info for debugging
      await fd.writeFile(`pid:${process.pid},time:${Date.now()}`);
      await fd.close();
      return;
    } catch (err: any) {
      if (err.code !== "EEXIST") {
        throw err;
      }
      // Lock file exists, check if stale
      try {
        const stats = await fs.stat(lockFile);
        const age = Date.now() - stats.mtimeMs;
        if (age > staleThreshold) {
          // Try to remove stale lock
          await fs.unlink(lockFile);
          continue;
        }
      } catch (e) {
        // If stat fails, maybe file was just deleted, continue
      }
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Failed to acquire lock ${lockFile} after ${timeout}ms`);
}

async function releaseLock(lockFile: string): Promise<void> {
  try {
    await fs.unlink(lockFile);
  } catch (e) {
    // ignore errors (e.g., file doesn't exist)
  }
}

async function withWriteLock<T>(filename: string, operation: () => Promise<T>): Promise<T> {
  const lock = lockPath(filename);
  let acquired = false;
  try {
    await acquireLock(lock);
    acquired = true;
    return await operation();
  } finally {
    if (acquired) {
      await releaseLock(lock);
    }
  }
}

export async function readMemory(filename: string): Promise<string> {
  const path = memoryPath(filename);
  try {
    return await fs.readFile(path, "utf-8");
  } catch (err: any) {
    if (err.code === "ENOENT") return "";
    throw err;
  }
}

export async function prependEntry(filename: string, entry: string): Promise<void> {
  await withWriteLock(filename, async () => {
    const existing = await readMemory(filename);
    const content = existing ? `${entry}\n\n---\n\n${existing}` : entry;
    await atomicWrite(memoryPath(filename), content);
  });
}

export async function appendEntry(filename: string, entry: string): Promise<void> {
  await withWriteLock(filename, async () => {
    const existing = await readMemory(filename);
    const content = existing ? `${existing}\n\n---\n\n${entry}` : entry;
    await atomicWrite(memoryPath(filename), content);
  });
}

export async function overwrite(filename: string, content: string): Promise<void> {
  await withWriteLock(filename, async () => {
    await atomicWrite(memoryPath(filename), content);
  });
}

// Returns the last `count` date-entries (## headings) from a memory file
export async function readLastEntries(filename: string, count: number): Promise<string> {
  const content = await readMemory(filename);
  if (!content) return "";
  const entries = content.split(/(?=^## )/m).filter(Boolean);
  return entries.slice(0, count).join("\n\n---\n\n");
}
