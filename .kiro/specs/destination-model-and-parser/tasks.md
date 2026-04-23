# 任务清单：Destination 模型与解析器

- [ ] 定义 `Destination` 领域模型
  - 明确 `normalizedGoal`、`subGoals`、`constraints`、`successCriteria`、`missingInformation`、`taskType`、`confidence`、`assumptions` 等字段结构
  - 明确字段来源、置信度和版本信息的表达方式

- [ ] 定义输入归档层
  - 支持对话输入、mission 表单输入、workflow 启动输入、API 输入四类来源
  - 统一记录原始文本、附件引用和提交来源

- [ ] 实现目标与子目标解析策略
  - 先建立规则抽取框架
  - 再补充模型推断接口和低置信度回退策略

- [ ] 实现约束抽取策略
  - 覆盖时间、预算、权限、输出格式、风格、数据范围、工具限制
  - 区分显式约束、推断约束和默认约束

- [ ] 实现成功标准识别策略
  - 支持显式成功标准抽取
  - 支持按任务类型补充默认成功标准
  - 支持无法确定时进入缺失信息列表

- [ ] 实现缺失信息识别与澄清建议生成
  - 区分阻塞型缺口与可边执行边澄清缺口
  - 为每项缺口生成可复用的澄清问题

- [ ] 实现任务类型识别
  - 支持主任务类型识别
  - 支持辅助任务类型识别
  - 支持 `mixed` / `unknown` 回退路径

- [ ] 设计 `Destination -> mission` 投影层
  - 明确 mission 标题、摘要、metadata、review 输入的映射规则
  - 确保映射不丢失关键约束和成功标准

- [ ] 设计 `Destination -> workflow` 投影层
  - 明确 workflow 顶层 goal、planner 输入、runtime governance、clarify 输入的映射规则
  - 确保当前主仓 workflow payload 可以兼容消费

- [ ] 设计解析证据与审计结构
  - 保留来源文本片段、规则命中、模型推断摘要、置信度说明
  - 让 replay / audit 能重建任务理解过程

- [ ] 设计 `Destination` 增量更新机制
  - 支持澄清后更新版本
  - 支持合并新附件、新约束、新成功标准
  - 支持驱动 route planner 重规划

- [ ] 设计失败与降级策略
  - 当解析失败时允许退回原始 mission / workflow 启动模式
  - 保留失败原因和未解析字段，避免静默降级

- [ ] 补齐单元测试与契约测试
  - 覆盖单目标、多子目标、复合任务、缺失信息、低置信度分类等场景
  - 覆盖 mission/workflow 投影兼容场景

- [ ] 输出开发联调样例
  - 提供典型用户输入到 `Destination` 的样例
  - 提供 `Destination` 到 mission/workflow 的投影样例
