import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ILLMProvider,
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMMessage,
} from "../../shared/llm/contracts.js";
import { AuditTrail } from "../core/nl-command/audit-trail.js";
import { CommandAnalyzer } from "../core/nl-command/command-analyzer.js";
import {
  createInMemoryCommandListEventStore,
  createInMemoryCommandListSnapshotStore,
} from "../routes/node-adapters/command-list-node-adapter.js";
import {
  createInMemoryIntentRecognitionEventStore,
  createInMemoryIntentRecognitionSnapshotStore,
  createIntentRecognitionAnalyzerFromCommandAnalyzer,
  executeIntentRecognitionNode,
} from "../routes/node-adapters/intent-recognition-node-adapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_AUDIT_PATH = resolve(
  __dirname,
  "../../data/__test_intent_recognition__/nl-audit.json",
);

function cleanup() {
  const target = dirname(TEST_AUDIT_PATH);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
}

function createMockLLMProvider(content: string): ILLMProvider {
  return {
    name: "mock",
    generate: vi.fn(
      async (
        _messages: LLMMessage[],
        _options?: LLMGenerateOptions,
      ): Promise<LLMGenerateResult> => ({
        content,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        latencyMs: 25,
        model: "mock-model",
        provider: "mock",
      }),
    ),
    streamGenerate: async function* () {
      yield "";
    },
    healthCheck: async () => ({
      healthy: true,
      latencyMs: 5,
      provider: "mock",
    }),
    isTemporaryError: () => false,
  };
}

describe("intent_recognition node adapter", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it("reuses CommandAnalyzer output, writes events, and links command list plus recommended commands", async () => {
    const auditTrail = new AuditTrail(TEST_AUDIT_PATH);
    const analyzer = new CommandAnalyzer({
      llmProvider: createMockLLMProvider(
        JSON.stringify({
          intent: "release_execution",
          entities: [
            {
              name: "payment launch",
              type: "concept",
            },
          ],
          constraints: [
            {
              type: "time",
              description: "ship this week",
            },
          ],
          objectives: ["prepare launch execution path"],
          risks: [
            {
              id: "risk-1",
              description: "rollout target is still ambiguous",
              level: "medium",
              probability: 0.5,
              impact: 0.6,
              mitigation: "clarify expected rollout scope",
            },
          ],
          assumptions: ["operator wants a rollout-oriented answer"],
          confidence: 0.42,
          needsClarification: true,
          clarificationTopics: ["scope", "delivery window"],
        }),
      ),
      model: "mock-model",
      auditTrail,
    });
    const eventStore = createInMemoryIntentRecognitionEventStore();
    const snapshotStore = createInMemoryIntentRecognitionSnapshotStore();
    const commandListEventStore = createInMemoryCommandListEventStore();
    const commandListSnapshotStore = createInMemoryCommandListSnapshotStore();

    const result = await executeIntentRecognitionNode(
      {
        nodeType: "intent_recognition",
        input: {
          commandId: "cmd-intent-1",
          commandText: "Help me figure out the rollout steps for the payment launch",
          userId: "user-1",
          priority: "medium",
          locale: "en-US",
          planId: "plan-intent-1",
          context: {
            source: "panel",
          },
        },
      },
      {
        analyzer: createIntentRecognitionAnalyzerFromCommandAnalyzer(analyzer),
        eventStore,
        snapshotStore,
        commandListEventStore,
        commandListSnapshotStore,
        now: () => 1710000000000,
        idFactory: (() => {
          let counter = 0;
          return () => `intent-id-${++counter}`;
        })(),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.output.recognition.intent).toBe("release_execution");
    expect(result.output.recognition.source).toBe("command_analyzer");
    expect(result.output.recognition.confidenceBand).toBe("low");
    expect(result.output.routing.mode).toBe("clarify_first");
    expect(result.output.commandList.commandList.recommendedCandidateId).toBe(
      "intent-clarify",
    );
    expect(
      result.output.commandList.selectionBridge.recommendedSubmission?.optionId,
    ).toBe("intent-clarify");
    expect(result.output.recommendedCommands.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(
      result.output.recommendedCommands.suggestions[0]?.metadata?.intentRecognition,
    ).toMatchObject({
      recognitionId: "intent-id-1",
      intent: "release_execution",
      confidence: 0.42,
      confidenceBand: "low",
      suggestionPlanId: "plan-intent-1",
    });
    expect(result.output.events.map(event => event.type)).toEqual([
      "recognized",
      "confidence_recorded",
    ]);

    const storedEvents = eventStore.listByRecognitionId("intent-id-1");
    expect(storedEvents).toHaveLength(2);
    expect(storedEvents[0]?.metadata?.recommendedCandidateId).toBe("intent-clarify");
    expect(commandListEventStore.listByListId("intent-list-intent-id-1")).toHaveLength(1);

    const snapshot = snapshotStore.get("intent-id-1");
    expect(snapshot).toMatchObject({
      recognitionId: "intent-id-1",
      source: "command_analyzer",
      commandListId: "intent-list-intent-id-1",
    });
    expect(snapshot?.recommendedCommandIds.length).toBeGreaterThanOrEqual(2);
  });

  it("routes high-confidence, low-risk input to direct execution", async () => {
    const result = await executeIntentRecognitionNode(
      {
        nodeType: "intent_recognition",
        input: {
          commandText: "Generate the weekly growth dashboard summary",
          userId: "user-2",
          priority: "low",
          locale: "zh-CN",
        },
      },
      {
        analyzer: {
          source: "fallback",
          analyze: async () => ({
            intent: "growth_operation",
            entities: [],
            constraints: [],
            objectives: ["生成周报摘要"],
            risks: [],
            assumptions: ["输入已经足够明确"],
            confidence: 0.91,
            needsClarification: false,
          }),
        },
        now: () => 1710000000200,
        idFactory: (() => {
          let counter = 0;
          return () => `direct-${++counter}`;
        })(),
      },
    );

    expect(result.output.recognition.confidenceBand).toBe("high");
    expect(result.output.routing.mode).toBe("execute_direct");
    expect(result.output.commandList.commandList.recommendedCandidateId).toBe(
      "intent-execute",
    );
    expect(result.output.events[1]?.metadata?.routingMode).toBe("execute_direct");
  });
});
