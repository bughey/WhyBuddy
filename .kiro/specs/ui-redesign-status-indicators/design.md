# 设计文档：状态指示器卡片

## 概述

在 spec 2 的 AppSidebar 底部新增两个紧凑状态卡片：Autopilot Control（驾驶状态）和 Mission Control（运行模式），提供全局运行态感知。

## 组件与接口

### SidebarStatusBlock（新建 `client/src/components/SidebarStatusBlock.tsx`）

```typescript
interface SidebarStatusBlockProps {
  collapsed: boolean;
  locale: string;
}
```

内部从 `tasks-store` 和 `useAppStore` 读取数据：

```typescript
const driveState = useTasksStore(state => {
  const id = state.selectedTaskId;
  if (!id) return 'idle';
  const detail = state.detailsById[id];
  return detail?.autopilotSummary?.driveState ?? detail?.status ?? 'idle';
});
const runtimeMode = useAppStore(state => state.runtimeMode);
```

### 状态到视觉映射

| driveState | 圆点颜色 | 标签 (zh) | 标签 (en) |
|------------|----------|-----------|-----------|
| running / executing | 绿色脉冲 | 自主执行中 | Running |
| planning | 琥珀色 | 规划中 | Planning |
| waiting / blocked | 琥珀色 | 等待接管 | Waiting |
| failed | 红色 | 异常 | Error |
| delivered / done | 灰色 | 已完成 | Done |
| idle（无选中任务） | 灰色 | 待命中 | Standby |

### 渲染结构

展开模式：
```tsx
<div className="mx-3 mb-2 space-y-1.5">
  {/* Autopilot Control */}
  <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px]"
       style={{ borderColor: 'var(--sidebar-border)', backgroundColor: 'var(--sidebar-accent)' }}>
    <span className={cn("h-2 w-2 shrink-0 rounded-full", dotClass)} />
    <div className="min-w-0">
      <div className="font-semibold text-[var(--sidebar-foreground)]">Autopilot Control</div>
      <div className="text-[var(--sidebar-foreground)]/60 truncate">{statusLabel}</div>
    </div>
  </div>

  {/* Mission Control */}
  <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px]"
       style={{ borderColor: 'var(--sidebar-border)', backgroundColor: 'var(--sidebar-accent)' }}>
    <Monitor size={14} className="shrink-0 text-[var(--sidebar-foreground)]/60" />
    <div className="min-w-0">
      <div className="font-semibold text-[var(--sidebar-foreground)]">Mission Control</div>
      <div className="text-[var(--sidebar-foreground)]/60 truncate">{modeLabel}</div>
    </div>
  </div>
</div>
```

折叠模式：仅显示状态圆点和模式图标，hover 显示 Tooltip。

## 正确性属性

### Property 1: 状态映射完整性
对于任意 driveState 值（包括 undefined/null），`dotClass` 和 `statusLabel` 应返回非空值。

### Property 2: 折叠模式隐藏文字
当 `collapsed === true` 时，文字标签不应出现在渲染输出中。

## 测试策略

- 单元测试：driveState 到圆点颜色和标签的映射覆盖所有已知状态
- 组件测试：collapsed=true 时仅渲染图标，collapsed=false 时渲染完整卡片
- 组件测试：无选中任务时展示"待命中"
