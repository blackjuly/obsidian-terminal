import {
  type AnyObject,
  Platform,
  deepFreeze,
  dynamicRequire,
  launderUnchecked,
} from "@polyipseity/obsidian-plugin-library";
import {
  Pseudoterminal,
  RefPsuedoterminal,
  TextPseudoterminal,
} from "./pseudoterminal.js";
import {
  SUPPORTS_EXTERNAL_TERMINAL_EMULATOR,
  spawnExternalTerminalEmulator,
} from "./emulator.js";
import type { AsyncOrSync } from "ts-essentials";
import { BUNDLE } from "../import.js";
import type { Settings } from "../settings-data.js";
import type { TerminalPlugin } from "../main.js";
import { FileSystemAdapter } from "obsidian";

const fsPromises = dynamicRequire<typeof import("node:fs/promises")>(
    BUNDLE,
    "node:fs/promises",
  ),
  pathModule = dynamicRequire<typeof import("node:path")>(BUNDLE, "node:path"),
  processModule = dynamicRequire<typeof import("node:process")>(
    BUNDLE,
    "node:process",
  );

async function fileExists(path: string): Promise<boolean> {
  try {
    const fs = await fsPromises;
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveWezTermExecutable(
  context: TerminalPlugin,
): Promise<string | null> {
  if (Platform.CURRENT !== "win32") {
    return null;
  }
  const raw = context.settings.value.win32WezTermExecutable.trim(),
    path = await pathModule;
  if (raw) {
    const normalized = raw.replace(/^"+|"+$/g, ""),
      lower = normalized.toLowerCase(),
      candidate = lower.endsWith("wezterm-gui.exe")
        ? normalized
        : lower.endsWith("wezterm.exe")
          ? path.join(path.dirname(normalized), "wezterm-gui.exe")
          : path.join(normalized, "wezterm-gui.exe");
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  const process2 = await processModule,
    envPath = process2.env.PATH ?? "";
  for (const entry of envPath.split(path.delimiter)) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const candidate = path.join(trimmed, "wezterm-gui.exe");
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

export interface OpenOptions {
  readonly cwd?: string | undefined;
  readonly terminal?: string | undefined;
}
export const PROFILE_PROPERTIES: {
  readonly [key in Settings.Profile.Type]: {
    readonly available: boolean;
    readonly valid: boolean;
    readonly integratable: boolean;
    readonly opener: (
      context: TerminalPlugin,
      profile: Settings.Profile.Typed<key>,
      options?: OpenOptions,
    ) => AsyncOrSync<RefPsuedoterminal<Pseudoterminal> | null>;
  };
} = deepFreeze({
  "": {
    available: true,
    integratable: true,
    opener() {
      return new RefPsuedoterminal(new TextPseudoterminal());
    },
    valid: true,
  },
  developerConsole: {
    available: true,
    integratable: true,
    async opener(context: TerminalPlugin) {
      return (await context.developerConsolePTY.onLoaded)().dup();
    },
    valid: true,
  },
  external: {
    available: SUPPORTS_EXTERNAL_TERMINAL_EMULATOR,
    integratable: false,
    async opener(
      context: TerminalPlugin,
      profile: Settings.Profile.Typed<"external">,
      options?: OpenOptions,
    ) {
      const cwd =
          options?.cwd ??
          (Platform.CURRENT === "win32"
            ? (() => {
                const { adapter } = context.app.vault;
                return adapter instanceof FileSystemAdapter
                  ? adapter.getBasePath()
                  : void 0;
              })()
            : void 0),
        weztermExecutable = await resolveWezTermExecutable(context),
        useWezTerm = Platform.CURRENT === "win32" && weztermExecutable !== null,
        executable = useWezTerm ? weztermExecutable : profile.executable,
        args = useWezTerm
          ? cwd
            ? ["start", "--cwd", cwd]
            : ["start"]
          : profile.args;
      await spawnExternalTerminalEmulator(executable, args, cwd);
      return null;
    },
    valid: true,
  },
  integrated: {
    available: Pseudoterminal.PLATFORM_PSEUDOTERMINAL !== null,
    integratable: true,
    opener(
      context: TerminalPlugin,
      profile: Settings.Profile.Typed<"integrated">,
      options?: OpenOptions,
    ) {
      if (!Pseudoterminal.PLATFORM_PSEUDOTERMINAL) {
        return null;
      }
      const { args, platforms, useWin32Conhost, executable, pythonExecutable } =
          profile,
        supported = launderUnchecked<AnyObject>(platforms)[Platform.CURRENT];
      if (typeof supported !== "boolean" || !supported) {
        return null;
      }
      return new RefPsuedoterminal(
        new Pseudoterminal.PLATFORM_PSEUDOTERMINAL(context, {
          args,
          cwd: options?.cwd,
          executable,
          pythonExecutable: pythonExecutable || void 0,
          terminal: options?.terminal,
          useWin32Conhost,
        }),
      );
    },
    valid: true,
  },
  invalid: {
    available: true,
    integratable: true,
    opener() {
      return null;
    },
    valid: false,
  },
});

export function openProfile<T extends Settings.Profile.Type>(
  context: TerminalPlugin,
  profile: Settings.Profile.Typed<T>,
  options?: OpenOptions,
): AsyncOrSync<RefPsuedoterminal<Pseudoterminal> | null> {
  const type0: T = profile.type;
  return PROFILE_PROPERTIES[type0].opener(context, profile, options);
}
