import { readMemory, appendEntry, overwrite } from "./memory";

export enum ErrorSeverity {
  ERROR = "ERROR",
  WARNING = "WARNING", 
  CRITICAL = "CRITICAL"
}

export interface ErrorLogEntry {
  timestamp: string;
  severity: ErrorSeverity;
  context: string;
  message: string;
  stack?: string;
  retryCount?: number;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatErrorEntry(entry: ErrorLogEntry): string {
  const lines = [
    `## [${entry.timestamp}] ${entry.severity}: ${entry.context}`,
    `**Message:** ${entry.message}`,
    ...(entry.stack ? [`**Stack:**\n\`\`\`\n${entry.stack}\n\`\`\``] : []),
    ...(entry.retryCount !== undefined ? [`**Retry count:** ${entry.retryCount}`] : []),
  ];
  return lines.join("\n\n");
}

export async function logError(
  context: string,
  error: Error | string,
  severity: ErrorSeverity = ErrorSeverity.ERROR,
  retryCount?: number
): Promise<void> {
  const entry: ErrorLogEntry = {
    timestamp: formatTimestamp(),
    severity,
    context,
    message: typeof error === "string" ? error : error.message,
    stack: typeof error === "string" ? undefined : error.stack,
    retryCount
  };

  const formattedEntry = formatErrorEntry(entry);
  
  try {
    await appendEntry("ERRORS.md", formattedEntry);
  } catch (e) {
    // If error logging fails, fall back to console
    console.error("Failed to log error to ERRORS.md:", e);
    console.error("Original error:", formattedEntry);
  }
}

export async function getRecentErrors(limit?: number): Promise<ErrorLogEntry[]> {
  const content = await readMemory("ERRORS.md");
  if (!content) return [];
  
  // Parse entries separated by "---"
  const entryBlocks = content.split(/^---$/m).filter(block => block.trim());
  
  const entries: ErrorLogEntry[] = [];
  for (const block of entryBlocks) {
    const entry = parseErrorBlock(block);
    if (entry) entries.push(entry);
  }
  
  // Sort by timestamp descending (newest first)
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return limit ? entries.slice(0, limit) : entries;
}

function parseErrorBlock(block: string): ErrorLogEntry | null {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;
  
  // Parse header: "## [timestamp] severity: context"
  const headerMatch = lines[0].match(/^## \[(.*?)\] (ERROR|WARNING|CRITICAL): (.*)$/);
  if (!headerMatch) return null;
  
  const [, timestamp, severity, context] = headerMatch;
  
  let message = "";
  let stack: string | undefined;
  let retryCount: number | undefined;
  
  let i = 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("**Message:**")) {
      message = line.substring(11).trim();
    } else if (line.startsWith("**Stack:**")) {
      // Skip the line with "**Stack:**" and read until closing ```
      i++;
      const stackLines: string[] = [];
      while (i < lines.length && !lines[i].includes("```")) {
        stackLines.push(lines[i]);
        i++;
      }
      stack = stackLines.join('\n').trim();
    } else if (line.startsWith("**Retry count:**")) {
      retryCount = parseInt(line.substring(15).trim(), 10);
    }
    i++;
  }
  
  return {
    timestamp,
    severity: severity as ErrorSeverity,
    context,
    message,
    stack,
    retryCount
  };
}

// Initialize ERRORS.md if it doesn't exist
export async function initializeErrorLog(): Promise<void> {
  try {
    const existing = await readMemory("ERRORS.md");
    if (!existing) {
      await overwrite("ERRORS.md", "# Error Log\n\nThis file contains persistent error logs for debugging and observability.\n\n---\n\n");
    }
  } catch (e) {
    console.error("Failed to initialize error log:", e);
  }
}