import fs from "node:fs";
import path from "node:path";

import type { WorkflowOrganizationSnapshot } from "../../../shared/organization-schema.js";
import type { SkillRecord } from "../../../shared/skill-contracts.js";
import type {
  MessageRecord,
  WorkflowRecord,
} from "../../../shared/workflow-runtime.js";
import { MCP_LIBRARY } from "../../core/dynamic-organization.js";
import {
  readAgentWorkspaceFile,
  writeAgentWorkspaceFile,
} from "../../core/access-guard.js";
import db from "../../db/index.js";
import {
  reportStore,
  type FinalWorkflowReport,
  type HeartbeatReportSummary,
} from "../../memory/report-store.js";
import {
  sessionStore,
  type MemorySummary,
  type SessionEntry,
} from "../../memory/session-store.js";
import { ensureAgentWorkspace } from "../../memory/workspace.js";
import type { McpToolInvokeRequest, McpToolInvoker } from "./mcp-tool-adapter.js";

type WorkspaceScope = "root" | "sessions" | "memory" | "reports";

export interface InternalMcpWorkflowRepository {
  getWorkflow(id: string): WorkflowRecord | undefined;
  getMessagesByWorkflow(workflowId: string): MessageRecord[];
  getSkills(): SkillRecord[];
}

export interface InternalMcpMemoryRepository {
  getRecentEntries(
    agentId: string,
    workflowId?: string,
    limit?: number,
  ): SessionEntry[];
  searchMemories(agentId: string, query: string, topK?: number): MemorySummary[];
}

export interface InternalMcpReportRepository {
  readFinalWorkflowReport(workflowId: string): FinalWorkflowReport | null;
  getFinalWorkflowReportFilePath(
    workflowId: string,
    format: "json" | "md",
  ): string | null;
  getDepartmentReportFilePath(
    managerId: string,
    workflowId: string,
    format: "json" | "md",
  ): string | null;
  listHeartbeatReports(agentId?: string, limit?: number): HeartbeatReportSummary[];
}

export interface InternalMcpWorkspaceRepository {
  readFile(
    agentId: string,
    relativePath: string,
    scope?: WorkspaceScope,
  ): string | null;
  writeFile(
    agentId: string,
    relativePath: string,
    content: string,
    scope?: WorkspaceScope,
  ): string;
  listReportFiles(agentId: string): Array<{
    name: string;
    relativePath: string;
    sizeBytes: number;
    modifiedAt: string;
  }>;
}

export interface InternalMcpToolInvokerDeps {
  workflowRepo?: InternalMcpWorkflowRepository;
  memoryRepo?: InternalMcpMemoryRepository;
  reportRepo?: InternalMcpReportRepository;
  workspaceRepo?: InternalMcpWorkspaceRepository;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeServerId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Missing required field: serverId");
  }

  const aliases: Record<string, string> = {
    "workspace.memory": "internal.memory",
    "workspace.files": "internal.workspace",
    "workspace.reports": "internal.reports",
    "workflow.registry": "internal.registry",
  };

  return aliases[normalized] ?? normalized;
}

function readString(
  record: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(
  record: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function normalizeWorkspaceScope(value: string | undefined): WorkspaceScope {
  if (
    value === "root" ||
    value === "sessions" ||
    value === "memory" ||
    value === "reports"
  ) {
    return value;
  }

  return "root";
}

function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function buildDefaultWorkspaceRepository(): InternalMcpWorkspaceRepository {
  return {
    readFile(agentId, relativePath, scope = "root") {
      return readAgentWorkspaceFile(agentId, relativePath, scope);
    },
    writeFile(agentId, relativePath, content, scope = "root") {
      return writeAgentWorkspaceFile(agentId, relativePath, content, scope);
    },
    listReportFiles(agentId) {
      const { reportsDir } = ensureAgentWorkspace(agentId);
      if (!fs.existsSync(reportsDir)) {
        return [];
      }

      return fs.readdirSync(reportsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const fullPath = path.join(reportsDir, entry.name);
          const stat = fs.statSync(fullPath);
          return {
            name: entry.name,
            relativePath: path.relative(process.cwd(), fullPath).replace(/\\/g, "/"),
            sizeBytes: stat.size,
            modifiedAt: stat.mtime.toISOString(),
          };
        })
        .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
    },
  };
}

export class InternalMcpToolInvoker implements McpToolInvoker {
  private readonly workflowRepo: InternalMcpWorkflowRepository;
  private readonly memoryRepo: InternalMcpMemoryRepository;
  private readonly reportRepo: InternalMcpReportRepository;
  private readonly workspaceRepo: InternalMcpWorkspaceRepository;

  constructor(deps: InternalMcpToolInvokerDeps = {}) {
    this.workflowRepo = deps.workflowRepo ?? db;
    this.memoryRepo = deps.memoryRepo ?? sessionStore;
    this.reportRepo = deps.reportRepo ?? reportStore;
    this.workspaceRepo = deps.workspaceRepo ?? buildDefaultWorkspaceRepository();
  }

  async invoke(request: McpToolInvokeRequest): Promise<unknown> {
    const serverId = normalizeServerId(request.serverId);

    switch (serverId) {
      case "internal.memory":
        return this.invokeMemoryTool({ ...request, serverId });
      case "internal.reports":
        return this.invokeReportTool({ ...request, serverId });
      case "internal.registry":
        return this.invokeRegistryTool({ ...request, serverId });
      case "internal.workspace":
        return this.invokeWorkspaceTool({ ...request, serverId });
      default:
        throw new Error(`Unsupported MCP server: ${request.serverId}`);
    }
  }

  private invokeMemoryTool(request: McpToolInvokeRequest): unknown {
    switch (request.toolName) {
      case "recent_memory": {
        const agentId = this.requireAgentId(request);
        const limit = normalizePositiveInteger(
          readNumber(request.arguments, "limit"),
          5,
        );
        const entries = this.memoryRepo.getRecentEntries(
          agentId,
          this.resolveWorkflowId(request),
          limit,
        );
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          agentId,
          workflowId: this.resolveWorkflowId(request) ?? null,
          count: entries.length,
          entries,
        };
      }
      case "search_memory": {
        const agentId = this.requireAgentId(request);
        const query =
          readString(request.arguments, "query") || request.input.trim();
        if (!query) {
          throw new Error("search_memory requires query");
        }
        const topK = normalizePositiveInteger(
          readNumber(request.arguments, "topK"),
          5,
        );
        const memories = this.memoryRepo.searchMemories(agentId, query, topK);
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          agentId,
          query,
          count: memories.length,
          memories,
        };
      }
      case "workflow_messages": {
        const workflowId = this.requireWorkflowId(request);
        const limit = normalizePositiveInteger(
          readNumber(request.arguments, "limit"),
          20,
        );
        const messages = this.workflowRepo
          .getMessagesByWorkflow(workflowId)
          .slice(-limit);
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          workflowId,
          count: messages.length,
          messages,
        };
      }
      default:
        throw new Error(
          `Unsupported MCP tool: ${request.serverId}/${request.toolName}`,
        );
    }
  }

  private invokeReportTool(request: McpToolInvokeRequest): unknown {
    switch (request.toolName) {
      case "department_reports": {
        const workflowId = this.requireWorkflowId(request);
        const workflow = this.getWorkflow(workflowId);
        const departmentReports = Array.isArray(workflow.results?.department_reports)
          ? workflow.results.department_reports
          : [];
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          workflowId,
          count: departmentReports.length,
          departmentReports,
        };
      }
      case "final_report": {
        const workflowId = this.requireWorkflowId(request);
        const report = this.reportRepo.readFinalWorkflowReport(workflowId);
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          workflowId,
          available: Boolean(report),
          report,
        };
      }
      case "download_report": {
        const format =
          readString(request.arguments, "format") === "md" ? "md" : "json";
        const scope = readString(request.arguments, "scope") || "final";

        if (scope === "department") {
          const workflowId = this.requireWorkflowId(request);
          const managerId = readString(request.arguments, "managerId");
          if (!managerId) {
            throw new Error("download_report requires managerId when scope=department");
          }
          const filePath = this.reportRepo.getDepartmentReportFilePath(
            managerId,
            workflowId,
            format,
          );
          return {
            ok: true,
            serverId: request.serverId,
            toolName: request.toolName,
            scope,
            managerId,
            workflowId,
            available: Boolean(filePath),
            filePath,
            content: filePath ? readTextFile(filePath) : null,
          };
        }

        if (scope === "heartbeat") {
          const agentId = this.requireAgentId(request);
          const reportId = readString(request.arguments, "reportId");
          if (!reportId) {
            const reports = this.reportRepo.listHeartbeatReports(agentId, 20);
            return {
              ok: true,
              serverId: request.serverId,
              toolName: request.toolName,
              scope,
              agentId,
              count: reports.length,
              reports,
            };
          }

          const { reportsDir } = ensureAgentWorkspace(agentId);
          const filePath = path.join(
            reportsDir,
            `${reportId}__heartbeat-report.${format}`,
          );
          return {
            ok: true,
            serverId: request.serverId,
            toolName: request.toolName,
            scope,
            agentId,
            reportId,
            available: fs.existsSync(filePath),
            filePath: fs.existsSync(filePath)
              ? path.relative(process.cwd(), filePath).replace(/\\/g, "/")
              : null,
            content: fs.existsSync(filePath) ? readTextFile(filePath) : null,
          };
        }

        const workflowId = this.requireWorkflowId(request);
        const filePath = this.reportRepo.getFinalWorkflowReportFilePath(
          workflowId,
          format,
        );
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          scope: "final",
          workflowId,
          available: Boolean(filePath),
          filePath,
          content: filePath ? readTextFile(filePath) : null,
        };
      }
      default:
        throw new Error(
          `Unsupported MCP tool: ${request.serverId}/${request.toolName}`,
        );
    }
  }

  private invokeRegistryTool(request: McpToolInvokeRequest): unknown {
    switch (request.toolName) {
      case "organization_snapshot": {
        const workflowId = this.requireWorkflowId(request);
        const workflow = this.getWorkflow(workflowId);
        const organization =
          workflow.results?.organization as WorkflowOrganizationSnapshot | undefined;
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          workflowId,
          available: Boolean(organization),
          organization,
        };
      }
      case "skills_manifest": {
        const enabledOnly = readString(request.arguments, "enabledOnly") !== "false";
        const skills = this.workflowRepo
          .getSkills()
          .filter((skill) => (enabledOnly ? skill.enabled : true))
          .sort((left, right) =>
            left.id.localeCompare(right.id) || left.version.localeCompare(right.version),
          );
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          count: skills.length,
          skills: skills.map((skill) => ({
            id: skill.id,
            version: skill.version,
            name: skill.name,
            category: skill.category,
            enabled: skill.enabled,
            requiredMcp: skill.requiredMcp,
            tags: skill.tags,
          })),
        };
      }
      case "mcp_manifest": {
        const workflowId = this.resolveWorkflowId(request);
        const workflow = workflowId
          ? this.workflowRepo.getWorkflow(workflowId)
          : undefined;
        const organization =
          workflow?.results?.organization as WorkflowOrganizationSnapshot | undefined;
        const bindings = organization
          ? this.collectWorkflowMcpBindings(organization)
          : Object.values(MCP_LIBRARY).map((entry) => ({
              id: entry.id,
              name: entry.name,
              server: entry.server,
              description: entry.description,
              connection: entry.connection,
              tools: [...entry.tools],
            }));
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          workflowId: workflowId ?? null,
          count: bindings.length,
          bindings,
        };
      }
      default:
        throw new Error(
          `Unsupported MCP tool: ${request.serverId}/${request.toolName}`,
        );
    }
  }

  private invokeWorkspaceTool(request: McpToolInvokeRequest): unknown {
    const agentId = this.requireAgentId(request);

    switch (request.toolName) {
      case "list_reports": {
        const files = this.workspaceRepo.listReportFiles(agentId);
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          agentId,
          count: files.length,
          files,
        };
      }
      case "read_file": {
        const relativePath = readString(request.arguments, "path");
        if (!relativePath) {
          throw new Error("read_file requires path");
        }
        const scope = normalizeWorkspaceScope(readString(request.arguments, "scope"));
        const content = this.workspaceRepo.readFile(agentId, relativePath, scope);
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          agentId,
          scope,
          relativePath,
          exists: content !== null,
          content,
        };
      }
      case "write_file": {
        const relativePath = readString(request.arguments, "path");
        if (!relativePath) {
          throw new Error("write_file requires path");
        }
        const scope = normalizeWorkspaceScope(readString(request.arguments, "scope"));
        const content =
          readString(request.arguments, "content") ?? request.input;
        const writtenPath = this.workspaceRepo.writeFile(
          agentId,
          relativePath,
          content,
          scope,
        );
        return {
          ok: true,
          serverId: request.serverId,
          toolName: request.toolName,
          agentId,
          scope,
          relativePath,
          writtenPath,
        };
      }
      default:
        throw new Error(
          `Unsupported MCP tool: ${request.serverId}/${request.toolName}`,
        );
    }
  }

  private getWorkflow(workflowId: string): WorkflowRecord {
    const workflow = this.workflowRepo.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    return workflow;
  }

  private requireAgentId(request: McpToolInvokeRequest): string {
    const agentId =
      request.agentId ||
      (isRecord(request.metadata)
        ? readString(request.metadata, "agentId")
        : undefined) ||
      readString(request.arguments, "agentId");

    if (!agentId) {
      throw new Error("Missing required field: agentId");
    }

    return agentId;
  }

  private resolveWorkflowId(request: McpToolInvokeRequest): string | undefined {
    return (
      request.workflowId ||
      (isRecord(request.metadata)
        ? readString(request.metadata, "workflowId")
        : undefined) ||
      readString(request.arguments, "workflowId")
    );
  }

  private requireWorkflowId(request: McpToolInvokeRequest): string {
    const workflowId = this.resolveWorkflowId(request);
    if (!workflowId) {
      throw new Error("Missing required field: workflowId");
    }

    return workflowId;
  }

  private collectWorkflowMcpBindings(
    organization: WorkflowOrganizationSnapshot,
  ): Array<WorkflowOrganizationSnapshot["nodes"][number]["mcp"][number]> {
    const unique = new Map<
      string,
      WorkflowOrganizationSnapshot["nodes"][number]["mcp"][number]
    >();

    for (const node of organization.nodes) {
      for (const binding of node.mcp ?? []) {
        if (!unique.has(binding.id)) {
          unique.set(binding.id, binding);
        }
      }
    }

    return Array.from(unique.values());
  }
}
