import type {
  CommandAnalysis,
  CommandConstraint,
  CommandPriority,
  CommandTimeframe,
  StrategicCommand,
} from "./nl-command/contracts.js";
import type { GetSuggestionsResponse } from "./nl-command/api.js";
import type { CommandListNodeExecutionResult } from "./nl-command/command-list.js";

export const WEB_AIGC_INTENT_RECOGNITION_API = {
  EXECUTE: "POST /api/intent-recognition/nodes/execute",
} as const;

export const WEB_AIGC_INTENT_RECOGNITION_NODE_TYPES = [
  "intent_recognition",
] as const;

export type IntentRecognitionNodeType =
  (typeof WEB_AIGC_INTENT_RECOGNITION_NODE_TYPES)[number];

export const WEB_AIGC_INTENT_RECOGNITION_LOCALES = [
  "zh-CN",
  "en-US",
] as const;

export type IntentRecognitionLocale =
  (typeof WEB_AIGC_INTENT_RECOGNITION_LOCALES)[number];

export const WEB_AIGC_INTENT_CONFIDENCE_BANDS = [
  "low",
  "medium",
  "high",
] as const;

export type IntentRecognitionConfidenceBand =
  (typeof WEB_AIGC_INTENT_CONFIDENCE_BANDS)[number];

export const WEB_AIGC_INTENT_RECOGNITION_EVENT_TYPES = [
  "recognized",
  "confidence_recorded",
] as const;

export type IntentRecognitionEventType =
  (typeof WEB_AIGC_INTENT_RECOGNITION_EVENT_TYPES)[number];

export interface IntentRecognitionNodeInput {
  commandId?: string;
  commandText?: string;
  userId?: string;
  priority?: CommandPriority;
  locale?: IntentRecognitionLocale;
  planId?: string;
  timeframe?: CommandTimeframe;
  constraints?: CommandConstraint[];
  objectives?: string[];
  context?: Record<string, unknown>;
}

export interface IntentRecognitionNodeExecutionRequest {
  nodeType: IntentRecognitionNodeType;
  input?: IntentRecognitionNodeInput;
}

export interface IntentRecognitionEvent {
  eventId: string;
  recognitionId: string;
  type: IntentRecognitionEventType;
  timestamp: number;
  userId: string;
  intent: string;
  confidence: number;
  confidenceBand: IntentRecognitionConfidenceBand;
  metadata?: Record<string, unknown>;
}

export interface IntentRecognitionRoutingDecision {
  mode: "clarify_first" | "plan_first" | "execute_direct";
  rationale: string;
  nextNodeType: "command_list";
  recommendedCandidateId: string;
  suggestionPlanId: string;
}

export interface IntentRecognitionSnapshot {
  recognitionId: string;
  nodeType: IntentRecognitionNodeType;
  command: StrategicCommand;
  analysis: CommandAnalysis;
  confidenceBand: IntentRecognitionConfidenceBand;
  recognizedAt: string;
  source: "command_analyzer" | "fallback";
  routing: IntentRecognitionRoutingDecision;
  commandListId: string;
  recommendedCommandIds: string[];
  context?: Record<string, unknown>;
}

export interface IntentRecognitionResultPayload {
  recognitionId: string;
  command: StrategicCommand;
  analysis: CommandAnalysis;
  intent: string;
  confidence: number;
  confidenceBand: IntentRecognitionConfidenceBand;
  needsClarification: boolean;
  source: "command_analyzer" | "fallback";
  reasonSummary: string[];
}

export interface IntentRecognitionNodeExecutionResult {
  ok: true;
  nodeType: IntentRecognitionNodeType;
  output: {
    status: "completed";
    recognition: IntentRecognitionResultPayload;
    routing: IntentRecognitionRoutingDecision;
    commandList: CommandListNodeExecutionResult["output"];
    recommendedCommands: GetSuggestionsResponse;
    events: IntentRecognitionEvent[];
    context: Record<string, unknown>;
  };
}
