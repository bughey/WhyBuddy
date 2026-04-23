import type { CommandAnalyzer } from "../../core/nl-command/command-analyzer.js";
import {
  executeCommandListNode,
  type CommandListEventStore,
  type CommandListSnapshotStore,
} from "./command-list-node-adapter.js";
import {
  RecommendedCommandsAdapter,
  type RecommendedCommandsService,
} from "./recommended-commands-node-adapter.js";
import type {
  CommandAnalysis,
  CommandPriority,
  StrategicCommand,
} from "../../../shared/nl-command/contracts.js";
import type { CommandListCandidateInput } from "../../../shared/nl-command/command-list.js";
import {
  type IntentRecognitionConfidenceBand,
  type IntentRecognitionEvent,
  type IntentRecognitionNodeExecutionRequest,
  type IntentRecognitionNodeExecutionResult,
  type IntentRecognitionNodeInput,
  type IntentRecognitionNodeType,
  type IntentRecognitionRoutingDecision,
  type IntentRecognitionSnapshot,
  type IntentRecognitionLocale,
} from "../../../shared/web-aigc-intent-recognition.js";

export interface IntentRecognitionAnalyzer {
  analyze(command: StrategicCommand): Promise<CommandAnalysis>;
  source: "command_analyzer" | "fallback";
}

export interface IntentRecognitionEventStore {
  append(event: IntentRecognitionEvent): void;
  listByRecognitionId(recognitionId: string): IntentRecognitionEvent[];
}

export interface IntentRecognitionSnapshotStore {
  save(snapshot: IntentRecognitionSnapshot): void;
  get(recognitionId: string): IntentRecognitionSnapshot | undefined;
}

export interface IntentRecognitionNodeAdapterDeps {
  analyzer?: IntentRecognitionAnalyzer;
  eventStore?: IntentRecognitionEventStore;
  snapshotStore?: IntentRecognitionSnapshotStore;
  commandListEventStore?: CommandListEventStore;
  commandListSnapshotStore?: CommandListSnapshotStore;
  recommendedCommandsService?: RecommendedCommandsService;
  now?: () => number;
  idFactory?: () => string;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function ensureString(value: unknown, field: string): string {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`Intent recognition node input requires ${field}.`);
  }
  return normalized;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizePriority(value: unknown): CommandPriority {
  return value === "critical" || value === "high" || value === "low"
    ? value
    : "medium";
}

function normalizeLocale(value: unknown): IntentRecognitionLocale {
  return value === "en-US" ? "en-US" : "zh-CN";
}

function normalizeAnalysis(raw: CommandAnalysis): CommandAnalysis {
  return {
    intent: normalizeString(raw.intent) ?? "unknown",
    entities: Array.isArray(raw.entities) ? raw.entities : [],
    constraints: Array.isArray(raw.constraints) ? raw.constraints : [],
    objectives: Array.isArray(raw.objectives) ? raw.objectives : [],
    risks: Array.isArray(raw.risks) ? raw.risks : [],
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
    confidence:
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0,
    needsClarification: raw.needsClarification === true,
    clarificationTopics: Array.isArray(raw.clarificationTopics)
      ? raw.clarificationTopics.filter(
          (topic): topic is string =>
            typeof topic === "string" && topic.trim().length > 0,
        )
      : undefined,
  };
}

function deriveFallbackIntent(commandText: string): string {
  const lower = commandText.toLowerCase();
  if (/launch|publish|release|rollout|上线|发布/.test(lower)) {
    return "release_execution";
  }
  if (/plan|规划|方案|roadmap/.test(lower)) {
    return "planning";
  }
  if (/fix|repair|bug|故障|排查/.test(lower)) {
    return "issue_resolution";
  }
  if (/growth|增长|campaign|营销/.test(lower)) {
    return "growth_operation";
  }
  return "general_request";
}

const fallbackAnalyzer: IntentRecognitionAnalyzer = {
  source: "fallback",
  async analyze(command) {
    const intent = deriveFallbackIntent(command.commandText);
    const hasQuestion = /[?？]/.test(command.commandText);
    const confidence = hasQuestion ? 0.48 : 0.62;

    return {
      intent,
      entities: [],
      constraints: command.constraints,
      objectives: command.objectives,
      risks: [],
      assumptions: hasQuestion
        ? ["Fallback analyzer detected ambiguity from interrogative phrasing."]
        : ["Fallback analyzer inferred intent from command keywords."],
      confidence,
      needsClarification: hasQuestion,
      clarificationTopics: hasQuestion ? ["scope", "expected output"] : undefined,
    };
  },
};

export function createIntentRecognitionAnalyzerFromCommandAnalyzer(
  commandAnalyzer: Pick<CommandAnalyzer, "analyze">,
): IntentRecognitionAnalyzer {
  return {
    source: "command_analyzer",
    analyze(command) {
      return commandAnalyzer.analyze(command);
    },
  };
}

export function createInMemoryIntentRecognitionEventStore(): IntentRecognitionEventStore {
  const events: IntentRecognitionEvent[] = [];
  return {
    append(event) {
      events.push(structuredClone(event));
    },
    listByRecognitionId(recognitionId) {
      return events
        .filter(event => event.recognitionId === recognitionId)
        .map(event => structuredClone(event));
    },
  };
}

export function createInMemoryIntentRecognitionSnapshotStore(): IntentRecognitionSnapshotStore {
  const snapshots = new Map<string, IntentRecognitionSnapshot>();
  return {
    save(snapshot) {
      snapshots.set(snapshot.recognitionId, structuredClone(snapshot));
    },
    get(recognitionId) {
      const snapshot = snapshots.get(recognitionId);
      return snapshot ? structuredClone(snapshot) : undefined;
    },
  };
}

function nowIso(now: number): string {
  return new Date(now).toISOString();
}

function resolveConfidenceBand(confidence: number): IntentRecognitionConfidenceBand {
  if (confidence >= 0.8) {
    return "high";
  }
  if (confidence >= 0.5) {
    return "medium";
  }
  return "low";
}

function buildStrategicCommand(
  input: IntentRecognitionNodeInput,
  now: number,
): StrategicCommand {
  return {
    commandId: normalizeString(input.commandId) ?? `intent-command-${now}`,
    commandText: ensureString(input.commandText, "commandText"),
    userId: ensureString(input.userId, "userId"),
    timestamp: now,
    status: "analyzing",
    constraints: Array.isArray(input.constraints) ? input.constraints : [],
    objectives: Array.isArray(input.objectives) ? input.objectives : [],
    priority: normalizePriority(input.priority),
    ...(input.timeframe ? { timeframe: input.timeframe } : {}),
  };
}

function buildReasonSummary(analysis: CommandAnalysis): string[] {
  const summary = [
    ...analysis.objectives.map(item => `objective:${item}`),
    ...analysis.assumptions.map(item => `assumption:${item}`),
    ...(analysis.clarificationTopics ?? []).map(item => `clarification:${item}`),
    ...analysis.risks.map(item => `risk:${item.level}:${item.description}`),
  ];

  return summary.slice(0, 6);
}

function buildRoutingDecision(input: {
  analysis: CommandAnalysis;
  command: StrategicCommand;
  confidenceBand: IntentRecognitionConfidenceBand;
  locale: IntentRecognitionLocale;
  suggestionPlanId: string;
}): IntentRecognitionRoutingDecision {
  const { analysis, command, confidenceBand, locale, suggestionPlanId } = input;
  const hasHighRisk = analysis.risks.some(
    risk => risk.level === "high" || risk.level === "critical",
  );

  if (analysis.needsClarification || confidenceBand === "low") {
    return {
      mode: "clarify_first",
      rationale:
        locale === "zh-CN"
          ? "当前意图置信度偏低或仍有待澄清项，先进入澄清型命令列表更稳妥。"
          : "Confidence is still low or clarification is required, so clarify-first routing is safer.",
      nextNodeType: "command_list",
      recommendedCandidateId: "intent-clarify",
      suggestionPlanId,
    };
  }

  if (
    hasHighRisk ||
    command.priority === "critical" ||
    command.priority === "high"
  ) {
    return {
      mode: "plan_first",
      rationale:
        locale === "zh-CN"
          ? "当前意图已经可识别，但风险或优先级较高，建议先生成计划与风险提示。"
          : "Intent is recognizable, but risk or priority is high, so planning first is preferred.",
      nextNodeType: "command_list",
      recommendedCandidateId: "intent-plan",
      suggestionPlanId,
    };
  }

  return {
    mode: "execute_direct",
    rationale:
      locale === "zh-CN"
        ? "当前意图明确且风险可控，可直接进入执行型命令列表。"
        : "Intent is clear and risk is manageable, so direct execution is acceptable.",
    nextNodeType: "command_list",
    recommendedCandidateId: "intent-execute",
    suggestionPlanId,
  };
}

function buildIntentAwareCandidates(input: {
  command: StrategicCommand;
  analysis: CommandAnalysis;
  locale: IntentRecognitionLocale;
  routing: IntentRecognitionRoutingDecision;
}): CommandListCandidateInput[] {
  const { command, analysis, locale, routing } = input;
  const isZh = locale === "zh-CN";
  const intentLabel = analysis.intent || "unknown";
  const confidencePercent = Math.round(analysis.confidence * 100);

  return [
    {
      candidateId: "intent-clarify",
      label: isZh ? "先澄清意图" : "Clarify intent first",
      commandText: `${command.commandText}\n\n${
        isZh
          ? "请先输出需要确认的意图边界、交付目标和关键约束。"
          : "Please clarify the intent boundaries, delivery target, and critical constraints first."
      }`,
      description: isZh
        ? `识别意图为 ${intentLabel}，当前置信度 ${confidencePercent}%，适合先补充澄清信息。`
        : `Recognized intent is ${intentLabel} with ${confidencePercent}% confidence; clarifying first is safer.`,
      recommended: routing.recommendedCandidateId === "intent-clarify",
      source: "nl-command",
    },
    {
      candidateId: "intent-plan",
      label: isZh ? "先生成计划" : "Plan before execution",
      commandText: `${command.commandText}\n\n${
        isZh
          ? "请基于当前识别意图先生成执行计划、关键依赖与风险提示。"
          : "Please generate an execution plan, dependencies, and risk notes based on the recognized intent."
      }`,
      description: isZh
        ? "适合高优先级或高风险场景，先看计划再决定是否执行。"
        : "Useful for higher priority or higher risk scenarios before direct execution.",
      recommended: routing.recommendedCandidateId === "intent-plan",
      source: "heuristic",
    },
    {
      candidateId: "intent-execute",
      label: isZh ? "直接执行" : "Execute directly",
      commandText: command.commandText,
      description: isZh
        ? "意图明确时可直接把当前请求送入 NL Command 执行链路。"
        : "When intent is clear, send the request directly into the NL Command execution flow.",
      recommended: routing.recommendedCandidateId === "intent-execute",
      source: "nl-command",
    },
  ];
}

function buildRecognizedEvent(input: {
  eventId: string;
  recognitionId: string;
  timestamp: number;
  userId: string;
  analysis: CommandAnalysis;
  confidenceBand: IntentRecognitionConfidenceBand;
  routing: IntentRecognitionRoutingDecision;
  commandListId: string;
}): IntentRecognitionEvent {
  return {
    eventId: input.eventId,
    recognitionId: input.recognitionId,
    type: "recognized",
    timestamp: input.timestamp,
    userId: input.userId,
    intent: input.analysis.intent,
    confidence: input.analysis.confidence,
    confidenceBand: input.confidenceBand,
    metadata: {
      needsClarification: input.analysis.needsClarification,
      riskCount: input.analysis.risks.length,
      recommendedCandidateId: input.routing.recommendedCandidateId,
      suggestionPlanId: input.routing.suggestionPlanId,
      commandListId: input.commandListId,
    },
  };
}

function buildConfidenceEvent(input: {
  eventId: string;
  recognitionId: string;
  timestamp: number;
  userId: string;
  analysis: CommandAnalysis;
  confidenceBand: IntentRecognitionConfidenceBand;
  routing: IntentRecognitionRoutingDecision;
  source: "command_analyzer" | "fallback";
}): IntentRecognitionEvent {
  return {
    eventId: input.eventId,
    recognitionId: input.recognitionId,
    type: "confidence_recorded",
    timestamp: input.timestamp,
    userId: input.userId,
    intent: input.analysis.intent,
    confidence: input.analysis.confidence,
    confidenceBand: input.confidenceBand,
    metadata: {
      source: input.source,
      routingMode: input.routing.mode,
      clarificationRequired: input.analysis.needsClarification,
      highRiskCount: input.analysis.risks.filter(
        risk => risk.level === "high" || risk.level === "critical",
      ).length,
    },
  };
}

function withIntentMetadata(
  result: Awaited<ReturnType<RecommendedCommandsService["listSuggestions"]>>,
  input: {
    recognitionId: string;
    intent: string;
    confidence: number;
    confidenceBand: IntentRecognitionConfidenceBand;
    suggestionPlanId: string;
  },
) {
  return {
    ...result,
    suggestions: result.suggestions.map(suggestion => ({
      ...suggestion,
      metadata: {
        ...(suggestion.metadata ?? {}),
        intentRecognition: {
          recognitionId: input.recognitionId,
          intent: input.intent,
          confidence: input.confidence,
          confidenceBand: input.confidenceBand,
          suggestionPlanId: input.suggestionPlanId,
        },
      },
    })),
  };
}

export function isIntentRecognitionNodeType(
  value: unknown,
): value is IntentRecognitionNodeType {
  return value === "intent_recognition";
}

export async function executeIntentRecognitionNode(
  request: IntentRecognitionNodeExecutionRequest,
  deps: IntentRecognitionNodeAdapterDeps = {},
): Promise<IntentRecognitionNodeExecutionResult> {
  if (!isIntentRecognitionNodeType(request.nodeType)) {
    throw new Error("Unsupported intent_recognition node type.");
  }

  const now = deps.now ?? Date.now;
  const currentTime = now();
  const idFactory =
    deps.idFactory ??
    (() => `intent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const analyzer = deps.analyzer ?? fallbackAnalyzer;
  const recommendedCommandsService =
    deps.recommendedCommandsService ?? new RecommendedCommandsAdapter();

  const input = request.input ?? {};
  const locale = normalizeLocale(input.locale);
  const command = buildStrategicCommand(input, currentTime);
  const analysis = normalizeAnalysis(await analyzer.analyze(command));
  const confidenceBand = resolveConfidenceBand(analysis.confidence);
  const recognitionId = idFactory();
  const suggestionPlanId =
    normalizeString(input.planId) ?? `intent-plan-${recognitionId}`;
  const routing = buildRoutingDecision({
    analysis,
    command,
    confidenceBand,
    locale,
    suggestionPlanId,
  });
  const candidates = buildIntentAwareCandidates({
    command,
    analysis,
    locale,
    routing,
  });

  const commandListResult = await executeCommandListNode(
    {
      nodeType: "command_list",
      input: {
        listId: `intent-list-${recognitionId}`,
        commandText: command.commandText,
        userId: command.userId,
        locale,
        priority: command.priority,
        candidates,
        context: {
          ...normalizeRecord(input.context),
          intentRecognition: {
            recognitionId,
            intent: analysis.intent,
            confidence: analysis.confidence,
            confidenceBand,
            mode: routing.mode,
          },
        },
      },
    },
    {
      eventStore: deps.commandListEventStore,
      snapshotStore: deps.commandListSnapshotStore,
    },
  );

  const recommendedCommands = withIntentMetadata(
    await recommendedCommandsService.listSuggestions(suggestionPlanId),
    {
      recognitionId,
      intent: analysis.intent,
      confidence: analysis.confidence,
      confidenceBand,
      suggestionPlanId,
    },
  );

  const recognizedEvent = buildRecognizedEvent({
    eventId: idFactory(),
    recognitionId,
    timestamp: currentTime,
    userId: command.userId,
    analysis,
    confidenceBand,
    routing,
    commandListId: commandListResult.output.commandList.listId,
  });
  const confidenceEvent = buildConfidenceEvent({
    eventId: idFactory(),
    recognitionId,
    timestamp: currentTime,
    userId: command.userId,
    analysis,
    confidenceBand,
    routing,
    source: analyzer.source,
  });
  deps.eventStore?.append(recognizedEvent);
  deps.eventStore?.append(confidenceEvent);

  const snapshot: IntentRecognitionSnapshot = {
    recognitionId,
    nodeType: "intent_recognition",
    command,
    analysis,
    confidenceBand,
    recognizedAt: nowIso(currentTime),
    source: analyzer.source,
    routing,
    commandListId: commandListResult.output.commandList.listId,
    recommendedCommandIds: recommendedCommands.suggestions.map(
      suggestion => suggestion.suggestionId,
    ),
    context: normalizeRecord(input.context),
  };
  deps.snapshotStore?.save(snapshot);

  return {
    ok: true,
    nodeType: "intent_recognition",
    output: {
      status: "completed",
      recognition: {
        recognitionId,
        command,
        analysis,
        intent: analysis.intent,
        confidence: analysis.confidence,
        confidenceBand,
        needsClarification: analysis.needsClarification,
        source: analyzer.source,
        reasonSummary: buildReasonSummary(analysis),
      },
      routing,
      commandList: commandListResult.output,
      recommendedCommands,
      events: [recognizedEvent, confidenceEvent],
      context: normalizeRecord(input.context),
    },
  };
}
