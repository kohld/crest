import { describe, it, expect, beforeEach } from "bun:test";
import { ContextManager, estimateTokens } from "../src/context-manager";

describe("ContextManager", () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      maxTokens: 1000,
      pruneThreshold: 0.8,
      minRecentMessages: 2,
    });
  });

  describe("estimateTokens", () => {
    it("should estimate tokens correctly for simple text", () => {
      // 4 chars per token
      expect(estimateTokens("hello")).toBe(2); // 5 chars = 2 tokens
      expect(estimateTokens("hello world")).toBe(3); // 11 chars = 3 tokens
      expect(estimateTokens("a".repeat(100))).toBe(25); // 100 chars = 25 tokens
    });

    it("should handle empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("should handle array content", () => {
      const arrayContent = [{ type: "text", text: "hello" }];
      const tokens = estimateTokens(arrayContent);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("basic operations", () => {
    it("should set system message", () => {
      manager.setSystemMessage("You are a helpful assistant.");
      expect(manager.getMessages().length).toBe(1);
      expect(manager.getMessages()[0].role).toBe("system");
    });

    it("should add messages and track tokens", () => {
      manager.setSystemMessage("System prompt");
      manager.addMessage({ role: "user", content: "Hello" });
      manager.addMessage({ role: "assistant", content: "Hi there!" });

      expect(manager.getMessages().length).toBe(3);
      expect(manager.getTokenCount()).toBeGreaterThan(0);
    });

    it("should reset to system message only", () => {
      manager.setSystemMessage("System");
      manager.addMessage({ role: "user", content: "Hello" });
      manager.addMessage({ role: "assistant", content: "Hi" });

      manager.reset();

      expect(manager.getMessages().length).toBe(1);
      expect(manager.getMessages()[0].role).toBe("system");
    });
  });

  describe("pruning", () => {
    it("should not prune when below threshold", () => {
      manager.setSystemMessage("System");
      // Add a few small messages
      for (let i = 0; i < 3; i++) {
        manager.addMessage({ role: "user", content: "Message " + i });
      }

      expect(manager.needsPruning()).toBe(false);
      manager.prune();
      expect(manager.getMessages().length).toBe(4); // system + 3 messages
    });

    it("should prune old messages when threshold exceeded", () => {
      manager = new ContextManager({
        maxTokens: 100,
        pruneThreshold: 0.7,
        minRecentMessages: 2,
      });

      manager.setSystemMessage("System");

      // Add enough messages to exceed threshold
      for (let i = 0; i < 10; i++) {
        manager.addMessage({ role: "user", content: "This is a longer message that adds tokens. ".repeat(5) });
      }

      expect(manager.needsPruning()).toBe(true);
      const beforeCount = manager.getMessages().length;
      manager.prune();

      // Should keep system + minRecentMessages
      expect(manager.getMessages().length).toBe(3);
      expect(manager.getMessages()[0].role).toBe("system");
      // Last two should be the most recent
      expect(manager.getMessages()[1].role).toBe("user");
      expect(manager.getMessages()[2].role).toBe("user");
    });

    it("should not prune if fewer than minRecentMessages", () => {
      manager = new ContextManager({
        maxTokens: 100,
        pruneThreshold: 0.5,
        minRecentMessages: 5,
      });

      manager.setSystemMessage("System");
      manager.addMessage({ role: "user", content: "Hello" });
      manager.addMessage({ role: "assistant", content: "Hi" });

      expect(manager.needsPruning()).toBe(false);
    });

    it("should force prune even if not needed", () => {
      manager.setSystemMessage("System");
      manager.addMessage({ role: "user", content: "Hello" });
      manager.addMessage({ role: "assistant", content: "Hi" });
      manager.addMessage({ role: "user", content: "How are you?" });

      manager.forcePrune();
      // Should keep system + minRecentMessages (2)
      expect(manager.getMessages().length).toBe(3);
    });
  });

  describe("token counting", () => {
    it("should accurately estimate tokens for messages", () => {
      manager.setSystemMessage("System prompt with some text");
      const systemTokens = manager.getTokenCount();

      manager.addMessage({ role: "user", content: "User message" });
      const afterUser = manager.getTokenCount();

      expect(afterUser).toBeGreaterThan(systemTokens);

      manager.addMessage({ role: "assistant", content: "Assistant response" });
      const afterAssistant = manager.getTokenCount();

      expect(afterAssistant).toBeGreaterThan(afterUser);
    });
  });
});
