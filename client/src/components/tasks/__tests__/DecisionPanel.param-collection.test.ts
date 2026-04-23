import { describe, expect, it } from "vitest";

import type { MissionDecision } from "@shared/mission/contracts";

import { buildParamCollectionSubmission } from "../DecisionPanel";

function makeParamCollectionDecision(): MissionDecision {
  return {
    prompt: "请补充参数",
    type: "request-info",
    options: [{ id: "submit", label: "提交" }],
    payload: {
      nodeType: "param_collection",
      nodeId: "node-param-1",
      sessionId: "session-param-1",
      interactionId: "interaction-param-1",
      branchKey: "branch-param-1",
      fieldDefinitions: [
        {
          key: "title",
          label: "标题",
          type: "text",
          required: true,
        },
        {
          key: "count",
          label: "数量",
          type: "number",
          defaultValue: 2,
        },
        {
          key: "approved",
          label: "是否通过",
          type: "boolean",
        },
        {
          key: "region",
          label: "区域",
          type: "selection",
          options: [
            { value: "cn", label: "中国区" },
            { value: "global", label: "全球" },
          ],
        },
        {
          key: "attachment",
          label: "附件",
          type: "attachment",
        },
      ],
    },
  };
}

describe("buildParamCollectionSubmission", () => {
  it("builds metadata.formData with normalized values", () => {
    const result = buildParamCollectionSubmission(makeParamCollectionDecision(), {
      title: "上线任务",
      count: "5" as unknown as number,
      approved: true,
      region: "cn",
      attachment: {
        kind: "attachment",
        ref: "artifact-123",
        name: "需求说明.pdf",
        url: "https://files.example.test/spec.pdf",
        source: "manual",
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.fieldErrors).toEqual({});
    expect(result.metadata).toEqual({
      nodeType: "param_collection",
      nodeId: "node-param-1",
      sessionId: "session-param-1",
      interactionId: "interaction-param-1",
      branchKey: "branch-param-1",
      formData: {
        title: "上线任务",
        count: 5,
        approved: true,
        region: "cn",
        attachment: {
          kind: "attachment",
          ref: "artifact-123",
          name: "需求说明.pdf",
          url: "https://files.example.test/spec.pdf",
          source: "manual",
        },
      },
    });
  });

  it("accepts attachment references as the minimal attachment payload", () => {
    const result = buildParamCollectionSubmission(makeParamCollectionDecision(), {
      title: "附件引用任务",
      attachment: "artifact-ref-1" as unknown as never,
    });

    expect(result.error).toBeUndefined();
    expect(result.fieldErrors).toEqual({});
    expect(result.metadata?.formData.attachment).toEqual({
      kind: "attachment",
      ref: "artifact-ref-1",
    });
    expect(result.metadata?.nodeId).toBe("node-param-1");
    expect(result.metadata?.sessionId).toBe("session-param-1");
  });

  it("returns field-level errors for invalid required and typed values", () => {
    const result = buildParamCollectionSubmission(makeParamCollectionDecision(), {
      title: "",
      count: "abc" as unknown as number,
      region: "mars",
      attachment: {} as unknown as never,
    });

    expect(result.metadata).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(result.fieldErrors.title).toContain("必填");
    expect(result.fieldErrors.count).toContain("数字");
    expect(result.fieldErrors.region).toContain("选项不合法");
    expect(result.fieldErrors.attachment).toContain("附件");
  });
});
