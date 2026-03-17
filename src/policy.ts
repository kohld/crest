/**
 * Policy module for pre-execution safety checks.
 *
 * This module defines a simple policy language that evaluates allow/deny rules
 * before agentic actions are executed. The policy is deterministic and provides
 * immediate feedback when an action is blocked.
 *
 * Policy DSL:
 * - Rules match on action type (tool name) or "*" for all actions.
 * - Each rule can have `deny` patterns (regex strings) that block matching arguments.
 * - Each rule can have `allow` patterns (regex strings) that must match at least one
 *   if any allow patterns exist for the action; otherwise, allow by default unless denied.
 * - Patterns are applied case-insensitively to the JSON stringification of the action arguments.
 *
 * Example rule:
 *   { action: "run_command", deny: ["rm\\s+-rf", "dd\\s+if="] }
 *
 * The evaluation order: all matching rules are collected; deny patterns are checked first
 * (any match denies). Then allow patterns are checked (if any exist, at least one must match).
 */

export interface PolicyRule {
  action: string; // tool name or "*" for all actions
  deny?: string[]; // regex patterns (as strings) that cause denial
  allow?: string[]; // regex patterns (as strings) that must match if present
}

/**
 * Default policy rules. These provide baseline safety for common dangerous operations.
 * Edit this array to customize the policy.
 */
export const DEFAULT_POLICY: PolicyRule[] = [
  {
    action: "run_command",
    deny: [
      // Destructive filesystem operations
      "rm\\s+-rf",
      "dd\\s+if=",
      "mkfs",
      "shutdown",
      "reboot",
      // Writing to device files or system directories (/dev/null is safe, exclude it)
      ">\\s*/dev/(?!null)",
      "curl\\s+.*\\|\\s*sh",
      "wget\\s+.*\\-O\\s*/",
      // Direct writes to protected files via shell
      ">\\s*.*\\b(IDENTITY\\.md|THOUGHTS\\.md|BELIEFS\\.md|CHANGELOG\\.md|SELF_ANALYSIS\\.md|MEMORY_LOSS\\.md)\\b",
      "tee\\s*.*\\b(IDENTITY\\.md|THOUGHTS\\.md|BELIEFS\\.md|CHANGELOG\\.md|SELF_ANALYSIS\\.md|MEMORY_LOSS\\.md)\\b",
      "cp\\s+.*\\b(IDENTITY\\.md|THOUGHTS\\.md|BELIEFS\\.md|CHANGELOG\\.md|SELF_ANALYSIS\\.md|MEMORY_LOSS\\.md)\\b",
      "mv\\s+.*\\b(IDENTITY\\.md|THOUGHTS\\.md|BELIEFS\\.md|CHANGELOG\\.md|SELF_ANALYSIS\\.md|MEMORY_LOSS\\.md)\\b",
      // Writes to system config directories
      ">\\s*/etc/",
      "tee\\s+/etc/",
      "cp\\s+.*\\s+/etc/",
      "mv\\s+.*\\s+/etc/",
    ]
  },
  {
    action: "write_file",
    deny: [
      // Prevent writing outside the repository or to system locations
      "/etc/",
      "/root/",
      "/home/",
      "/var/",
      // Protect history and identity files
      "\\bIDENTITY\\.md\\b",
      "\\bTHOUGHTS\\.md\\b",
      "\\bBELIEFS\\.md\\b",
      "\\bCHANGELOG\\.md\\b",
      "\\bSELF_ANALYSIS\\.md\\b",
      "\\bMEMORY_LOSS\\.md\\b",
      // Sensitive files - match anywhere in the JSON string
      "\\.env",
      "id_rsa",
      "password",
    ]
  },
  {
    action: "read_file",
    deny: [
      // Sensitive files that should not be read (e.g., to avoid exfiltration)
      "\\.env",
      "id_rsa",
      "password",
    ]
  }
  // Additional rules can be added for new tools
];

/**
 * Result of policy evaluation.
 */
export interface PolicyResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Evaluates the policy for a given action and its arguments.
 *
 * @param action - The tool name (e.g., "read_file", "write_file", "run_command")
 * @param args - The arguments object passed to the tool
 * @returns PolicyResult indicating if the action is allowed and a reason if denied
 */
export function evaluatePolicy(action: string, args: Record<string, any>): PolicyResult {
  // Collect all rules that apply to this action
  const relevantRules = DEFAULT_POLICY.filter(r => r.action === "*" || r.action === action);

  // For file operations, only check the path — not the file content.
  // Checking content would cause false positives (e.g. a test file mentioning /etc/passwd).
  const targetString = (action === "write_file" || action === "read_file")
    ? JSON.stringify({ file_path: args.file_path ?? "" }).toLowerCase()
    : JSON.stringify(args).toLowerCase();

  // Check deny patterns first
  for (const rule of relevantRules) {
    if (rule.deny) {
      const argsString = targetString;
      for (const pattern of rule.deny) {
        try {
          const regex = new RegExp(pattern, "i");
          if (regex.test(argsString)) {
            return {
              allowed: false,
              reason: `Denied by policy: pattern "${pattern}" matches arguments`,
            };
          }
        } catch (e) {
          // If regex is invalid, log and continue (but this shouldn't happen with static patterns)
          console.warn(`Invalid policy regex pattern: ${pattern}`, e);
        }
      }
    }
  }

  // Check allow patterns: if any rule defines allow patterns, at least one must match
  const allowPatterns: string[] = [];
  for (const rule of relevantRules) {
    if (rule.allow) {
      allowPatterns.push(...rule.allow);
    }
  }
  if (allowPatterns.length > 0) {
    const argsString = targetString;
    let matched = false;
    for (const pattern of allowPatterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(argsString)) {
          matched = true;
          break;
        }
      } catch (e) {
        console.warn(`Invalid policy regex pattern: ${pattern}`, e);
      }
    }
    if (!matched) {
      return {
        allowed: false,
        reason: `Not allowed: no allow pattern matched for action "${action}"`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Error thrown when a policy violation occurs.
 */
export class PolicyViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyViolationError";
  }
}

/**
 * Helper to enforce policy and throw on violation.
 *
 * @param action - Tool name
 * @param args - Tool arguments
 */
export function enforcePolicy(action: string, args: Record<string, any>): void {
  const result = evaluatePolicy(action, args);
  if (!result.allowed) {
    throw new PolicyViolationError(result.reason ?? "Policy violation");
  }
}