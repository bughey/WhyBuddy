import type { WebQaInlinePageInput } from "./web-qa/contracts.js";
import type { WebSearchResultItem } from "./web-search.js";

export const STATIC_WEBPAGE_READ_API = {
  EXECUTE: "POST /api/static-webpage-read/nodes/execute",
} as const;

export const STATIC_WEBPAGE_READ_NODE_TYPES = [
  "static_webpage_read",
] as const;

export type StaticWebpageReadNodeType =
  (typeof STATIC_WEBPAGE_READ_NODE_TYPES)[number];

export type StaticWebpageReadStatus = "completed" | "fallback";

export interface StaticWebpageReadLink {
  href: string;
  label: string;
}

export interface StaticWebpageReadNodeInput {
  url?: string;
  html?: string;
  titleHint?: string;
  extraction?: {
    maxChars?: number;
    includeLinks?: boolean;
  };
  fallback?: {
    enabled?: boolean;
    title?: string;
    content?: string;
    snippet?: string;
  };
  context?: Record<string, unknown>;
}

export interface StaticWebpageReadNodeExecutionRequest {
  nodeType: StaticWebpageReadNodeType;
  input?: StaticWebpageReadNodeInput;
}

export interface StaticWebpageReadPagePayload {
  title: string;
  url?: string;
  content: string;
  snippet: string;
  links: StaticWebpageReadLink[];
  contentSource: "inline_html" | "fetched_html" | "fallback";
  fetched: boolean;
}

export interface StaticWebpageReadHandoffPayload {
  webQaPage: WebQaInlinePageInput;
  webSearchResult: WebSearchResultItem;
}

export interface StaticWebpageReadNodeExecutionResult {
  ok: true;
  nodeType: StaticWebpageReadNodeType;
  output: {
    status: StaticWebpageReadStatus;
    page: StaticWebpageReadPagePayload;
    handoff: StaticWebpageReadHandoffPayload;
    context: Record<string, unknown>;
    warnings: string[];
    observability: {
      eventKey: "external.static_webpage_read";
      nodeType: StaticWebpageReadNodeType;
      contentSource: StaticWebpageReadPagePayload["contentSource"];
      fetched: boolean;
      linkCount: number;
      contentLength: number;
      fallbackUsed: boolean;
    };
  };
}
