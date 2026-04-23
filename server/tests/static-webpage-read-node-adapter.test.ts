import { describe, expect, it } from "vitest";

import { executeStaticWebpageReadNode } from "../routes/node-adapters/static-webpage-read-node-adapter.js";
import { executeWebQaNode } from "../routes/node-adapters/web-qa-node-adapter.js";

describe("executeStaticWebpageReadNode", () => {
  it("extracts title, body, links, and downstream handoff payloads from inline html", async () => {
    const result = await executeStaticWebpageReadNode({
      nodeType: "static_webpage_read",
      input: {
        url: "https://example.test/runbook/payment",
        html: `
          <html>
            <head>
              <title>支付排障手册</title>
            </head>
            <body>
              <article>
                <h1>支付排障手册</h1>
                <p>先检查支付状态，再核对回调与履约日志。</p>
                <p>如果仍异常，查看下游消费记录与告警面板。</p>
                <a href="https://example.test/dashboard/payment">支付告警面板</a>
              </article>
            </body>
          </html>
        `,
        context: {
          workflowId: "wf-static-read-1",
        },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      nodeType: "static_webpage_read",
      output: {
        status: "completed",
        page: {
          title: "支付排障手册",
          url: "https://example.test/runbook/payment",
          contentSource: "inline_html",
          fetched: false,
        },
        handoff: {
          webQaPage: {
            title: "支付排障手册",
            href: "https://example.test/runbook/payment",
          },
          webSearchResult: {
            title: "支付排障手册",
            url: "https://example.test/runbook/payment",
            source: "static_webpage_read",
          },
        },
        context: {
          workflowId: "wf-static-read-1",
        },
        observability: {
          eventKey: "external.static_webpage_read",
          nodeType: "static_webpage_read",
          contentSource: "inline_html",
          fetched: false,
          fallbackUsed: false,
        },
      },
    });
    expect(result.output.page.content).toContain("先检查支付状态");
    expect(result.output.page.links).toEqual([
      {
        href: "https://example.test/dashboard/payment",
        label: "支付告警面板",
      },
    ]);
    expect(result.output.handoff.webQaPage.summary).toContain("先检查支付状态");
    expect(result.output.handoff.webSearchResult.snippet).toContain("先检查支付状态");
  });

  it("falls back to summary payload when fetching fails", async () => {
    const result = await executeStaticWebpageReadNode(
      {
        nodeType: "static_webpage_read",
        input: {
          url: "https://example.test/unavailable",
          fallback: {
            enabled: true,
            title: "支付站点暂不可用",
            content: "抓取失败时回退为站点不可用摘要，请交由 web_qa 或知识兜底继续处理。",
            snippet: "站点不可用，已切换到摘要模式。",
          },
        },
      },
      {
        fetchHtml: async () => {
          throw new Error("upstream 503");
        },
      },
    );

    expect(result.output.status).toBe("fallback");
    expect(result.output.page).toMatchObject({
      title: "支付站点暂不可用",
      url: "https://example.test/unavailable",
      contentSource: "fallback",
      fetched: false,
      snippet: "站点不可用，已切换到摘要模式。",
    });
    expect(result.output.warnings).toContain(
      "网页抓取失败，已回退到静态摘要输出：upstream 503",
    );
    expect(result.output.handoff.webQaPage.summary).toBe(
      "站点不可用，已切换到摘要模式。",
    );
    expect(result.output.handoff.webSearchResult.source).toBe("static_webpage_read");
    expect(result.output.observability.fallbackUsed).toBe(true);
  });

  it("produces a web_qa-compatible page handoff that can answer downstream", async () => {
    const staticRead = await executeStaticWebpageReadNode({
      nodeType: "static_webpage_read",
      input: {
        url: "https://example.test/refund-policy",
        html: `
          <html>
            <head><title>退款规则说明</title></head>
            <body>
              <main>
                <p>退款申请提交后，需要先核对支付状态与订单履约状态。</p>
                <p>若订单已发货，需走人工审批流程并补充备注。</p>
              </main>
            </body>
          </html>
        `,
      },
    });

    const webQaResult = await executeWebQaNode(
      {
        nodeType: "web_qa",
        input: {
          question: "退款申请要先检查什么？",
          pages: [staticRead.output.handoff.webQaPage],
        },
      },
      {
        executeLLM: async (messages) => ({
          content: `基于静态网页读取回答：${messages[messages.length - 1]?.content}`,
          usage: {
            prompt_tokens: 18,
            completion_tokens: 10,
            total_tokens: 28,
          },
        }),
        getConfig: () => ({
          apiKey: "",
          baseUrl: "https://example.test/v1",
          model: "mock-model",
          modelReasoningEffort: "medium",
          maxContext: 128000,
          providerName: "example.test",
          wireApi: "chat_completions",
          timeoutMs: 1000,
          stream: false,
        }),
        now: (() => {
          let current = 100;
          return () => {
            current += 10;
            return current;
          };
        })(),
      },
    );

    expect(webQaResult.ok).toBe(true);
    expect(webQaResult.output.status).toBe("completed");
    expect(webQaResult.output.strategy).toBe("inline_pages");
    expect(webQaResult.output.citations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("退款规则说明"),
      ]),
    );
    expect(webQaResult.output.sourceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "page",
          label: "退款规则说明",
          href: "https://example.test/refund-policy",
        }),
      ]),
    );
  });

  it("rejects requests that provide neither url nor html", async () => {
    await expect(
      executeStaticWebpageReadNode({
        nodeType: "static_webpage_read",
        input: {},
      }),
    ).rejects.toThrow(/requires url or html/i);
  });
});
