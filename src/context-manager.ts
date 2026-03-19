/**
 * Context Manager for proactive conversation history management
 * Prevents context window overflow by pruning or summarizing old messages
 */

import type { Message as AIMessage } from "ai";

export interface ContextConfig {
  /** Maximum tokens allowed (context window size) */
  maxTokens: number;
  /** Threshold at which to start pruning (e.g., 0.8 = 80% of max) */
  pruneThreshold: number;
  /** Minimum number of recent messages to keep */
  minRecentMessages: number;
  /** Whether to attempt summarization instead of pruning */
  enableSummarization: boolean;
}

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 16000, // Conservative estimate for most models
  pruneThreshold: 0.8,
  minRecentMessages: 4,
  enableSummarization: false, // Start with simple pruning
};

/**
 * Rough token estimation: ~4 characters per token for English text
 * This is a simplification; actual token count varies by model and tokenizer
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Extract string content from an AI SDK message for token estimation
 */
function getMessageStringContent(message: AIMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  // For array content (tool results, multi-part), convert to string
  return JSON.stringify(message.content);
}

/**
 * Manages conversation context to prevent overflow
 */
export class ContextManager {
  private messages: AIMessage[] = [];
  private config: ContextConfig;
  private totalTokens: number = 0;

  constructor(config: Partial<ContextConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize with a system message
   */
  setSystemMessage(content: string): void {
    this.messages = [{ role: "system", content }];
    this.totalTokens = estimateTokens(content);
  }

  /**
   * Add a message to the history
   */
  addMessage(message: AIMessage): void {
    this.messages.push(message);
    this.totalTokens += this.estimateMessageTokens(message);
  }

  /**
   * Get current message history
   */
  getMessages(): AIMessage[] {
    return this.messages;
  }

  /**
   * Get current token count
   */
  getTokenCount(): number {
    return this.totalTokens;
  }

  /**
   * Check if context exceeds prune threshold
   */
  needsPruning(): boolean {
    const threshold = this.config.maxTokens * this.config.pruneThreshold;
    return this.totalTokens > threshold;
  }

  /**
   * Estimate tokens for a single message
   */
  private estimateMessageTokens(message: AIMessage): number {
    return estimateTokens(getMessageStringContent(message));
  }

  /**
   * Prune old messages to reduce context size
   * Strategy: Keep system message, recent messages, and tool results that are likely needed
   */
  prune(): void {
    if (this.messages.length <= this.config.minRecentMessages) {
      return; // Nothing to prune
    }

    const systemMessage = this.messages.find((m) => m.role === "system");
    const nonSystemMessages = this.messages.filter((m) => m.role !== "system");

    // Keep the most recent messages
    const recentMessages = nonSystemMessages.slice(-this.config.minRecentMessages);

    // Reconstruct message list
    this.messages = [...(systemMessage ? [systemMessage] : []), ...recentMessages];

    // Recalculate total tokens
    this.totalTokens = this.messages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);

    console.log(
      `Context pruned: kept ${this.messages.length} messages, ${this.totalTokens} tokens`
    );
  }

  /**
   * Force a prune regardless of threshold
   */
  forcePrune(): void {
    this.prune();
  }

  /**
   * Clear all messages except system
   */
  reset(): void {
    const systemMessage = this.messages.find((m) => m.role === "system");
    this.messages = systemMessage ? [systemMessage] : [];
    this.totalTokens = this.messages.reduce((sum, m) => sum + this.estimateMessageTokens(m), 0);
  }
}
