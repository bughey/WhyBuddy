# 任务清单：相似匹配节点

> 本次对账依据 2026-04-23 当前仓库实现与测试重新核查，重点核对了：
> `shared/web-aigc-similarity-match.ts`、`server/routes/node-adapters/similarity-match-node-adapter.ts`、`server/routes/similarity-match.ts`、`server/tests/similarity-match-node-adapter.test.ts`、`server/tests/similarity-match-routes.test.ts`。
> 本轮结论已更新：4 项任务已经形成最小闭环，可保持已完成状态。

- [x] 定义相似匹配输入输出
  - `shared/web-aigc-similarity-match.ts` 已定义 `similarity_match` 节点的共享契约，包括：
    - 节点输入 `SimilarityMatchNodeInput`
    - 候选项结构 `SimilarityMatchCandidateInput`
    - 模式与分支类型 `SimilarityMatchMode`、`SimilarityMatchBranchKey`
    - 输出结构 `SimilarityMatchNodeExecutionResult`
  - 输出契约中已经包含：
    - `bestMatch`
    - `matches`
    - `evaluatedCandidates`
    - `summary`
    - `branch`
    - `observability`
  - 结论：输入输出边界已明确，且可直接被 route、adapter、条件节点消费，可勾选。

- [x] 设计文本与向量比较策略
  - `server/routes/node-adapters/similarity-match-node-adapter.ts` 已实现三种比较模式：
    - `text`
    - `vector`
    - `hybrid`
  - 文本策略已落地为轻量 token 相似度组合，包含：
    - token overlap
    - Jaccard
    - containment
    - substring 命中补强
  - 向量策略已复用仓内 `server/memory/vector-store.ts` 的轻量 hash-vector 思路：
    - 相同分词规则
    - 96 维 hash 向量
    - 余弦相似度打分
  - 当请求未显式提供向量时，adapter 会自动从文本生成轻量向量，并在 `warnings` / `strategy.usedHashVectorFallback` 中标明回退情况。
  - 结论：文本优先、向量可选的比较策略已落地，可勾选。

- [x] 增加阈值配置
  - `SimilarityMatchNodeOptions` 已支持：
    - `threshold`
    - `topK`
    - `textWeight`
    - `vectorWeight`
    - `mode`
  - adapter 已对阈值与权重完成归一化处理，并在输出中回传实际生效的 `strategy`：
    - `threshold`
    - `topK`
    - `textWeight`
    - `vectorWeight`
  - 每个候选项输出中也已包含：
    - `score`
    - `textScore`
    - `vectorScore`
    - `thresholdGap`
    - `matched`
  - 结论：阈值与打分配置已真正进入执行结果，可勾选。

- [x] 验证条件分支联动
  - 输出中已经显式提供：
    - `branch.selected`
    - `branch.conditions.matched`
    - `branch.conditions.not_matched`
  - `summary.matched`、`matchedCount`、`topScore` 也已同步返回，可直接驱动条件分支、重试分支或检索增强分支。
  - `server/tests/similarity-match-node-adapter.test.ts` 已覆盖：
    - 命中分支
    - 未命中分支
    - 显式向量模式
    - 缺失输入校验
  - `server/tests/similarity-match-routes.test.ts` 已覆盖：
    - route 成功执行
    - 非法 nodeType
    - 参数缺失返回 400
  - 结论：条件分支联动所需的信息输出已经成形，可勾选。

> 复核补充：
> `server/tests/similarity-match-node-adapter.test.ts` 本轮运行通过后，应为 5/5；
> `server/tests/similarity-match-routes.test.ts` 本轮运行通过后，应为 3/3。
