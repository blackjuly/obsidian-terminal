import {
  Functions,
  Platform,
  type PluginContext,
  activeSelf,
  consumeEvent,
  deepFreeze,
  isNonNil,
  replaceAllRegex,
  revealPrivate,
} from "@polyipseity/obsidian-plugin-library";
import type { ITerminalAddon, ITheme, Terminal } from "@xterm/xterm";
import { constant, isUndefined } from "lodash-es";
import type { CanvasAddon } from "@xterm/addon-canvas";
import type { WebglAddon } from "@xterm/addon-webgl";
import { around } from "monkey-around";
import { FileSystemAdapter, Menu, TFile, normalizePath } from "obsidian";
import { noop } from "ts-essentials";

type DragAndDropPathEntry = {
  readonly path: string;
  readonly relative: boolean;
};

export class DisposerAddon extends Functions implements ITerminalAddon {
  public constructor(...args: readonly (() => void)[]) {
    super({ async: false, settled: true }, ...args);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public activate(_terminal: Terminal): void {
    // Noop
  }

  public dispose(): void {
    this.call();
  }
}

export class DragAndDropAddon implements ITerminalAddon {
  readonly #disposer = new Functions({ async: false, settled: true });

  public constructor(
    protected readonly context: PluginContext,
    protected readonly element: HTMLElement,
  ) {}

  public activate(terminal: Terminal): void {
    const { element } = this,
      drop = (event: DragEvent): void => {
        const paths = this.#resolveDropPaths(event);
        if (paths.length > 0) {
          terminal.paste(this.#formatDropPaths(paths));
        }
        consumeEvent(event);
      },
      dragover = consumeEvent;
    this.#disposer.push(
      () => {
        element.removeEventListener("dragover", dragover);
      },
      () => {
        element.removeEventListener("drop", drop);
      },
    );
    element.addEventListener("drop", drop);
    element.addEventListener("dragover", dragover);
  }

  public dispose(): void {
    this.#disposer.call();
  }

  #resolveDropPaths(event: DragEvent): DragAndDropPathEntry[] {
    const transfer = event.dataTransfer;
    if (!transfer) {
      return [];
    }
    const fromFiles = this.#pathsFromFiles(transfer);
    if (fromFiles.length > 0) {
      return fromFiles;
    }
    return this.#pathsFromDataTransfer(transfer);
  }

  #pathsFromFiles(transfer: DataTransfer): DragAndDropPathEntry[] {
    const files = Array.from(transfer.files ?? []).filter(isNonNil);
    if (files.length === 0) {
      return [];
    }
    const basePath = this.#vaultBasePath();
    const entries: DragAndDropPathEntry[] = [];
    for (const file of files) {
      const entry = this.#entryFromFilePath(file.path, basePath);
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  }

  #pathsFromDataTransfer(transfer: DataTransfer): DragAndDropPathEntry[] {
    const candidates = new Set<string>(),
      types = Array.from(transfer.types ?? []);
    for (const type of types) {
      if (type === "Files" || type === "text/html") {
        continue;
      }
      if (
        type === "text/plain" ||
        type === "text/uri-list" ||
        type === "application/json" ||
        type.includes("obsidian")
      ) {
        const data = transfer.getData(type);
        if (data) {
          this.#collectCandidates(data, type, candidates);
        }
      }
    }
    if (candidates.size === 0) {
      return [];
    }
    const resolved = this.#resolveVaultCandidates(candidates);
    return resolved.map((path) => ({ path, relative: true }));
  }

  #entryFromFilePath(
    filePath: string,
    basePath: string | null,
  ): DragAndDropPathEntry | null {
    if (!filePath) {
      return null;
    }
    if (basePath) {
      const relative = this.#relativeToVaultBase(filePath, basePath);
      if (relative) {
        const resolved = this.#resolveVaultPath(relative);
        return {
          path: resolved ?? relative,
          relative: true,
        };
      }
    }
    return {
      path: filePath,
      relative: false,
    };
  }

  #vaultBasePath(): string | null {
    const { adapter } = this.context.app.vault;
    if (!(adapter instanceof FileSystemAdapter)) {
      return null;
    }
    const normalized = normalizePath(adapter.getBasePath());
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  #relativeToVaultBase(path: string, basePath: string): string | null {
    const normalized = normalizePath(path),
      normalizedBase = normalizePath(basePath),
      isWin = Platform.CURRENT === "win32",
      comparePath = isWin ? normalized.toLowerCase() : normalized,
      compareBase = isWin ? normalizedBase.toLowerCase() : normalizedBase,
      prefix = `${compareBase}/`;
    if (comparePath === compareBase) {
      return null;
    }
    if (!comparePath.startsWith(prefix)) {
      return null;
    }
    const relative = normalized.slice(prefix.length);
    return relative ? relative : null;
  }

  #collectCandidates(
    data: string,
    type: string,
    candidates: Set<string>,
  ): void {
    const trimmed = data.trim();
    if (!trimmed) {
      return;
    }
    this.#collectCandidatesFromJson(trimmed, candidates);
    if (type === "text/uri-list") {
      this.#collectCandidatesFromUriList(trimmed, candidates);
      return;
    }
    this.#collectCandidatesFromText(trimmed, candidates);
  }

  #collectCandidatesFromJson(data: string, candidates: Set<string>): void {
    const trimmed = data.trim();
    if (
      !(trimmed.startsWith("{") && trimmed.endsWith("}")) &&
      !(trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return;
    }
    const visit = (value: unknown): void => {
      if (typeof value === "string") {
        candidates.add(value);
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          visit(item);
        }
        return;
      }
      if (!value || typeof value !== "object") {
        return;
      }
      const record = value as Record<string, unknown>;
      for (const [key, child] of Object.entries(record)) {
        if (key === "path" || key === "file" || key === "files") {
          visit(child);
        }
      }
    };
    visit(parsed);
  }

  #collectCandidatesFromUriList(data: string, candidates: Set<string>): void {
    for (const line of data.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      this.#collectCandidatesFromUri(trimmed, candidates);
    }
  }

  #collectCandidatesFromUri(uri: string, candidates: Set<string>): void {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      return;
    }
    if (parsed.protocol === "obsidian:") {
      const file =
        parsed.searchParams.get("file") ?? parsed.searchParams.get("path");
      if (file) {
        candidates.add(file);
      }
      return;
    }
    if (parsed.protocol === "file:") {
      const decoded = decodeURIComponent(parsed.pathname);
      candidates.add(
        Platform.CURRENT === "win32" && decoded.startsWith("/")
          ? decoded.slice(1)
          : decoded,
      );
    }
  }

  #collectCandidatesFromText(data: string, candidates: Set<string>): void {
    const lines = data.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      let matched = false;
      if (trimmed.startsWith("obsidian://") || trimmed.startsWith("file://")) {
        this.#collectCandidatesFromUri(trimmed, candidates);
        matched = true;
      }
      const wikiRegex = /!?\[\[([^\]]+)\]\]/g;
      let wikiMatch: RegExpExecArray | null = null;
      while ((wikiMatch = wikiRegex.exec(trimmed)) !== null) {
        matched = true;
        const path = this.#cleanLinkPath(wikiMatch[1]);
        if (path) {
          candidates.add(path);
        }
      }
      const mdRegex = /\[[^\]]*]\(([^)]+)\)/g;
      let mdMatch: RegExpExecArray | null = null;
      while ((mdMatch = mdRegex.exec(trimmed)) !== null) {
        matched = true;
        let target = mdMatch[1].trim();
        const hasAngle = target.startsWith("<") && target.endsWith(">");
        if (hasAngle) {
          target = target.slice(1, -1);
        } else {
          target = target.split(/\s+/)[0] ?? "";
        }
        target = this.#cleanLinkPath(target);
        if (target) {
          candidates.add(target);
        }
      }
      if (!matched && this.#looksLikePath(trimmed)) {
        candidates.add(trimmed);
      }
    }
  }

  #looksLikePath(value: string): boolean {
    return (
      value.includes("/") ||
      value.includes("\\") ||
      /\.[A-Za-z0-9]{1,8}$/.test(value)
    );
  }

  #cleanLinkPath(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const unquoted = this.#stripWrappingQuotes(trimmed),
      withoutAlias = unquoted.split("|")[0] ?? "",
      withoutHeading = withoutAlias.split("#")[0] ?? "",
      withoutBlock = withoutHeading.split("^")[0] ?? "",
      withoutPrefix = withoutBlock.replace(/^\.([\\/])/, "");
    return withoutPrefix ? withoutPrefix.trim() : null;
  }

  #stripWrappingQuotes(value: string): string {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
    return value;
  }

  #resolveVaultCandidates(candidates: Iterable<string>): string[] {
    const resolved = new Set<string>();
    for (const candidate of candidates) {
      const path = this.#resolveVaultPath(candidate);
      if (path) {
        resolved.add(path);
      }
    }
    return [...resolved];
  }

  #resolveVaultPath(candidate: string): string | null {
    const { app } = this.context,
      cleaned = this.#cleanLinkPath(candidate);
    if (!cleaned) {
      return null;
    }
    const fromUri = this.#pathFromUri(cleaned);
    if (fromUri) {
      return this.#resolveVaultPath(fromUri);
    }
    const normalized = normalizePath(cleaned);
    if (this.#isAbsolutePath(normalized)) {
      const basePath = this.#vaultBasePath();
      if (!basePath) {
        const withoutLeading = normalized.replace(/^\/+/, "");
        return withoutLeading !== normalized
          ? this.#resolveVaultPath(withoutLeading)
          : null;
      }
      const relative = this.#relativeToVaultBase(normalized, basePath);
      if (!relative) {
        const withoutLeading = normalized.replace(/^\/+/, "");
        return withoutLeading !== normalized
          ? this.#resolveVaultPath(withoutLeading)
          : null;
      }
      return this.#resolveVaultPath(relative);
    }
    const normalizedRelative = normalized.replace(/^\/+/, "");
    const file = app.vault.getAbstractFileByPath(normalizedRelative);
    if (file instanceof TFile) {
      return file.path;
    }
    const sourcePath = app.workspace.getActiveFile()?.path ?? "",
      linkpath = normalizedRelative.endsWith(".md")
        ? normalizedRelative.slice(0, -3)
        : normalizedRelative,
      resolved =
        app.metadataCache.getFirstLinkpathDest(normalizedRelative, sourcePath) ??
        app.metadataCache.getFirstLinkpathDest(linkpath, sourcePath);
    return resolved?.path ?? null;
  }

  #pathFromUri(value: string): string | null {
    if (!value.startsWith("obsidian://") && !value.startsWith("file://")) {
      return null;
    }
    const candidates = new Set<string>();
    this.#collectCandidatesFromUri(value, candidates);
    return candidates.values().next().value ?? null;
  }

  #isAbsolutePath(value: string): boolean {
    return (
      /^[A-Za-z]:\//.test(value) || value.startsWith("/") || value.startsWith("//")
    );
  }

  #formatDropPaths(entries: DragAndDropPathEntry[]): string {
    return entries
      .map((entry) => this.#formatDropPath(entry))
      .filter(isNonNil)
      .join(" ");
  }

  #formatDropPath(entry: DragAndDropPathEntry): string | null {
    const { relative } = entry;
    let path = entry.path;
    if (!path) {
      return null;
    }
    if (relative) {
      const normalized = normalizePath(path).replace(/^(\.\/|\.\\|\/)+/, ""),
        withPrefix =
          Platform.CURRENT === "win32"
            ? `.\\${normalized.replace(replaceAllRegex("/"), "\\")}`
            : `./${normalized}`;
      path = withPrefix;
    }
    const escaped = path.replace(replaceAllRegex('"'), '\\"');
    return escaped.includes(" ") ? `"${escaped}"` : escaped;
  }
}

export namespace FollowThemeAddon {
  export interface Options {
    /**
     * Whether the addon should apply changes.
     * Default: always true
     */
    readonly enabled?: () => boolean;

    /**
     * CSS custom properties to read. If a value is itself another var(), we
     * resolve it by delegating to the browser.
     */
    readonly bgVar?: string; // Default: --background-primary
    readonly fgVar?: string; // Default: --text-normal
    readonly accentVar?: string; // Default: --interactive-accent

    /**
     * Selection overlay alpha. 0..1
     * Default: 0.3
     */
    readonly selectionAlpha?: number;

    /**
     * Min contrast for cursor vs background. If accent cannot reach this,
     * fall back to the best of white/black/foreground.
     * Default: 3
     */
    readonly minCursorContrast?: number;
  }

  export interface RGBA {
    readonly red: number;
    readonly green: number;
    readonly blue: number;
    readonly alpha: number;
  }
}
export class FollowThemeAddon implements ITerminalAddon {
  // -------------------------------------------------------------------------
  // Constants (removed magic numbers) — kept as private static class fields
  // -------------------------------------------------------------------------

  // CSS variable defaults
  static readonly #DEFAULT_BG_VAR = "--background-primary";
  static readonly #DEFAULT_FG_VAR = "--text-normal";
  static readonly #DEFAULT_ACCENT_VAR = "--interactive-accent";

  // Color constants
  static readonly #COLOR_ALPHA_OPAQUE = 1;
  static readonly #COLOR_ALPHA_MIN = 0;
  static readonly #COLOR_ALPHA_MAX = 1;

  static readonly #COLOR_BLACK: FollowThemeAddon.RGBA = {
    alpha: 1,
    blue: 0,
    green: 0,
    red: 0,
  };

  static readonly #COLOR_WHITE: FollowThemeAddon.RGBA = {
    alpha: 1,
    blue: 255,
    green: 255,
    red: 255,
  };

  // Selection alpha default
  static readonly #DEFAULT_SELECTION_ALPHA = 0.3;

  // Cursor contrast default (WCAG-ish practical threshold)
  static readonly #DEFAULT_MIN_CURSOR_CONTRAST = 3;

  // WCAG relative luminance constants (sRGB -> linear)
  static readonly #SRGB_THRESHOLD = 0.03928;
  static readonly #SRGB_DIVISOR = 12.92;
  static readonly #SRGB_A = 0.055;
  static readonly #SRGB_GAMMA = 2.4;
  static readonly #SRGB_FACTOR = 1.055;

  // WCAG luminance coefficients
  static readonly #LUM_COEFF_R = 0.2126;
  static readonly #LUM_COEFF_G = 0.7152;
  static readonly #LUM_COEFF_B = 0.0722;

  // WCAG contrast epsilon
  static readonly #CONTRAST_EPSILON = 0.05;

  // Number formatting for rgba alpha output
  static readonly #RGBA_ALPHA_DECIMALS = 3;

  // -------------------------------------------------------------------------
  // Instance fields
  // -------------------------------------------------------------------------

  readonly #disposer = new Functions({ async: false, settled: true });
  #lastThemeKey = "";

  public constructor(
    protected readonly context: PluginContext,
    protected readonly element: HTMLElement,
    protected readonly opts: FollowThemeAddon.Options = {},
  ) {}

  // -------------------------------------------------------------------------
  // Static methods (declared before private instance methods)
  // -------------------------------------------------------------------------

  /**
   * Resolves a CSS custom property to its final computed color string,
   * even if it is defined via nested var() indirections.
   */
  static #resolveCssColor(
    varName: string,
    attachTo: HTMLElement,
  ): string | null {
    const doc = attachTo.ownerDocument,
      view = doc.defaultView,
      computed = view?.getComputedStyle(attachTo),
      raw = computed?.getPropertyValue(varName) ?? "";

    // Explicitly check for non-empty string and no var() indirection
    if (raw !== "" && !raw.includes("var(")) {
      return raw;
    }

    // Robust path: let the browser resolve var(...) into a concrete color
    const probe = doc.createElement("div");
    probe.style.position = "absolute";
    probe.style.width = "0";
    probe.style.height = "0";
    probe.style.pointerEvents = "none";
    probe.style.visibility = "hidden";
    probe.style.backgroundColor = `var(${varName})`;
    const resolved = ((): string => {
      attachTo.appendChild(probe);
      try {
        return view?.getComputedStyle(probe).backgroundColor ?? "";
      } finally {
        probe.remove();
      }
    })();

    return resolved === "" ? null : resolved;
  }

  static #toCss(color: FollowThemeAddon.RGBA): string {
    const red = Math.round(color.red),
      green = Math.round(color.green),
      blue = Math.round(color.blue);

    if (color.alpha === FollowThemeAddon.#COLOR_ALPHA_OPAQUE) {
      return `rgb(${red}, ${green}, ${blue})`;
    }

    const alpha = Number(
      color.alpha.toFixed(FollowThemeAddon.#RGBA_ALPHA_DECIMALS),
    );

    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  /** WCAG relative luminance of sRGB color */
  static #lum(color: FollowThemeAddon.RGBA): number {
    const toLin = (chan: number): number => {
        const normalized = chan / 255;
        return normalized <= FollowThemeAddon.#SRGB_THRESHOLD
          ? normalized / FollowThemeAddon.#SRGB_DIVISOR
          : ((normalized + FollowThemeAddon.#SRGB_A) /
              FollowThemeAddon.#SRGB_FACTOR) **
              FollowThemeAddon.#SRGB_GAMMA;
      },
      redLin = toLin(color.red),
      greenLin = toLin(color.green),
      blueLin = toLin(color.blue);

    return (
      FollowThemeAddon.#LUM_COEFF_R * redLin +
      FollowThemeAddon.#LUM_COEFF_G * greenLin +
      FollowThemeAddon.#LUM_COEFF_B * blueLin
    );
  }

  /** Contrast ratio per WCAG between two colors */
  static #contrast(
    colorA: FollowThemeAddon.RGBA,
    colorB: FollowThemeAddon.RGBA,
  ): number {
    const lumA = FollowThemeAddon.#lum(colorA),
      lumB = FollowThemeAddon.#lum(colorB),
      [hi, lo] = lumA >= lumB ? [lumA, lumB] : [lumB, lumA];
    return (
      (hi + FollowThemeAddon.#CONTRAST_EPSILON) /
      (lo + FollowThemeAddon.#CONTRAST_EPSILON)
    );
  }

  /** Alpha blend: result = (1 - alpha) * base + alpha * top */
  static #mix(
    top: FollowThemeAddon.RGBA,
    base: FollowThemeAddon.RGBA,
    alpha: number,
  ): FollowThemeAddon.RGBA {
    const clamped = Math.min(
      FollowThemeAddon.#COLOR_ALPHA_MAX,
      Math.max(FollowThemeAddon.#COLOR_ALPHA_MIN, alpha),
    );

    return {
      alpha: FollowThemeAddon.#COLOR_ALPHA_OPAQUE, // Selection is opaque
      blue: base.blue * (1 - clamped) + top.blue * clamped,
      green: base.green * (1 - clamped) + top.green * clamped,
      red: base.red * (1 - clamped) + top.red * clamped,
    };
  }

  /** Pick color with highest contrast vs bg */
  static #bestOf(
    candidates: readonly FollowThemeAddon.RGBA[],
    bg: FollowThemeAddon.RGBA,
  ): FollowThemeAddon.RGBA {
    return candidates.reduce((best, current) => {
      const bestC = FollowThemeAddon.#contrast(best, bg),
        curC = FollowThemeAddon.#contrast(current, bg);
      return curC > bestC ? current : best;
    });
  }

  /** First candidate that meets min contrast, else null */
  static #bestMeetingContrast(
    candidates: FollowThemeAddon.RGBA[],
    bg: FollowThemeAddon.RGBA,
    min: number,
  ): FollowThemeAddon.RGBA | null {
    for (const color of candidates) {
      if (FollowThemeAddon.#contrast(color, bg) >= min) {
        return color;
      }
    }
    return null;
  }

  static #themeKey(theme: ITheme): string {
    return JSON.stringify({
      background: theme.background ?? null,
      cursor: theme.cursor ?? null,
      foreground: theme.foreground ?? null,
      selectionBackground: theme.selectionBackground ?? null,
    });
  }

  // -------------------------------------------------------------------------
  // Public members BEFORE private instance members (member-ordering)
  // -------------------------------------------------------------------------

  public activate(terminal: Terminal): void {
    const update = (): void => {
      // When provided, only apply if enabled() returns true
      if (typeof this.opts.enabled === "function" && !this.opts.enabled()) {
        return;
      }

      const next = this.#computeTheme();
      if (next === null) {
        return;
      }

      // No-op if unchanged
      const key = FollowThemeAddon.#themeKey(next);
      if (key === this.#lastThemeKey) {
        return;
      }
      this.#lastThemeKey = key;

      // Ensure a new object so the terminal notices the change
      terminal.options.theme = {
        ...(terminal.options.theme ?? {}),
        background: next.background,
        cursor: next.cursor,
        foreground: next.foreground,
        selectionBackground: next.selectionBackground,
      };
    };

    // Initial apply
    update();

    const {
        app,
        app: { workspace },
      } = this.context,
      // Keep in sync with app CSS/theme changes (no throttling)
      // Obsidian already takes care of system-level theme changes
      ref = workspace.on("css-change", update);
    this.#disposer.push(() => {
      workspace.offref(ref);
    });

    revealPrivate(
      this.context,
      [app],
      (app2) => {
        // Patch app.setAccentColor to invoke update after it runs
        const unpatchSetAccent = around(app2, {
          setAccentColor(next) {
            return function patched(
              this: typeof app,
              ...args: Parameters<typeof next>
            ): ReturnType<typeof next> {
              next.apply(this, args);
              update();
            };
          },
        });
        this.#disposer.push(unpatchSetAccent);
      },
      noop,
    );
  }

  public dispose(): void {
    this.#disposer.call();
  }

  // -------------------------------------------------------------------------
  // Private instance methods (after public members)
  // -------------------------------------------------------------------------

  /**
   * Derive an xterm theme from host CSS variables. Returns `null` if
   * nothing useful is computed.
   */
  #computeTheme(): {
    readonly background: string;
    readonly cursor: string;
    readonly foreground: string;
    readonly selectionBackground: string;
  } | null {
    const doc = this.element.ownerDocument,
      { defaultView: view, body } = doc;

    if (view === null) {
      return null;
    }

    const bgVar = this.opts.bgVar ?? FollowThemeAddon.#DEFAULT_BG_VAR,
      fgVar = this.opts.fgVar ?? FollowThemeAddon.#DEFAULT_FG_VAR,
      accentVar = this.opts.accentVar ?? FollowThemeAddon.#DEFAULT_ACCENT_VAR,
      // Resolve CSS variables to final, computed css color strings
      bgStr = FollowThemeAddon.#resolveCssColor(bgVar, body)?.trim() ?? "",
      fgVarStr = FollowThemeAddon.#resolveCssColor(fgVar, body)?.trim() ?? "",
      accentStr =
        FollowThemeAddon.#resolveCssColor(accentVar, body)?.trim() ?? "",
      computedBodyColor = view.getComputedStyle(body).color,
      bg = this.#toRGBA(bgStr);
    if (bg === null) {
      // Cannot theme without background
      return null;
    }

    const explicitFg =
        this.#toRGBA(fgVarStr) ?? this.#toRGBA(computedBodyColor),
      autoFg = FollowThemeAddon.#bestOf(
        [FollowThemeAddon.#COLOR_BLACK, FollowThemeAddon.#COLOR_WHITE],
        bg,
      ),
      fg = explicitFg ?? autoFg,
      // Cursor: try accent first but ensure minimum contrast
      minCursorContrast =
        this.opts.minCursorContrast ??
        FollowThemeAddon.#DEFAULT_MIN_CURSOR_CONTRAST,
      cursorCandidates = [
        this.#toRGBA(accentStr),
        fg,
        FollowThemeAddon.#COLOR_BLACK,
        FollowThemeAddon.#COLOR_WHITE,
      ].filter(isNonNil),
      cursor =
        FollowThemeAddon.#bestMeetingContrast(
          cursorCandidates,
          bg,
          minCursorContrast,
        ) ?? FollowThemeAddon.#bestOf(cursorCandidates, bg),
      // Selection: overlay high-contrast color over background
      alpha = Math.min(
        1,
        Math.max(
          0,
          this.opts.selectionAlpha ?? FollowThemeAddon.#DEFAULT_SELECTION_ALPHA,
        ),
      ),
      overlayBase = FollowThemeAddon.#bestOf(
        [FollowThemeAddon.#COLOR_BLACK, FollowThemeAddon.#COLOR_WHITE],
        bg,
      ),
      selection = FollowThemeAddon.#mix(overlayBase, bg, alpha);

    return {
      background: FollowThemeAddon.#toCss(bg),
      cursor: FollowThemeAddon.#toCss(cursor),
      foreground: FollowThemeAddon.#toCss(fg),
      selectionBackground: FollowThemeAddon.#toCss(selection),
    };
  }

  // --- Color utilities (WCAG aware) ----------------------------------------

  /** Parse any CSS color the browser understands into RGBA, or null */
  #toRGBA(input: string | null | undefined): FollowThemeAddon.RGBA | null {
    const doc = this.element.ownerDocument,
      view = doc.defaultView;
    if (!view) {
      return null;
    }

    const span = doc.createElement("span");
    span.style.color = "";
    span.style.color = input ?? "";

    if (span.style.color === "") {
      return null;
    }

    const colorStr = ((): string => {
        doc.body.appendChild(span);
        try {
          return view.getComputedStyle(span).color;
        } finally {
          span.remove();
        }
      })(),
      // Extract numeric channels with named groups
      RGBA_REGEX =
        /rgba?\s*\(\s*(?<red>\d+(?:\.\d+)?)\s*,\s*(?<green>\d+(?:\.\d+)?)\s*,\s*(?<blue>\d+(?:\.\d+)?)\s*(?:,\s*(?<alpha>\d+(?:\.\d+)?)\s*)?\)/iu,
      match = RGBA_REGEX.exec(colorStr);

    if (!match?.groups) {
      return null;
    }

    const red = Number(match.groups["red"]),
      green = Number(match.groups["green"]),
      blue = Number(match.groups["blue"]),
      hasAlpha = !isUndefined(match.groups["alpha"]),
      alpha = hasAlpha
        ? Number(match.groups["alpha"])
        : FollowThemeAddon.#COLOR_ALPHA_OPAQUE;

    if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) {
      return null;
    }
    return { alpha, blue, green, red };
  }
}

export class RendererAddon implements ITerminalAddon {
  public renderer: CanvasAddon | WebglAddon | null = null;
  #terminal: Terminal | null = null;

  public constructor(
    protected readonly canvasSupplier: () => CanvasAddon,
    protected readonly webglSupplier: () => WebglAddon,
  ) {}

  public use(renderer: RendererAddon.RendererOption): void {
    const term = this.#terminal;
    if (!term) {
      return;
    }
    const { element } = term;
    this.renderer?.dispose();
    switch (renderer) {
      case "dom":
        this.renderer = null;
        break;
      case "canvas":
        try {
          const renderer0 = this.canvasSupplier();
          term.loadAddon((this.renderer = renderer0));
          break;
        } catch (error) {
          activeSelf(element).console.warn(error);
          this.use("dom");
        }
        break;
      case "webgl": {
        try {
          const renderer0 = this.webglSupplier(),
            contextLoss = renderer0.onContextLoss(() => {
              try {
                this.use("webgl");
              } finally {
                contextLoss.dispose();
              }
            });
          term.loadAddon((this.renderer = renderer0));
        } catch (error) {
          activeSelf(element).console.warn(error);
          this.use("canvas");
        }
        break;
      }
      // No default
    }
  }

  public activate(terminal: Terminal): void {
    this.#terminal = terminal;
  }

  public dispose(): void {
    this.renderer?.dispose();
    this.#terminal = null;
  }
}
export namespace RendererAddon {
  export const RENDERER_OPTIONS = deepFreeze(["dom", "canvas", "webgl"]);
  export type RendererOption = (typeof RENDERER_OPTIONS)[number];
}

export class RightClickActionAddon implements ITerminalAddon {
  readonly #disposer = new Functions({ async: false, settled: true });

  public constructor(
    protected readonly action: () => RightClickActionAddon.Action = constant(
      "default",
    ),
  ) {}

  public activate(terminal: Terminal): void {
    const { element } = terminal;
    if (!element) {
      throw new Error();
    }
    const contextMenuListener = (ev: MouseEvent): void => {
      const action = this.action();
      (async (): Promise<void> => {
        try {
          switch (action) {
            case "default":
              Menu.forEvent(ev)
                .addItem((item) =>
                  item
                    .setTitle("Copy")
                    .setDisabled(!terminal.hasSelection())
                    .onClick(async () => {
                      if (!terminal.hasSelection()) {
                        return;
                      }
                      await activeSelf(element).navigator.clipboard.writeText(
                        terminal.getSelection(),
                      );
                    }),
                )
                .addItem((item) =>
                  item.setTitle("Paste").onClick(async () => {
                    terminal.paste(
                      await activeSelf(element).navigator.clipboard.readText(),
                    );
                  }),
                )
                .showAtMouseEvent(ev);
              break;
            case "nothing":
              // How to send right click to the terminal?
              break;
            // @ts-expect-error: fallthrough
            case "copyPaste":
              if (terminal.hasSelection()) {
                await activeSelf(element).navigator.clipboard.writeText(
                  terminal.getSelection(),
                );
                terminal.clearSelection();
                break;
              }
            // eslint-disable-next-line no-fallthrough
            case "paste":
              terminal.paste(
                await activeSelf(element).navigator.clipboard.readText(),
              );
              break;
          }
        } catch (error) {
          activeSelf(element).console.error(error);
        }
      })();
      if (action !== "nothing") {
        consumeEvent(ev);
      }
    };
    this.#disposer.push(() => {
      element.removeEventListener("contextmenu", contextMenuListener);
    });
    element.addEventListener("contextmenu", contextMenuListener);
  }

  public dispose(): void {
    this.#disposer.call();
  }
}
export namespace RightClickActionAddon {
  export const ACTIONS = deepFreeze([
    "copyPaste",
    "default",
    "nothing",
    "paste",
  ]);
  export type Action = (typeof ACTIONS)[number];
}
