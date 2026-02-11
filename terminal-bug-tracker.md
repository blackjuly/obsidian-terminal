# Obsidian Terminal Bug Tracker

Last updated: 2026-02-11
Owner: Codex + User
Scope: `F:\alex-test-plugin\.obsidian\plugins\terminal`

## Tracking rules

- Current phase: `active fix + verification`.
- User-verified items are marked `resolved` immediately with solution notes.
- Newly introduced regressions are tracked as new bug IDs.

## Environment snapshot

- OS: Windows (from current test context)
- Vault: `F:\alex-test-plugin`
- Plugin install path: `F:\alex-test-plugin\.obsidian\plugins\terminal`
- Active profile observed in screenshot: `powershell` (integrated)

## Bug list

### BUG-001 Codex cannot start in embedded terminal

- Status: `resolved` (user-verified on 2026-02-11)
- Priority: `P0`
- Symptom:
  - Running `codex` in integrated terminal shows:
  - `Error: stdin is not a terminal`
- User impact:
  - Codex CLI cannot be used inside Obsidian embedded terminal.
- Reproduction (current):
  1. Open integrated terminal in Obsidian.
  2. Run `codex`.
  3. Observe terminal output `stdin is not a terminal`.
- Evidence:
  - User-provided screenshot in this conversation (red box in terminal area).
- Notes:
  - This indicates TTY/PTY capability mismatch from Codex perspective.
- Patch candidate (awaiting user verification):
  - Force Windows integrated shells to use `conhost` execution path for TTY semantics.
  - Update Windows defaults/presets to `useWin32Conhost=true`.
- Solution:
  - Forced Windows integrated shells to run through `conhost` path so Codex sees terminal-like stdin.
  - Updated Windows defaults and shell presets to `useWin32Conhost=true`.
  - Evidence of fix: user can start Codex and reach interactive TUI screen.

### BUG-002 Chinese text appears garbled in terminal output

- Status: `resolved` (user-verified on 2026-02-11)
- Priority: `P0`
- Symptom:
  - Chinese characters in terminal output/file names are garbled.
- User impact:
  - Chinese reading/writing in shell and CLI tools is unreliable.
- Reproduction (current):
  1. In integrated terminal, run command that prints Chinese text or file names.
  2. Observe mojibake/garbled Chinese.
- Evidence:
  - User-provided screenshot in this conversation.
- Notes:
  - Likely related to Windows code page / encoding path.
- Patch candidate (awaiting user verification):
  - Route Windows default integrated sessions away from `shell:true` pipe mode (GBK bytes interpreted as UTF-8) and into `conhost` path.
- Solution:
  - Avoided Windows `shell:true` pipeline path for default integrated shells.
  - Routed integrated shells to `conhost` path to preserve expected Unicode output behavior.
  - User feedback confirms Chinese display is fixed.

### BUG-003 Popup reports unexpected terminal resizer exit code 9090

- Status: `resolved` (user-verified on 2026-02-11)
- Priority: `P1`
- Symptom:
  - Obsidian popup notice: terminal/resizer exited unexpectedly with `9090`.
- User impact:
  - Distracting error popup and possible resize instability.
- Reproduction (current):
  1. Open integrated terminal.
  2. Use/resize terminal during session.
  3. Observe popup `...unexpectedly exited: 9090`.
- Evidence:
  - User-provided screenshot in this conversation (top-right notice).
- Notes:
  - `9090` is likely from Windows resizer helper process path.
- Patch candidate (awaiting user verification):
  - Resizer changed to best-effort mode: no blocking spawn path, no user-facing unexpected-exit popup, resize gracefully degrades when resizer unavailable.
- Solution:
  - Resizer flow changed to best-effort mode and no longer raises user-facing unexpected-exit popup.
  - Resize now degrades gracefully when resizer is unavailable.
  - User feedback confirms no more 9090 popup.

### BUG-004 Codex first screen is rendered repeatedly on startup

- Status: `resolved` (user-verified on 2026-02-11)
- Priority: `P1`
- Symptom:
  - Codex first screen appears multiple times (stacked/duplicated content blocks) after startup.
- User impact:
  - Startup view is visually broken and state transitions are confusing.
- Reproduction (current):
  1. Open integrated terminal.
  2. Run `codex`.
  3. Observe duplicated first-screen blocks.
- Evidence:
  - User-provided screenshot in this conversation (duplicated Codex header block).
- Notes:
  - Likely caused by dropping the first output chunk in Windows `conhost` path, which can swallow initial clear/cursor control sequences.
- Patch candidate (awaiting user verification):
  - Stop discarding the first stdout/stderr data chunk in Windows `conhost` path.
- Solution:
  - Removed first-chunk discard logic in Windows terminal pipe reader.
  - Kept initial terminal control sequences intact (clear screen/cursor positioning).
  - User feedback confirms first-screen duplication is resolved.

### BUG-005 Cursor appears at wrong position on first launch

- Status: `resolved` (user-verified on 2026-02-11)
- Priority: `P1`
- Symptom:
  - On first launch, cursor/selection appears at incorrect position (e.g., around the `? for shortcuts` area).
- User impact:
  - Initial interactive behavior feels unstable and may cause wrong input context.
- Reproduction (current):
  1. Open integrated terminal.
  2. Run `codex`.
  3. Observe cursor starting in unexpected location.
- Evidence:
  - User screenshot and report in this conversation.
- Notes:
  - Shares the same likely root cause as BUG-004 (lost initial terminal control sequence).
- Patch candidate (awaiting user verification):
  - Remove first-chunk drop logic from Windows terminal pipe path.
- Solution:
  - Same root-cause fix as BUG-004: do not drop first output chunk in Windows path.
  - Preserved initial cursor control sequences from shell/TUI bootstrap.
  - User feedback confirms first-launch cursor position is correct.

## Verification queue (to update later)

- [x] BUG-001 verified fixed by user
- [x] BUG-002 verified fixed by user
- [x] BUG-003 verified fixed by user
- [x] BUG-004 verified fixed by user
- [x] BUG-005 verified fixed by user

## Change log

### 2026-02-11

- Created tracker and recorded 3 user-reported production issues.
- Applied patch candidate for BUG-001/002/003 in source code.
- User confirmed BUG-002 and BUG-003 are fixed; BUG-001 considered resolved from successful Codex startup.
- Added new regression tickets BUG-004 and BUG-005 from latest validation round.
- Applied fix candidate for BUG-004/005 by removing first-chunk drop logic in Windows pipe path.
- User confirmed BUG-004 and BUG-005 are fixed (no first-screen duplication, correct startup cursor position).
