import {
  DEFAULT_PYTHON_EXECUTABLE,
  DEFAULT_SUCCESS_EXIT_CODES,
  WINDOWS_CMD_PATH,
} from "../magic.js";
import type {
  ILinkHandler,
  ILogger,
  ITheme,
  IWindowOptions,
  IWindowsPty,
} from "@xterm/xterm";
import {
  activeSelf,
  deepFreeze,
  openExternal,
  typedKeys,
} from "@polyipseity/obsidian-plugin-library";
import type { Pseudoterminal } from "./pseudoterminal.js";
import type { Settings } from "../settings-data.js";

export const DEFAULT_LINK_HANDLER: ILinkHandler = deepFreeze({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    activate(event, text, range) {
      openExternal(activeSelf(event), text);
    },
  }),
  DEFAULT_LOGGER: ILogger = deepFreeze({
    debug(message, ...args: readonly unknown[]) {
      self.console.debug(message, ...args);
    },
    error(message, ...args: readonly unknown[]) {
      self.console.error(message, ...args);
    },
    info(message, ...args: readonly unknown[]) {
      self.console.info(message, ...args);
    },
    trace(message, ...args: readonly unknown[]) {
      self.console.trace(message, ...args);
    },
    warn(message, ...args: readonly unknown[]) {
      self.console.warn(message, ...args);
    },
  }),
  DEFAULT_TERMINAL_OPTIONS: Settings.Profile.TerminalOptions = deepFreeze({
    documentOverride: null,
  }),
  DEFAULT_THEME: ITheme = deepFreeze({}),
  DEFAULT_WINDOW_OPTIONS: IWindowOptions = deepFreeze({}),
  DEFAULT_WINDOWS_PTY: IWindowsPty = deepFreeze({});

export const WEZTERM_STYLE_FONT_FAMILY =
  '"JetBrains Mono", "Cascadia Mono", "Cascadia Code", "SF Mono", "Menlo", "Consolas", monospace';
export const WEZTERM_STYLE_THEME: ITheme = deepFreeze({
  background: "#0b1020",
  black: "#1f2335",
  blue: "#7aa2f7",
  brightBlack: "#414868",
  brightBlue: "#7dcfff",
  brightCyan: "#4fd6be",
  brightGreen: "#9ece6a",
  brightMagenta: "#bb9af7",
  brightRed: "#f7768e",
  brightWhite: "#c0caf5",
  brightYellow: "#e0af68",
  cursor: "#c0caf5",
  cursorAccent: "#0b1020",
  cyan: "#7dcfff",
  foreground: "#c0caf5",
  green: "#9ece6a",
  magenta: "#bb9af7",
  red: "#f7768e",
  selectionBackground: "#2f3b66",
  selectionForeground: "#f2f2f3",
  selectionInactiveBackground: "#202640",
  white: "#a9b1d6",
  yellow: "#e0af68",
});
export const WEZTERM_STYLE_TERMINAL_OPTIONS: Settings.Profile.TerminalOptions =
  deepFreeze({
    ...DEFAULT_TERMINAL_OPTIONS,
    cursorBlink: true,
    cursorStyle: "block",
    fontFamily: WEZTERM_STYLE_FONT_FAMILY,
    fontSize: 14,
    fontWeight: "400",
    fontWeightBold: "600",
    lineHeight: 1.12,
    scrollback: 200_000,
    smoothScrollDuration: 0,
    theme: WEZTERM_STYLE_THEME,
  });

export interface ProfilePresets0 {
  readonly empty: Settings.Profile.Empty;
  readonly developerConsole: Settings.Profile.DeveloperConsole;

  readonly cmdExternal: Settings.Profile.External;
  readonly gnomeTerminalExternal: Settings.Profile.External;
  readonly iTerm2External: Settings.Profile.External;
  readonly konsoleExternal: Settings.Profile.External;
  readonly powershellExternal: Settings.Profile.External;
  readonly pwshExternal: Settings.Profile.External;
  readonly terminalMacOSExternal: Settings.Profile.External;
  readonly wtExternal: Settings.Profile.External;
  readonly xtermExternal: Settings.Profile.External;

  readonly bashIntegrated: Settings.Profile.Integrated;
  readonly cmdIntegrated: Settings.Profile.Integrated;
  readonly dashIntegrated: Settings.Profile.Integrated;
  readonly gitBashIntegrated: Settings.Profile.Integrated;
  readonly powershellIntegrated: Settings.Profile.Integrated;
  readonly pwshIntegrated: Settings.Profile.Integrated;
  readonly shIntegrated: Settings.Profile.Integrated;
  readonly wslIntegrated: Settings.Profile.Integrated;
  readonly zshIntegrated: Settings.Profile.Integrated;
}
type ExternalDefaults = Readonly<
  Record<
    `${Pseudoterminal.SupportedPlatforms[number]}ExternalDefault`,
    Settings.Profile.External
  >
>;
type IntegratedDefaults = Readonly<
  Record<
    `${Pseudoterminal.SupportedPlatforms[number]}IntegratedDefault`,
    Settings.Profile.Integrated
  >
>;
export interface ProfilePresets
  extends ProfilePresets0, ExternalDefaults, IntegratedDefaults {}
const PROFILE_PRESETS0 = deepFreeze({
  bashIntegrated: {
    args: ["--login"],
    executable: "/bin/bash",
    followTheme: false,
    name: "",
    platforms: { darwin: true, linux: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: false,
  },
  cmdExternal: {
    args: [],
    executable: WINDOWS_CMD_PATH,
    followTheme: true,
    name: "",
    platforms: { win32: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  cmdIntegrated: {
    args: [],
    executable: WINDOWS_CMD_PATH,
    followTheme: false,
    name: "",
    platforms: { win32: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: true,
  },
  dashIntegrated: {
    args: [],
    executable: "/bin/dash",
    followTheme: false,
    name: "",
    platforms: { darwin: true, linux: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: false,
  },
  developerConsole: {
    followTheme: true,
    name: "",
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "developerConsole",
  },
  empty: {
    followTheme: true,
    name: "",
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "",
  },
  gitBashIntegrated: {
    args: ["--login"],
    executable: "C:\\Program Files\\Git\\bin\\bash.exe",
    followTheme: false,
    name: "",
    platforms: { win32: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: true,
  },
  gnomeTerminalExternal: {
    args: [],
    executable: "gnome-terminal",
    followTheme: true,
    name: "",
    platforms: { linux: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  iTerm2External: {
    args: ['"$PWD"'],
    executable: "/Applications/iTerm.app/Contents/MacOS/iTerm2",
    followTheme: true,
    name: "",
    platforms: { darwin: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  konsoleExternal: {
    args: [],
    executable: "konsole",
    followTheme: true,
    name: "",
    platforms: { linux: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  powershellExternal: {
    args: [],
    executable: "powershell",
    followTheme: true,
    name: "",
    platforms: { win32: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  powershellIntegrated: {
    args: ["-NoLogo"],
    executable: "powershell",
    followTheme: false,
    name: "",
    platforms: { win32: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: true,
  },
  pwshExternal: {
    args: [],
    executable: "pwsh",
    followTheme: true,
    name: "",
    platforms: { darwin: true, linux: true, win32: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  pwshIntegrated: {
    args: ["-NoLogo"],
    executable: "pwsh",
    followTheme: false,
    name: "",
    platforms: { darwin: true, linux: true, win32: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: true,
  },
  shIntegrated: {
    args: [],
    executable: "/bin/sh",
    followTheme: false,
    name: "",
    platforms: { darwin: true, linux: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: false,
  },
  terminalMacOSExternal: {
    args: ['"$PWD"'],
    executable:
      "/System/Applications/Utilities/Terminal.app/Contents/macOS/Terminal",
    followTheme: true,
    name: "",
    platforms: { darwin: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  wslIntegrated: {
    args: [],
    executable: "C:\\Windows\\System32\\wsl.exe",
    followTheme: false,
    name: "",
    platforms: { win32: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: true,
  },
  wtExternal: {
    args: [],
    executable: "wt",
    followTheme: true,
    name: "",
    platforms: { win32: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  xtermExternal: {
    args: [],
    executable: "xterm",
    followTheme: true,
    name: "",
    platforms: { darwin: true, linux: true },
    restoreHistory: false,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: DEFAULT_TERMINAL_OPTIONS,
    type: "external",
  },
  zshIntegrated: {
    args: ["--login"],
    executable: "/bin/zsh",
    followTheme: false,
    name: "",
    platforms: { darwin: true, linux: true },
    pythonExecutable: DEFAULT_PYTHON_EXECUTABLE,
    restoreHistory: true,
    rightClickAction: "copyPaste",
    successExitCodes: DEFAULT_SUCCESS_EXIT_CODES,
    terminalOptions: WEZTERM_STYLE_TERMINAL_OPTIONS,
    type: "integrated",
    useWin32Conhost: false,
  },
}) satisfies ProfilePresets0;
export const PROFILE_PRESETS = deepFreeze({
  ...PROFILE_PRESETS0,
  darwinExternalDefault: {
    ...PROFILE_PRESETS0.terminalMacOSExternal,
    platforms: { darwin: true },
  },
  darwinIntegratedDefault: {
    ...PROFILE_PRESETS0.zshIntegrated,
    platforms: { darwin: true },
  },
  linuxExternalDefault: {
    ...PROFILE_PRESETS0.xtermExternal,
    platforms: { linux: true },
  },
  linuxIntegratedDefault: {
    ...PROFILE_PRESETS0.shIntegrated,
    platforms: { linux: true },
  },
  win32ExternalDefault: {
    ...PROFILE_PRESETS0.cmdExternal,
    platforms: { win32: true },
  },
  win32IntegratedDefault: {
    ...PROFILE_PRESETS0.powershellIntegrated,
    platforms: { win32: true },
  },
}) satisfies ProfilePresets;
export type ProfilePresetKeys = readonly [
  "empty",
  "developerConsole",

  "cmdExternal",
  "gnomeTerminalExternal",
  "iTerm2External",
  "konsoleExternal",
  "powershellExternal",
  "pwshExternal",
  "terminalMacOSExternal",
  "wtExternal",
  "xtermExternal",

  "bashIntegrated",
  "cmdIntegrated",
  "dashIntegrated",
  "gitBashIntegrated",
  "powershellIntegrated",
  "pwshIntegrated",
  "shIntegrated",
  "wslIntegrated",
  "zshIntegrated",

  "darwinExternalDefault",
  "linuxExternalDefault",
  "win32ExternalDefault",

  "darwinIntegratedDefault",
  "linuxIntegratedDefault",
  "win32IntegratedDefault",
];
export const PROFILE_PRESET_KEYS =
  typedKeys<ProfilePresetKeys>()(PROFILE_PRESETS);
export const PROFILE_PRESET_ORDERED_KEYS = deepFreeze(
  PROFILE_PRESET_KEYS.reduce<ProfilePresetKeys[number][]>((prev, cur) => {
    if (cur === "empty") {
      prev.unshift(cur);
    } else {
      prev.push(cur);
    }
    return prev;
  }, []),
);
