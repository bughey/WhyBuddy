# 任务清单：Drive State 与 Replan 状态机

- [ ] 梳理当前主仓中 Mission Runtime、workflow instance、node run、review / audit / verify 的状态来源，形成底层状态清单
- [ ] 明确十个高层 `Drive State` 的最终定义、边界与命名口径
- [ ] 输出 `Drive State` 与现有 workflow / runtime state 的归并映射表
- [ ] 输出 `Drive State` 主链路迁移图，覆盖 understanding 到 delivered 的标准推进路径
- [ ] 输出澄清链路迁移图，明确 `clarifying` 与 `takeover-required` 的关系
- [ ] 输出阻塞链路迁移图，明确 `blocked` 的进入条件与退出路径
- [ ] 输出重规划链路迁移图，明确 `replanning` 的触发条件、恢复路径与与 `retry` 的区别
- [ ] 梳理当前系统中可触发 `replanning` 的真实信号来源，包括 review 失败、依赖失效、约束变更、人工改线等
- [ ] 定义高层状态切换所需的最小事件字段，用于 replay / audit 重建状态时间线
- [ ] 评估哪些状态可以先由前端 view model 推导，哪些更适合在服务端 projection 层生成
- [ ] 评估 `Drive State` 接入 mission-first 任务详情页的最小实现方案
- [ ] 评估 `Drive State` 接入驾驶舱主视图的最小实现方案
- [ ] 评估 `Drive State` 接入 replay / audit 时间线的最小实现方案
- [ ] 明确 `takeover-required` 与现有 HITL / decision / approval / resume 链路的映射方式
- [ ] 梳理当前代码和文档中对旧状态命名的依赖，形成“兼容优先、不立即改名”的风险说明
