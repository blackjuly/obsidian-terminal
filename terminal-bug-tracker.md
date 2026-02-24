# Obsidian Terminal Bug Tracker

Last updated: 2026-02-13
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

### BUG-006 Error popup when terminal is closed

- Status: `resolved` (user-verified on 2026-02-11)
- Priority: `P1`
- Symptom:
  - Closing terminal may show popup:
  - `TypeError: Cannot read properties of undefined (reading '_isDisposed')`
- User impact:
  - Closing experience is noisy and appears unstable.
- Reproduction (current):
  1. Open integrated terminal.
  2. Start interactive command (for example `codex`).
  3. Close terminal tab.
  4. Observe popup error in some runs.
- Evidence:
  - User-provided screenshot in this conversation.
- Notes:
  - Likely dispose ordering race in renderer/addon chain during terminal close.
  - Decision (2026-02-13): 不再修 `_isDisposed`，接受该报错。
  - Status note: 防御性 dispose 补丁标记为错误方案（不再使用）。
  - Mitigation (2026-02-13): `_isDisposed` 关闭弹窗已静默处理（仅降噪）。
  - Mitigation (2026-02-13): 强制 `windowsHide: true`，避免 `conhost.exe` 外部窗口弹出。
- Applied fix:
  - Hardened renderer addon lifecycle:
    - dispose previous renderer defensively with try/catch in `use(...)`
    - avoid disposing renderer again inside `RendererAddon.dispose()`
  - Made emulator close idempotent and made terminal dispose errors non-fatal debug logs.
- Files:
  - `src/terminal/emulator-addons.ts`
  - `src/terminal/emulator.ts`

### BUG-007 Font size becomes smaller after close and new terminal launch

- Status: `fixed-awaiting-user-verification` (attempt-5, 2026-02-13)
- Priority: `P1`
- Symptom:
  - After closing a terminal and opening a new one, text appears smaller than expected.
- User impact:
  - Visual consistency regresses and readability drops.
- Reproduction (current):
  1. Open integrated terminal and observe configured font size.
  2. Close it.
  3. Open a new terminal instance.
  4. Observe smaller-looking font in some runs.
- Evidence:
  - User-provided screenshots in this conversation.
- Notes:
  - Suspected startup timing issue where text metrics/layout are not fully stabilized at first paint.
- Applied fix:
  - Added startup layout stabilization passes and re-applied typography-related terminal options
    (`fontFamily`, `fontSize`, `fontWeight`, `fontWeightBold`, `lineHeight`) before deferred fit/resizes.
- Current validation result (2026-02-11):
  - This fix path is incorrect for Codex TUI.
  - New regression appears: typing becomes invisible at startup, backspace a few times may recover text,
    but layout is broken/duplicated.
- Error path (to rollback first):
  - `src/terminal/view.ts` startup stabilization additions:
    - `STARTUP_LAYOUT_STABILIZATION_DELAYS`
    - `reapplyTerminalTypography`
    - `scheduleLayoutStabilization`
    - first-write-triggered `scheduleLayoutStabilization(...)`
- Attempt-2 patch (minimal risk):
  - Do not add deferred multi-resize logic.
  - Re-apply typography options once after renderer selection and on renderer switch:
    - `fontFamily`, `fontSize`, `fontWeight`, `fontWeightBold`, `lineHeight`
  - Trigger a single best-effort `emulator.resize(false)` after renderer switch.
- Attempt-3 patch (cache-oriented quick fix):
  - Increased WezTerm-style default font size from `14` to `16`.
  - Updated local vault plugin settings cache:
    - `F:\alex-test-plugin\.obsidian\plugins\terminal\data.json`
    - `profiles.win32IntegratedDefault.terminalOptions.fontSize = 16`
    - `profiles.darwinIntegratedDefault.terminalOptions.fontSize = 16`
    - `profiles.linuxIntegratedDefault.terminalOptions.fontSize = 16`
- Files:
  - `src/terminal/view.ts`
  - `src/terminal/profile-presets.ts`
- Attempt-4 patch (2026-02-13):
  - Added runtime minimum typography guard when spawning terminal:
    - enforce `fontSize >= 16`
    - enforce `lineHeight >= 1.15`
    - fallback font family/theme when missing
  - User validation result: visual size still appears unchanged.
- Attempt-5 patch (2026-02-13):
  - Increased default and runtime minimum font size from `16` to `18`.
  - User validation result: still no visible change.
- Root cause found after attempt-5:
  - Deployment mismatch: development build output in
    `D:\obsidian-terminal-plus-plugin\main.js` was newer, but running vault plugin file remained older:
    `F:\alex-test-plugin\.obsidian\plugins\terminal\main.js` (timestamp still 2026-02-11).
  - Therefore attempts 4/5 were not actually loaded by Obsidian yet.

### BUG-008 Cursor positioning still occasionally wrong on first startup

- Status: `reopened`
- Priority: `P1`
- Symptom:
  - First launch can still place prompt/cursor context incorrectly; repeated reopen may become normal.
- User impact:
  - TUI startup state is unreliable for Codex/interactive tools.
- Reproduction (current):
  1. Fresh open of terminal view.
  2. Run `codex`.
  3. In some runs, cursor/prompt starts at wrong visual position.
- Evidence:
  - User-provided screenshot in this conversation.
- Notes:
  - Timing-sensitive race between initial render, first output frame, and PTY resize.
- Applied fix:
  - Added first-write-triggered deferred resize stabilization and multi-phase startup deferred resizes.
  - Ensured typography reapply occurs before stabilization resizes.
- Current validation result (2026-02-11):
  - The fix introduced a stronger regression on Codex startup interaction and layout stability.
  - Must rollback this fix path before re-attempting BUG-008.
- Files:
  - `src/terminal/view.ts`

### BUG-009 Codex startup input invisible + layout corruption after latest fix

- Status: `open`
- Priority: `P0`
- Symptom:
  - After launching `codex`, typed characters are not visible initially.
  - Pressing backspace multiple times may make input visible again.
  - Screen layout becomes disordered/duplicated.
- User impact:
  - Codex TUI becomes unreliable and difficult to use.
- Reproduction (current):
  1. Open integrated terminal.
  2. Run `codex`.
  3. Type input.
  4. Observe invisible typing and broken layout.
- Evidence:
  - User-provided screenshot in this conversation (shows duplicated startup blocks and abnormal prompt area).
- Suspected root cause:
  - Over-aggressive deferred resize/reopen typography writes during Codex first-screen control sequences.
- Error path (primary):
  - `src/terminal/view.ts`
    - `STARTUP_LAYOUT_STABILIZATION_DELAYS`
    - `reapplyTerminalTypography`
    - `scheduleLayoutStabilization`
    - first-write-triggered stabilization in `terminal.onWriteParsed(...)`
- Recovery recommendation:
  - Roll back this patch path first, then retest baseline before smaller-scoped fix.

### BUG-010 Codex execution stream renders duplicated lines and noisy refresh

- Status: `open`
- Priority: `P0`
- Symptom:
  - During Codex execution, terminal shows duplicated/garbled-looking stream fragments.
  - Output appears to keep refreshing with repeated prompt/status blocks and extra line breaks.
- User impact:
  - Long-running Codex tasks become hard to read and unreliable to monitor.
- Reproduction (current):
  1. Open integrated terminal in Obsidian.
  2. Launch `codex` and start a task that streams progress updates.
  3. Observe repeated `Use /skills...`, repeated prompt markers, and noisy line refresh behavior.
- Evidence:
  - User screenshots on 2026-02-13 in this conversation.
- Suspected relation:
  - Regressed after typography/theme-forcing patch path introduced on 2026-02-13.
- Immediate mitigation applied:
  - Rolled back runtime terminal option forcing in `src/terminal/view.ts`:
    - removed spawn-time overrides for `fontSize`, `lineHeight`, fallback `fontFamily` and fallback `theme`.
  - Rolled back WezTerm preset typography/theme edits in `src/terminal/profile-presets.ts` to baseline values.
- Next validation target:
  - Verify Codex stream stability first (no duplicate-refresh artifacts), then re-approach font-size enhancement with
    a safer and narrower strategy.
- Rollback validation result (2026-02-13):
  - Even after rolling back 2026-02-13 typography/theme forcing path, Codex execution stream is still unstable
    (duplicate lines, noisy refresh, scattered prompt markers).
- Attempt-2 patch (2026-02-13, chosen strategy):
  - Keep current baseline and continue targeted optimization on Windows `conhost` pipe path.
  - `src/terminal/pseudoterminal.ts`:
    - In `conhost` mode, do not forward `stderr` to terminal canvas directly (log to debug console instead) to
      avoid potential duplicated stream rendering.
    - Deduplicate identical resize payloads in `WindowsPseudoterminal.resize(...)` to reduce redundant redraw
      triggers.
- Attempt-2 validation result (2026-02-13):
  - Failed and worsened behavior.
  - User observed heavier repeated output bursts (`Searching the web` duplicated many times) and noisier refresh.
- Attempt-2 rollback:
  - Reverted `src/terminal/pseudoterminal.ts` changes introduced by attempt-2
    (stderr isolation and resize-payload deduplication).
- Attempt-3 patch (2026-02-13, single-fix mode):
  - Only one change applied to avoid cross-bug interference.
  - `src/terminal/emulator.ts`:
    - Added same-size resize deduplication in `XtermTerminalEmulator.resize(...)`.
    - If proposed `cols/rows` unchanged from last apply, skip emulator/PTTY resize call.
- Attempt-3 validation result (2026-02-13):
  - Failed.
  - User reports Codex execution still shows duplicated progress/status refresh and repeated summary segments.
- Attempt-4 patch (2026-02-13, diagnostic only):
  - Added raw stream logging for Windows `conhost` path in `src/terminal/pseudoterminal.ts`.
  - Persist each stdout/stderr chunk to JSONL log file:
    - `%TEMP%\\obsidian-terminal-stream.log` (fallback `%TMP%`, then current dir).
  - Purpose:
    - Confirm whether duplication originates from source stream itself, or from terminal rendering/update logic.
- Attempt-4 analysis result (2026-02-13):
  - Source stream itself is high-frequency repaint output from `conhost` path (not simple duplicate write in plugin).
  - Log contains frequent `CSI ?2026 h/l` synchronized-output control sequences mixed with progress/status repaint.
  - In-plugin symptom aligns with missing synchronized-output handling in current write path.
- Attempt-5 patch (2026-02-13):
  - Removed temporary stream-log instrumentation from `src/terminal/pseudoterminal.ts`.
  - Added synchronized-output normalization for Windows `conhost` stream:
    - Parse and handle `CSI ?2026 h/l` mode toggles.
    - Buffer output while mode is active, flush as one frame when mode exits.
    - Serialize terminal writes through an internal queue to preserve order while applying normalization.
- Attempt-5 validation result (2026-02-13):
  - Failed.
  - User reports rendering became worse: overall output format appears corrupted/chaotic.
- Attempt-6 patch (2026-02-13):
  - Added short-window synchronized-frame coalescing on top of attempt-5:
    - keep latest synchronized repaint frame within ~20ms window before flush.
- Attempt-6 validation result (2026-02-13):
  - Failed and worse than attempt-5.
  - User reports "越改越烂", format disorder increased.
- Attempt-6 rollback:
  - Fully reverted `src/terminal/pseudoterminal.ts` to pre-attempt-5 baseline.
  - Built and reinstalled to test vault path `F:\\alex-test-plugin`.
- Reset decision:
  - User plans to git-rollback whole workspace and restart in a new chat/window.
  - Recommended restart scope: re-open with BUG-010 only, keep BUG-001..006 as known-good history.

## Verification queue (to update later)

- [x] BUG-001 verified fixed by user
- [x] BUG-002 verified fixed by user
- [x] BUG-003 verified fixed by user
- [x] BUG-004 verified fixed by user
- [x] BUG-005 verified fixed by user
- [x] BUG-006 verified fixed by user
- [ ] BUG-007 reopened (not resolved)
- [ ] BUG-008 reopened (not resolved)
- [ ] BUG-009 pending user verification
- [ ] BUG-010 pending user verification

## Change log

### 2026-02-11

- Created tracker and recorded 3 user-reported production issues.
- Applied patch candidate for BUG-001/002/003 in source code.
- User confirmed BUG-002 and BUG-003 are fixed; BUG-001 considered resolved from successful Codex startup.
- Added new regression tickets BUG-004 and BUG-005 from latest validation round.
- Applied fix candidate for BUG-004/005 by removing first-chunk drop logic in Windows pipe path.
- User confirmed BUG-004 and BUG-005 are fixed (no first-screen duplication, correct startup cursor position).
- Added new regression tickets BUG-006/007/008 from latest validation round.
- Applied fix candidate for BUG-006 via dispose-chain hardening and idempotent emulator close.
- Applied fix candidate for BUG-007/008 via startup typography reapply and deferred layout stabilization.
- User verified BUG-006 fixed: closing terminal no longer shows `_isDisposed` popup.
- User reported new regression after BUG-007/008 fix path: Codex typing invisible on startup and layout corruption.
- Marked BUG-007/008 as reopened and created BUG-009 (P0).
- Recorded wrong fix path in `src/terminal/view.ts` and recommended rollback-first strategy.
- Applied BUG-007 attempt-2 with minimal patch in `src/terminal/view.ts` (no deferred multi-resize path).

### 2026-02-13

- Added BUG-007 attempt-4 runtime typography fallback (`fontSize >= 16`) in `src/terminal/view.ts`.
- Added BUG-007 attempt-5 stronger fallback (`fontSize >= 18`) and updated presets in
  `src/terminal/profile-presets.ts`.
- User reported no visible size change after restarting Obsidian.
- Marked BUG-006 defensive dispose patch as wrong approach; decided not to fix `_isDisposed`.
- Confirmed deployment mismatch:
  - New build artifact timestamp in workspace:
    `D:\obsidian-terminal-plus-plugin\main.js` (2026-02-13 10:08)
  - Vault plugin artifact still old:
    `F:\alex-test-plugin\.obsidian\plugins\terminal\main.js` (2026-02-11 18:58)
- User reported new severe runtime issue while Codex executes:
  - noisy repeated line refresh, duplicated stream blocks, and garbled-looking rendering.
- Created BUG-010 (`P0`) for this regression.
- Rolled back 2026-02-13 typography/theme forcing path to reduce rendering side effects:
  - `src/terminal/view.ts` spawn-time option forcing removed.
  - `src/terminal/profile-presets.ts` WezTerm style values restored to baseline.
- User reported rollback path is still insufficient: stream refresh/line breaks remain unstable during Codex tasks.
- Continued with targeted BUG-010 optimization (no broad rollback):
  - Updated `src/terminal/pseudoterminal.ts` to isolate `conhost` stderr from terminal stream and dedupe resize
    payloads.
- User verified attempt-2 made output duplication worse.
- Rolled back BUG-010 attempt-2 changes in `src/terminal/pseudoterminal.ts`.
- User reported BUG-010 still present after attempt-3 (`emulator` resize dedupe only).
- Added BUG-010 attempt-4 diagnostic instrumentation:
  - `src/terminal/pseudoterminal.ts` now logs raw conhost stream chunks to
    `%TEMP%\\obsidian-terminal-stream.log` for exact replay/root-cause analysis.
- Analyzed `%TEMP%\\obsidian-terminal-stream.log`:
  - All sampled chunks came from `stdout`.
  - Repaint bursts include synchronized-output toggles (`?2026h/?2026l`) and frequent cursor reposition/line erase.
  - Conclusion: main spam pattern is upstream repaint cadence; plugin needs synchronized-output frame handling.
- Applied BUG-010 attempt-5:
  - Replaced temporary logging with synchronized-output buffering/flush logic in
    `src/terminal/pseudoterminal.ts` (Windows `conhost` path).
- User validation: attempt-5 made format disorder worse.
- Applied BUG-010 attempt-6:
  - Added 20ms synchronized repaint-frame coalescing.
- User validation: attempt-6 made output even worse.
- Emergency rollback completed:
  - Reverted `src/terminal/pseudoterminal.ts` back to pre-attempt-5 baseline.
  - Rebuilt and installed to `F:\\alex-test-plugin`.
- User decision:
  - Roll back entire repository with git and restart from clean state in a new window.
