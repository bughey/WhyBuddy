# 需求文档

## 简介

本规格是 UI 改造项目（共 8 个 spec）的第 1 个，聚焦色板与设计令牌层的全面替换。当前 `client/src/index.css` 中的 CSS 变量体系以暖色调毛玻璃拟态（warm-toned glass morphism）为基底，色相集中在 oklch hue 60–80（琥珀/米色），studio / workspace 系列变量大量使用 `#4a3727`、`rgba(88,61,39,…)` 等棕色调。目标是将整套色板迁移到以干净白色背景、冷灰卡片、绿色主强调色、红色状态指示色为核心的专业 SaaS 视觉语言，同时保留暗色模式结构预留，并确保所有 shadcn/ui 组件、glass-panel 工具类、studio-shell / workspace 主题变量以及 LoadingScreen、Toolbar 等关键组件均能正确继承新令牌。

## 术语表

- **Design_Token_System**：定义在 `:root` 中的 CSS 自定义属性集合，通过 `@theme inline` 桥接到 Tailwind，供所有组件消费
- **Glass_Panel_Utility**：`.glass-panel`、`.glass-panel-strong`、`.glass-3d` 等 CSS 工具类，提供毛玻璃背景、边框与阴影效果
- **Studio_Shell_Theme**：`.studio-shell`、`.studio-surface`、`.studio-input`、`.studio-badge` 等工作流面板主题类
- **Workspace_Theme**：`.workspace-page`、`.workspace-shell`、`.workspace-panel`、`.workspace-control` 等工作台页面主题类
- **ShadcnUI_Component**：通过 `components.json` 配置、消费 `--primary`、`--card`、`--border` 等令牌的 shadcn/ui 组件库
- **LoadingScreen**：应用启动加载页组件，当前使用独立硬编码色值
- **Toolbar**：顶部导航栏组件
- **OKLCH**：CSS Color Level 4 色彩空间，当前令牌已采用此格式

## 需求

### 需求 1：核心设计令牌色板替换

**用户故事：** 作为前端开发者，我希望 `:root` 中的核心设计令牌从暖色调切换到冷灰 SaaS 色板，以便所有消费这些令牌的组件自动获得新的视觉风格。

#### 验收标准

1. THE Design_Token_System SHALL 将 `--background` 从当前暖色 `oklch(0.97 0.01 80)` 替换为接近纯白的冷色值（hue 偏向 240–260 或 achromatic，chroma ≤ 0.005）
2. THE Design_Token_System SHALL 将 `--foreground`、`--card-foreground`、`--popover-foreground` 从暖棕色调（hue 60）替换为冷灰色调（hue 偏向 240–260 或 achromatic）
3. THE Design_Token_System SHALL 将 `--card`、`--popover` 从暖白 `oklch(0.99 0.005 80)` 替换为中性白或极浅冷灰（chroma ≤ 0.003）
4. THE Design_Token_System SHALL 保留 `--primary` 的绿色色相（hue 约 160），但将 chroma 和 lightness 微调以降低暖感（chroma 保持 0.06–0.10，lightness 保持 0.40–0.50）
5. THE Design_Token_System SHALL 将 `--secondary`、`--muted`、`--accent` 从暖灰（hue 80）替换为冷灰（hue 240–260 或 achromatic，chroma ≤ 0.005）
6. THE Design_Token_System SHALL 将 `--destructive` 保留为红色系，同时新增一个 `--status-indicator` 或复用 `--destructive` 作为红色状态指示色
7. THE Design_Token_System SHALL 将 `--border`、`--input`、`--sidebar-border` 从暖灰替换为冷灰边框色
8. THE Design_Token_System SHALL 将所有 sidebar 系列令牌（`--sidebar`、`--sidebar-foreground`、`--sidebar-accent` 等）同步更新为冷灰色板
9. THE Design_Token_System SHALL 将 chart 系列令牌（`--chart-1` 至 `--chart-5`）更新为与新冷色板协调的配色方案
10. WHILE 暗色模式结构存在时，THE Design_Token_System SHALL 在 `.dark` 选择器下保留对应的暗色令牌占位声明，即使当前不主动使用

### 需求 2：Glass-Panel 工具类冷色化

**用户故事：** 作为前端开发者，我希望 glass-panel 系列工具类的背景渐变、边框和阴影从暖棕色调切换到冷灰色调，以便毛玻璃面板与新色板一致。

#### 验收标准

1. THE Glass_Panel_Utility SHALL 将 `.glass-panel` 的背景渐变从 `rgba(255,250,245,…)` / `rgba(244,235,224,…)` 替换为冷白渐变（基于 `rgba(248,250,252,…)` 或类似冷色基底）
2. THE Glass_Panel_Utility SHALL 将 `.glass-panel` 和 `.glass-panel-strong` 的 `box-shadow` 中的暖棕阴影色 `rgba(84,59,37,…)` 替换为冷灰阴影色（如 `rgba(15,23,42,…)` 或 `rgba(100,116,139,…)`）
3. THE Glass_Panel_Utility SHALL 将 `--glass-bg`、`--glass-bg-hover`、`--glass-bg-active`、`--glass-border`、`--glass-border-hover` 变量更新为中性白/冷灰值
4. THE Glass_Panel_Utility SHALL 保持 `backdrop-filter: blur(…)` 的模糊强度不变，仅调整色彩

### 需求 3：Studio-Shell 与 Workspace 主题变量冷色化

**用户故事：** 作为前端开发者，我希望 studio-shell 和 workspace 系列的所有主题变量和工具类从暖棕色调切换到冷灰色调，以便工作流面板和工作台页面呈现专业 SaaS 风格。

#### 验收标准

1. THE Studio_Shell_Theme SHALL 将 `--studio-shell-bg` 从暖米色渐变替换为冷灰白渐变
2. THE Studio_Shell_Theme SHALL 将 `--studio-shell-border` 从暖棕边框 `rgba(151,120,90,…)` 替换为冷灰边框
3. THE Studio_Shell_Theme SHALL 将 `--studio-ink`（`#4a3727`）和 `--studio-ink-soft`（`#7d6856`）替换为冷灰文字色（如 `#1e293b` 和 `#64748b`）
4. THE Studio_Shell_Theme SHALL 将 `--studio-accent`（`#c98257`）和 `--studio-accent-strong`（`#b86f45`）替换为与新绿色主色协调的强调色
5. THE Studio_Shell_Theme SHALL 保留 `--studio-sage` 和 `--studio-sage-strong` 的绿色色相，微调以与新 `--primary` 协调
6. THE Workspace_Theme SHALL 将 `--workspace-page-bg` 从暖色径向渐变替换为干净的冷色或纯白背景
7. THE Workspace_Theme SHALL 将所有 `--workspace-text-*` 变量从暖棕色系替换为冷灰色系
8. THE Workspace_Theme SHALL 将所有 `--workspace-panel-*` 变量的背景、边框和阴影从暖色替换为冷色
9. THE Workspace_Theme SHALL 将 `--workspace-control-*` 变量从暖色替换为冷色
10. THE Workspace_Theme SHALL 将 `--workspace-success`、`--workspace-warning`、`--workspace-danger`、`--workspace-info` 保留为语义色，但确保与新冷色背景的对比度满足 WCAG AA 标准（4.5:1 正文文字）

### 需求 4：Splitter 与交互组件色彩同步

**用户故事：** 作为前端开发者，我希望 `.office-cockpit-splitter` 和 `.launch-clarification-splitter` 中硬编码的暖色值同步更新为冷色，以便分割器控件与新色板一致。

#### 验收标准

1. WHEN splitter 折叠按钮渲染时，THE Design_Token_System SHALL 将 `color: #9c6b47` 替换为冷灰色值
2. WHEN splitter 折叠按钮处于 hover/active 状态时，THE Design_Token_System SHALL 将 `background: rgba(255,248,241,…)` 替换为冷色悬停背景
3. THE Design_Token_System SHALL 将 splitter 的 `box-shadow` 中的暖棕色 `rgba(201,130,87,…)` 和 `rgba(88,61,39,…)` 替换为冷灰阴影色
4. WHEN splitter 折叠按钮处于 hover 状态时，THE Design_Token_System SHALL 将 `color: #5e8b72` 保留为绿色系（与 `--primary` 协调）

### 需求 5：字体栈审查与标准化

**用户故事：** 作为前端开发者，我希望确认当前字体栈是否适合新的 SaaS 视觉方向，并在必要时进行调整。

#### 验收标准

1. THE Design_Token_System SHALL 保留 `--font-display: "Space Grotesk"` 作为标题字体，因其几何无衬线风格与 SaaS 方向兼容
2. THE Design_Token_System SHALL 保留 `--font-mono: "JetBrains Mono"` 作为数据/代码字体
3. THE Design_Token_System SHALL 保留 `--font-body: "DM Sans"` 作为正文字体
4. THE Design_Token_System SHALL 确保 `h1`–`h4` 和 `[data-slot="card-title"]` 继续使用 `--font-display`
5. THE Design_Token_System SHALL 确保 `.font-data` 继续使用 `--font-mono` 并保持 `tabular-nums`

### 需求 6：圆角与阴影标准化

**用户故事：** 作为前端开发者，我希望圆角和阴影令牌与新的 SaaS 视觉方向对齐，提供更统一的卡片容器外观。

#### 验收标准

1. THE Design_Token_System SHALL 将 `--radius` 从 `0.75rem` 调整为 `0.625rem`（10px），以获得更精致的圆角效果
2. THE Design_Token_System SHALL 确保 `--radius-sm`、`--radius-md`、`--radius-lg`、`--radius-xl` 继续基于 `--radius` 计算
3. THE Design_Token_System SHALL 将 `.glass-panel` 和 `.workspace-panel` 的 `box-shadow` 统一为不超过两层的冷灰阴影（一层扩散阴影 + 一层 inset 高光），避免当前多层暖色阴影的复杂度
4. IF 组件使用了超过 `32px` 的 `border-radius` 硬编码值（如 `rounded-[34px]`、`rounded-[44px]`），THEN THE Design_Token_System SHALL 不在本 spec 中修改这些组件级硬编码值，仅确保令牌层的圆角标准化

### 需求 7：不破坏现有组件功能

**用户故事：** 作为前端开发者，我希望色板替换是纯 CSS 变量层面的改动，不涉及组件结构变更，以便现有功能不受影响。

#### 验收标准

1. THE Design_Token_System SHALL 仅修改 `client/src/index.css` 中的 CSS 变量值和工具类样式，不修改任何 `.tsx` 组件文件的结构或逻辑
2. THE Design_Token_System SHALL 不修改 `components.json` 的配置结构
3. THE Design_Token_System SHALL 不修改 `@theme inline` 块中的变量名映射关系，仅修改 `:root` 中的变量值
4. THE Design_Token_System SHALL 不新增或删除任何 CSS 自定义属性名称（可以新增暗色模式占位声明除外）
5. IF LoadingScreen 组件中存在硬编码色值（如 `#4a3727`、`rgba(88,61,39,…)`），THEN THE Design_Token_System SHALL 不在本 spec 中修改这些组件内联色值，仅确保 LoadingScreen 消费的 CSS 变量（如 `bg-background`）正确反映新色板
6. THE Design_Token_System SHALL 确保 `@theme inline` 中的 Tailwind 颜色映射在变量值更新后仍能正确解析
