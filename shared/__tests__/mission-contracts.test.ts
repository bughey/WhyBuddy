import { describe, expect, it } from "vitest";

import {
  normalizeWebAigcHitlFormData,
  readWebAigcHitlFieldDefinitions,
} from "../mission/contracts.js";

describe("mission contracts param_collection helpers", () => {
  it("reads field definitions from payload.fields", () => {
    const fields = readWebAigcHitlFieldDefinitions({
      fields: [
        {
          key: "region",
          label: "Region",
          type: "selection",
          required: true,
          options: [
            { value: "cn", label: "China" },
            { value: "us", label: "United States" },
          ],
        },
        {
          key: "priority",
          label: "Priority",
          type: "number",
          defaultValue: 3,
        },
      ],
    });

    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({
      key: "region",
      type: "selection",
      required: true,
    });
    expect(fields[1]).toMatchObject({
      key: "priority",
      type: "number",
      defaultValue: 3,
    });
  });

  it("normalizes param_collection form data with defaults and typed coercion", () => {
    const fields = readWebAigcHitlFieldDefinitions({
      fields: [
        {
          key: "region",
          label: "Region",
          type: "selection",
          required: true,
          options: [
            { value: "cn", label: "China" },
            { value: "us", label: "United States" },
          ],
        },
        {
          key: "priority",
          label: "Priority",
          type: "number",
          defaultValue: 3,
        },
        {
          key: "approved",
          label: "Approved",
          type: "boolean",
        },
      ],
    });

    const normalized = normalizeWebAigcHitlFormData(fields, {
      region: "cn",
      priority: "5",
      approved: "true",
    });

    expect(normalized.errors).toEqual([]);
    expect(normalized.value).toEqual({
      region: "cn",
      priority: 5,
      approved: true,
    });
  });

  it("returns field-level errors when required or selection validation fails", () => {
    const fields = readWebAigcHitlFieldDefinitions({
      fields: [
        {
          key: "region",
          label: "Region",
          type: "selection",
          required: true,
          options: [{ value: "cn", label: "China" }],
        },
      ],
    });

    const missing = normalizeWebAigcHitlFormData(fields, {});
    expect(missing.errors).toContain("字段“Region”为必填项");

    const invalid = normalizeWebAigcHitlFormData(fields, {
      region: "eu",
    });
    expect(invalid.errors).toContain("字段“Region”的选项不合法");
  });
});
