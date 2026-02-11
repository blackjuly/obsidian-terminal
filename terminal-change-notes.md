# Obsidian Terminal 改动记录（2026-02-11）

## 目标

基于 `obsidian-terminal` 做二次开发，实现不依赖 WezTerm 二进制的“内嵌 WezTerm 风格终端体验”，重点保证：

- 终端始终内嵌于 Obsidian 面板。
- Windows 默认体验不退回传统 cmd 风格。
- Codex/AI CLI 等 TUI 交互稳定。
- 输出可追溯、复制体验友好。

## 已验证有效方案

### 1. WezTerm 风格深色预设（默认集成）

- 关键文件：`src/terminal/profile-presets.ts`
- 结果：默认 integrated profile 使用深色主题、较大字号、紧凑行高、高滚动缓冲，更接近 WezTerm/mac 终端观感。

### 2. Windows 默认 shell 改为 PowerShell（内嵌）

- 关键文件：`src/terminal/profile-presets.ts`
- 结果：`win32IntegratedDefault` 改为 `powershell -NoLogo`，默认不再是 `cmd` 风格。

### 3. Windows 默认启用 `useWin32Conhost`

- 关键文件：`src/terminal/profile-presets.ts`、`src/settings-data.ts`
- 结果：修复 `stdin is not a terminal`，同时避免 Windows `shell:true` 管道路径导致的中文乱码。

### 4. 右键复制/粘贴可视化设置

- 关键文件：`src/modals.ts`、`src/settings.ts`
- 结果：用户可在 Profile 和快捷设置中直接配置右键行为，避免强依赖 `Ctrl+C`。

### 5. 快捷设置区（开箱即用）

- 关键文件：`src/settings.ts`
- 结果：新增“Embedded terminal experience”设置区，直接暴露主题、字体、行高、滚动缓冲、右键行为、默认 shell。

### 6. 面板视觉升级（内嵌高质感）

- 关键文件：`src/terminal/view.css`
- 结果：终端容器新增深色渐变、边框、阴影、细滚动条，提升高级感与长时间阅读舒适性。

## 不推荐方案

### 1. 通过“丢弃首个输出包”修复首屏布局

- 文件：`src/terminal/pseudoterminal.ts`
- 结论：会引发后续输入与光标异常，不推荐。

### 2. 通过 stdout/stderr 混写策略强行修布局

- 文件：`src/terminal/pseudoterminal.ts`
- 结论：可能造成输入阶段错位、换行异常、重复刷屏，不推荐。

### 3. 将关闭链路修复与输出链路变更叠加验证

- 文件：`src/terminal/emulator.ts`、`src/terminal/view.ts`、`src/terminal/pseudoterminal.ts`
- 结论：排障维度混杂，极易引入回归，不推荐。

## 默认配置方案（本轮）

- 主题：WezTerm 风格深色预设。
- 字体：`JetBrains Mono / Cascadia / SF Mono / Menlo / Consolas / monospace`。
- 字号：`14`。
- 行高：`1.12`。
- 滚动缓冲：`200000`。
- 右键行为：`copyPaste`。
- Windows 默认 shell：`powershell -NoLogo`。
- `useWin32Conhost`：Windows 默认 `true`。

## 用户可见设置项

插件设置新增 “Embedded terminal experience” 区域，包含：

- Theme preset
- Font family
- Font size
- Line height
- Scrollback buffer
- Right click behavior
- Default shell

此外，Profile 编辑弹窗新增：

- Theme preset
- Right click action

## 验收清单（可逐条打勾）

- [ ] 在 Obsidian 面板内启动终端时，不弹出外部窗口。
- [ ] Windows 新建 integrated 终端默认 shell 为 PowerShell（非 cmd 风格）。
- [ ] 终端视觉为深色高质感风格（背景、边框、滚动条、字体观感符合预期）。
- [ ] 可同时打开至少 2 个终端实例并行工作。
- [ ] 运行长输出命令后可向上滚动查看历史，前文不丢失。
- [ ] 选中文本后右键可复制；无选中时右键可粘贴。
- [ ] 启动 `codex` 后首屏布局稳定，无明显重复首屏。
- [ ] `codex` 交互中输入、退格、换行、光标位置正常。
- [ ] 在设置页可调整主题、字体、行高、滚动缓冲、右键行为、默认 shell。
- [ ] 修改后重启 Obsidian，配置可持续生效。
