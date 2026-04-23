# 任务清单：静态网页读取节点

- [x] 定义网页读取输入输出
  - 已新增 `shared/static-webpage-read.ts`，统一 `static_webpage_read` 的请求、输出、回退状态与下游交接契约。
  - 输出同时包含 `page`、`handoff.webQaPage`、`handoff.webSearchResult`，便于衔接 `web_qa / web_search` 链路。
- [x] 设计正文提取逻辑
  - 当前采用轻量 HTML 清洗方案，剔除 `script / style / noscript`，提取 `title`、正文文本与链接列表。
  - 在不新增重型依赖的前提下，支持最小可用的正文截断、摘要生成与链接采样。
- [x] 验证抓取失败回退
  - 适配器支持注入 `fetchHtml`；当远端抓取失败时，会在 `fallback.enabled=true` 下输出静态摘要回退结果。
  - 已覆盖抓取失败后的 `warnings`、`status=fallback`、下游交接对象保底输出。
- [x] 与网页问答链路联调
  - 已新增节点测试与路由测试，验证 `static_webpage_read` 的最小闭环。
  - 已在测试中直接将 `handoff.webQaPage` 交给 `executeWebQaNode`，确认与 `web_qa` 的页面输入兼容。
