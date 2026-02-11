import {
  AdvancedSettingTab,
  cloneAsWritable,
  closeSetting,
  createChildElement,
  createDocumentFragment,
  linkSetting,
  Platform,
  registerSettingsCommands,
  resetButton,
  setTextToEnum,
} from "@polyipseity/obsidian-plugin-library";
import { ProfileListModal } from "./modals.js";
import { Settings } from "./settings-data.js";
import type { TerminalPlugin } from "./main.js";
import type { loadDocumentations } from "./documentations.js";
import {
  WEZTERM_STYLE_FONT_FAMILY,
  WEZTERM_STYLE_TERMINAL_OPTIONS,
  WEZTERM_STYLE_THEME,
} from "./terminal/profile-presets.js";
import { RightClickActionAddon } from "./terminal/emulator-addons.js";
import semverLt from "semver/functions/lt.js";
import { size } from "lodash-es";

export class SettingTab extends AdvancedSettingTab<Settings> {
  public constructor(
    protected override readonly context: TerminalPlugin,
    protected readonly docs: loadDocumentations.Loaded,
  ) {
    super(context);
  }

  protected override onLoad(): void {
    super.onLoad();
    const {
      containerEl,
      context,
      context: {
        language: { value: i18n },
        localSettings,
        settings,
        version,
      },
      docs,
      ui,
    } = this;
    this.newDescriptionWidget();
    this.newLanguageWidget(
      Settings.DEFAULTABLE_LANGUAGES,
      (language) =>
        language
          ? i18n.t(`language:${language}`)
          : i18n.t("settings.language-default"),
      Settings.DEFAULT,
    );
    ui.newSetting(containerEl, (setting) => {
      setting
        .setName(i18n.t("settings.documentation"))
        .addButton((button) =>
          button
            .setIcon(i18n.t("asset:settings.documentations.donate-icon"))
            .setTooltip(i18n.t("settings.documentations.donate"))
            .setCta()
            .onClick(() => {
              docs.open("donate");
            }),
        )
        .addButton((button) =>
          button
            .setIcon(i18n.t("asset:settings.documentations.readme-icon"))
            .setTooltip(i18n.t("settings.documentations.readme"))
            .setCta()
            .onClick(() => {
              docs.open("readme");
              closeSetting(containerEl);
            }),
        )
        .addButton((button) => {
          button
            .setIcon(i18n.t("asset:settings.documentations.changelog-icon"))
            .setTooltip(i18n.t("settings.documentations.changelog"))
            .onClick(() => {
              docs.open("changelog");
              closeSetting(containerEl);
            });
          if (
            version === null ||
            semverLt(localSettings.value.lastReadChangelogVersion, version)
          ) {
            button.setCta();
          }
        });
    });
    this.newAllSettingsWidget(Settings.DEFAULT, Settings.fix);
    ui.newSetting(containerEl, (setting) => {
      setting
        .setName(i18n.t("settings.add-to-command"))
        .addToggle(
          linkSetting(
            () => settings.value.addToCommand,
            async (value) =>
              settings.mutate((settingsM) => {
                settingsM.addToCommand = value;
              }),
            () => {
              this.postMutate();
            },
          ),
        )
        .addExtraButton(
          resetButton(
            i18n.t("asset:settings.add-to-command-icon"),
            i18n.t("settings.reset"),
            async () =>
              settings.mutate((settingsM) => {
                settingsM.addToCommand = Settings.DEFAULT.addToCommand;
              }),
            () => {
              this.postMutate();
            },
          ),
        );
    })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.add-to-context-menu"))
          .addToggle(
            linkSetting(
              () => settings.value.addToContextMenu,
              async (value) =>
                settings.mutate((settingsM) => {
                  settingsM.addToContextMenu = value;
                }),
              () => {
                this.postMutate();
              },
            ),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.add-to-context-menu-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.addToContextMenu =
                    Settings.DEFAULT.addToContextMenu;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.profiles"))
          .setDesc(
            i18n.t("settings.profiles-description", {
              count: size(settings.value.profiles),
              interpolation: { escapeValue: false },
            }),
          )
          .addButton((button) =>
            button
              .setIcon(i18n.t("asset:settings.profiles-edit-icon"))
              .setTooltip(i18n.t("settings.profiles-edit"))
              .onClick(() => {
                new ProfileListModal(
                  context,
                  Object.entries(settings.value.profiles),
                  {
                    callback: async (data): Promise<void> => {
                      await settings.mutate((settingsM) => {
                        settingsM.profiles = Object.fromEntries(data);
                      });
                      this.postMutate();
                    },
                    description: (): string =>
                      i18n.t("settings.profile-list.description"),
                  },
                ).open();
              }),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.profiles-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.profiles = cloneAsWritable(
                    Settings.DEFAULT.profiles,
                  );
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      });
    const getDefaultIntegratedProfile =
      (): Settings.Profile.Typed<"integrated"> | null =>
        Settings.Profile.defaultOfType(
          "integrated",
          settings.value.profiles,
          Platform.CURRENT,
        );
    const mutateDefaultIntegratedProfile = async (
      mutator: (profile: Settings.Profile.Typed<"integrated">) => void,
    ): Promise<void> => {
      await settings.mutate((settingsM) => {
        for (const profile0 of Object.values(settingsM.profiles)) {
          if (
            Settings.Profile.isType("integrated", profile0) &&
            Settings.Profile.isCompatible(profile0, Platform.CURRENT)
          ) {
            mutator(profile0);
            break;
          }
        }
      });
    };
    const shellPresets = (() => {
      switch (Platform.CURRENT) {
        case "darwin":
          return {
            bash: { args: ["--login"], executable: "/bin/bash" },
            pwsh: { args: ["-NoLogo"], executable: "pwsh" },
            zsh: { args: ["--login"], executable: "/bin/zsh" },
          };
        case "linux":
          return {
            bash: { args: ["--login"], executable: "/bin/bash" },
            pwsh: { args: ["-NoLogo"], executable: "pwsh" },
            sh: { args: [], executable: "/bin/sh" },
          };
        case "win32":
          return {
            cmd: { args: [], executable: "cmd", useWin32Conhost: true },
            gitBash: {
              args: ["--login"],
              executable: "C:\\Program Files\\Git\\bin\\bash.exe",
              useWin32Conhost: true,
            },
            powershell: {
              args: ["-NoLogo"],
              executable: "powershell",
              useWin32Conhost: true,
            },
            pwsh: {
              args: ["-NoLogo"],
              executable: "pwsh",
              useWin32Conhost: true,
            },
            wsl: {
              args: [],
              executable: "C:\\Windows\\System32\\wsl.exe",
              useWin32Conhost: true,
            },
          };
      }
    })();
    const defaultShellPreset = (() => {
      switch (Platform.CURRENT) {
        case "darwin":
          return "zsh";
        case "linux":
          return "bash";
        case "win32":
          return "powershell";
      }
    })();
    const customShellOption = "__custom__";
    const shellPresetLabels = Object.fromEntries(
      Object.keys(shellPresets).map((key) => [
        key,
        i18n.t(`settings.embedded-terminal-shell-options.${key}`),
      ]),
    );
    shellPresetLabels[customShellOption] = i18n.t(
      "settings.embedded-terminal-shell-options.custom",
    );
    const arraysEqual = (
      left: readonly string[],
      right: readonly string[],
    ): boolean =>
      left.length === right.length &&
      left.every((value, index) => value === right[index]);
    const currentShellPreset = (): string => {
      const profile = getDefaultIntegratedProfile();
      if (!profile) {
        return customShellOption;
      }
      for (const [key, value] of Object.entries(shellPresets)) {
        if (
          value.executable === profile.executable &&
          arraysEqual(value.args, profile.args)
        ) {
          return key;
        }
      }
      return customShellOption;
    };
    const followsWeztermTheme = (
      theme: Settings.Profile.TerminalOptions["theme"] | undefined,
    ): boolean => {
      if (!theme) {
        return false;
      }
      const theme0 = theme as Record<string, unknown>;
      return Object.entries(WEZTERM_STYLE_THEME).every(
        ([key, value]) => theme0[key] === value,
      );
    };
    const themePresetOptions = ["weztermDark", "followObsidian", "custom"];
    const currentThemePreset = (): string => {
      const profile = getDefaultIntegratedProfile();
      if (!profile) {
        return "weztermDark";
      }
      if (profile.followTheme) {
        return "followObsidian";
      }
      if (followsWeztermTheme(profile.terminalOptions.theme)) {
        return "weztermDark";
      }
      return "custom";
    };
    const noIntegratedProfileDescription = (): string =>
      i18n.t("settings.embedded-terminal-no-integrated-profile");
    this.newSectionWidget(() =>
      i18n.t("settings.embedded-terminal-experience"),
    );
    ui.newSetting(containerEl, (setting) => {
      const profile = getDefaultIntegratedProfile();
      setting
        .setName(i18n.t("settings.embedded-terminal-target-profile"))
        .setDesc(
          profile
            ? i18n.t("settings.embedded-terminal-target-profile-description", {
                interpolation: { escapeValue: false },
                name: Settings.Profile.name(profile) || profile.executable,
              })
            : noIntegratedProfileDescription(),
        );
    })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-theme-preset"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t("settings.embedded-terminal-theme-preset-description")
              : noIntegratedProfileDescription(),
          )
          .addDropdown(
            linkSetting(
              () => currentThemePreset(),
              setTextToEnum(themePresetOptions, async (value) => {
                switch (value) {
                  case "followObsidian":
                    await mutateDefaultIntegratedProfile((profile) => {
                      profile.followTheme = true;
                    });
                    break;
                  case "weztermDark":
                    await mutateDefaultIntegratedProfile((profile) => {
                      profile.followTheme = false;
                      profile.terminalOptions.theme =
                        cloneAsWritable(WEZTERM_STYLE_THEME);
                    });
                    break;
                }
              }),
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                },
                pre: (dropdown) => {
                  dropdown.addOptions(
                    Object.fromEntries(
                      themePresetOptions.map((option) => [
                        option,
                        i18n.t(
                          `settings.embedded-terminal-theme-preset-options.${option}`,
                        ),
                      ]),
                    ),
                  );
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "paintbrush",
              i18n.t("settings.reset"),
              async () =>
                mutateDefaultIntegratedProfile((profile) => {
                  profile.followTheme = false;
                  profile.terminalOptions.theme =
                    cloneAsWritable(WEZTERM_STYLE_THEME);
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-font-family"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t("settings.embedded-terminal-font-family-description")
              : noIntegratedProfileDescription(),
          )
          .addText(
            linkSetting(
              () =>
                getDefaultIntegratedProfile()?.terminalOptions.fontFamily ?? "",
              (value) =>
                mutateDefaultIntegratedProfile((profile) => {
                  if (value) {
                    profile.terminalOptions.fontFamily = value;
                  } else {
                    delete profile.terminalOptions.fontFamily;
                  }
                }),
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                  component.setPlaceholder(WEZTERM_STYLE_FONT_FAMILY);
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "type",
              i18n.t("settings.reset"),
              async () =>
                mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.fontFamily =
                    WEZTERM_STYLE_FONT_FAMILY;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-font-size"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t("settings.embedded-terminal-font-size-description")
              : noIntegratedProfileDescription(),
          )
          .addText(
            linkSetting(
              () =>
                getDefaultIntegratedProfile()?.terminalOptions.fontSize?.toString() ??
                "",
              async (value) => {
                const trimmed = value.trim();
                if (!trimmed) {
                  await mutateDefaultIntegratedProfile((profile) => {
                    delete profile.terminalOptions.fontSize;
                  });
                  return;
                }
                const parsed = Number(trimmed);
                if (!isFinite(parsed)) {
                  return;
                }
                await mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.fontSize = parsed;
                });
              },
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.inputEl.type = "number";
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                  component.setPlaceholder(
                    WEZTERM_STYLE_TERMINAL_OPTIONS.fontSize?.toString() ?? "",
                  );
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "type",
              i18n.t("settings.reset"),
              async () =>
                mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.fontSize =
                    WEZTERM_STYLE_TERMINAL_OPTIONS.fontSize;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-line-height"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t("settings.embedded-terminal-line-height-description")
              : noIntegratedProfileDescription(),
          )
          .addText(
            linkSetting(
              () =>
                getDefaultIntegratedProfile()?.terminalOptions.lineHeight?.toString() ??
                "",
              async (value) => {
                const trimmed = value.trim();
                if (!trimmed) {
                  await mutateDefaultIntegratedProfile((profile) => {
                    delete profile.terminalOptions.lineHeight;
                  });
                  return;
                }
                const parsed = Number(trimmed);
                if (!isFinite(parsed)) {
                  return;
                }
                await mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.lineHeight = parsed;
                });
              },
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.inputEl.type = "number";
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                  component.setPlaceholder(
                    WEZTERM_STYLE_TERMINAL_OPTIONS.lineHeight?.toString() ?? "",
                  );
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "type",
              i18n.t("settings.reset"),
              async () =>
                mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.lineHeight =
                    WEZTERM_STYLE_TERMINAL_OPTIONS.lineHeight;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-scrollback"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t("settings.embedded-terminal-scrollback-description")
              : noIntegratedProfileDescription(),
          )
          .addText(
            linkSetting(
              () =>
                getDefaultIntegratedProfile()?.terminalOptions.scrollback?.toString() ??
                "",
              async (value) => {
                const trimmed = value.trim();
                if (!trimmed) {
                  await mutateDefaultIntegratedProfile((profile) => {
                    delete profile.terminalOptions.scrollback;
                  });
                  return;
                }
                const parsed = Number(trimmed);
                if (!isFinite(parsed)) {
                  return;
                }
                await mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.scrollback = Math.max(
                    Math.trunc(parsed),
                    1,
                  );
                });
              },
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.inputEl.type = "number";
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                  component.setPlaceholder(
                    WEZTERM_STYLE_TERMINAL_OPTIONS.scrollback?.toString() ?? "",
                  );
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "history",
              i18n.t("settings.reset"),
              async () =>
                mutateDefaultIntegratedProfile((profile) => {
                  profile.terminalOptions.scrollback =
                    WEZTERM_STYLE_TERMINAL_OPTIONS.scrollback;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-right-click-action"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t(
                  "settings.embedded-terminal-right-click-action-description",
                )
              : noIntegratedProfileDescription(),
          )
          .addDropdown(
            linkSetting(
              () =>
                getDefaultIntegratedProfile()?.rightClickAction ?? "copyPaste",
              setTextToEnum(RightClickActionAddon.ACTIONS, async (value) => {
                await mutateDefaultIntegratedProfile((profile) => {
                  profile.rightClickAction = value;
                });
              }),
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                },
                pre: (dropdown) => {
                  dropdown.addOptions(
                    Object.fromEntries(
                      RightClickActionAddon.ACTIONS.map((action) => [
                        action,
                        i18n.t(
                          `settings.embedded-terminal-right-click-options.${action}`,
                        ),
                      ]),
                    ),
                  );
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "mouse-pointer-click",
              i18n.t("settings.reset"),
              async () =>
                mutateDefaultIntegratedProfile((profile) => {
                  profile.rightClickAction = "copyPaste";
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.embedded-terminal-default-shell"))
          .setDesc(
            getDefaultIntegratedProfile()
              ? i18n.t("settings.embedded-terminal-default-shell-description")
              : noIntegratedProfileDescription(),
          )
          .addDropdown(
            linkSetting(
              () => currentShellPreset(),
              async (value) => {
                const selected =
                  shellPresets[value as keyof typeof shellPresets];
                if (!selected) {
                  return;
                }
                await mutateDefaultIntegratedProfile((profile) => {
                  profile.executable = selected.executable;
                  profile.args = cloneAsWritable(selected.args);
                  if (Platform.CURRENT === "win32") {
                    profile.useWin32Conhost = selected.useWin32Conhost ?? false;
                  }
                });
              },
              () => {
                this.postMutate();
              },
              {
                post(component) {
                  component.setDisabled(getDefaultIntegratedProfile() === null);
                },
                pre: (dropdown) => {
                  dropdown.addOptions(shellPresetLabels);
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              "terminal-square",
              i18n.t("settings.reset"),
              async () => {
                const selected =
                  shellPresets[defaultShellPreset as keyof typeof shellPresets];
                if (!selected) {
                  return;
                }
                await mutateDefaultIntegratedProfile((profile) => {
                  profile.executable = selected.executable;
                  profile.args = cloneAsWritable(selected.args);
                  if (Platform.CURRENT === "win32") {
                    profile.useWin32Conhost = selected.useWin32Conhost ?? false;
                  }
                });
              },
              () => {
                this.postMutate();
              },
            ),
          );
      });
    this.newSectionWidget(() => i18n.t("settings.instancing"));
    ui.newSetting(containerEl, (setting) => {
      setting
        .setName(i18n.t("settings.new-instance-behavior"))
        .addDropdown(
          linkSetting(
            (): string => settings.value.newInstanceBehavior,
            setTextToEnum(Settings.NEW_INSTANCE_BEHAVIORS, async (value) =>
              settings.mutate((settingsM) => {
                settingsM.newInstanceBehavior = value;
              }),
            ),
            () => {
              this.postMutate();
            },
            {
              pre: (dropdown) => {
                dropdown.addOptions(
                  Object.fromEntries(
                    Settings.NEW_INSTANCE_BEHAVIORS.map((value) => [
                      value,
                      i18n.t(`settings.new-instance-behaviors.${value}`),
                    ]),
                  ),
                );
              },
            },
          ),
        )
        .addExtraButton(
          resetButton(
            i18n.t("asset:settings.new-instance-behavior-icon"),
            i18n.t("settings.reset"),
            async () =>
              settings.mutate((settingsM) => {
                settingsM.newInstanceBehavior =
                  Settings.DEFAULT.newInstanceBehavior;
              }),
            () => {
              this.postMutate();
            },
          ),
        );
    })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.create-instance-near-existing-ones"))
          .setDesc(
            i18n.t("settings.create-instance-near-existing-ones-description"),
          )
          .addToggle(
            linkSetting(
              () => settings.value.createInstanceNearExistingOnes,
              async (value) =>
                settings.mutate((settingsM) => {
                  settingsM.createInstanceNearExistingOnes = value;
                }),
              () => {
                this.postMutate();
              },
            ),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.create-instance-near-existing-ones-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.createInstanceNearExistingOnes =
                    Settings.DEFAULT.createInstanceNearExistingOnes;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.focus-on-new-instance"))
          .addToggle(
            linkSetting(
              () => settings.value.focusOnNewInstance,
              async (value) =>
                settings.mutate((settingsM) => {
                  settingsM.focusOnNewInstance = value;
                }),
              () => {
                this.postMutate();
              },
            ),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.focus-on-new-instance-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.focusOnNewInstance =
                    Settings.DEFAULT.focusOnNewInstance;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.pin-new-instance"))
          .addToggle(
            linkSetting(
              () => settings.value.pinNewInstance,
              async (value) =>
                settings.mutate((settingsM) => {
                  settingsM.pinNewInstance = value;
                }),
              () => {
                this.postMutate();
              },
            ),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.pin-new-instance-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.pinNewInstance = Settings.DEFAULT.pinNewInstance;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      });
    this.newSectionWidget(() => i18n.t("settings.interface"));
    ui.newSetting(containerEl, (setting) => {
      setting
        .setName(i18n.t("settings.open-changelog-on-update"))
        .addToggle(
          linkSetting(
            () => settings.value.openChangelogOnUpdate,
            async (value) =>
              settings.mutate((settingsM) => {
                settingsM.openChangelogOnUpdate = value;
              }),
            () => {
              this.postMutate();
            },
          ),
        )
        .addExtraButton(
          resetButton(
            i18n.t("asset:settings.open-changelog-on-update-icon"),
            i18n.t("settings.reset"),
            async () =>
              settings.mutate((settingsM) => {
                settingsM.openChangelogOnUpdate =
                  Settings.DEFAULT.openChangelogOnUpdate;
              }),
            () => {
              this.postMutate();
            },
          ),
        );
    }).newSetting(containerEl, (setting) => {
      setting
        .setName(i18n.t("settings.hide-status-bar"))
        .addDropdown(
          linkSetting(
            (): string => settings.value.hideStatusBar,
            setTextToEnum(Settings.HIDE_STATUS_BAR_OPTIONS, async (value) =>
              settings.mutate((settingsM) => {
                settingsM.hideStatusBar = value;
              }),
            ),
            () => {
              this.postMutate();
            },
            {
              pre: (dropdown) => {
                dropdown.addOptions(
                  Object.fromEntries(
                    Settings.HIDE_STATUS_BAR_OPTIONS.map((value) => [
                      value,
                      i18n.t(`settings.hide-status-bar-options.${value}`),
                    ]),
                  ),
                );
              },
            },
          ),
        )
        .addExtraButton(
          resetButton(
            i18n.t("asset:settings.hide-status-bar-icon"),
            i18n.t("settings.reset"),
            async () =>
              settings.mutate((settingsM) => {
                settingsM.hideStatusBar = Settings.DEFAULT.hideStatusBar;
              }),
            () => {
              this.postMutate();
            },
          ),
        );
    });
    this.newNoticeTimeoutWidget(Settings.DEFAULT);
    this.newSectionWidget(() => i18n.t("settings.advanced"));
    ui.newSetting(containerEl, (setting) => {
      const { settingEl } = setting;
      setting
        .setName(i18n.t("settings.expose-internal-modules"))
        .setDesc(
          createDocumentFragment(settingEl.ownerDocument, (frag) => {
            createChildElement(frag, "span", (ele) => {
              ele.innerHTML = i18n.t(
                "settings.expose-internal-modules-description-HTML",
              );
            });
          }),
        )
        .addToggle(
          linkSetting(
            () => settings.value.exposeInternalModules,
            async (value) =>
              settings.mutate((settingsM) => {
                settingsM.exposeInternalModules = value;
              }),
            () => {
              this.postMutate();
            },
          ),
        )
        .addExtraButton(
          resetButton(
            i18n.t("asset:settings.expose-internal-modules-icon"),
            i18n.t("settings.reset"),
            async () =>
              settings.mutate((settingsM) => {
                settingsM.exposeInternalModules =
                  Settings.DEFAULT.exposeInternalModules;
              }),
            () => {
              this.postMutate();
            },
          ),
        );
    })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.intercept-logging"))
          .addToggle(
            linkSetting(
              () => settings.value.interceptLogging,
              async (value) =>
                settings.mutate((settingsM) => {
                  settingsM.interceptLogging = value;
                }),
              () => {
                this.postMutate();
              },
            ),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.intercept-logging-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.interceptLogging =
                    Settings.DEFAULT.interceptLogging;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      })
      .newSetting(containerEl, (setting) => {
        setting
          .setName(i18n.t("settings.preferred-renderer"))
          .addDropdown(
            linkSetting(
              (): string => settings.value.preferredRenderer,
              setTextToEnum(
                Settings.PREFERRED_RENDERER_OPTIONS,
                async (value) =>
                  settings.mutate((settingsM) => {
                    settingsM.preferredRenderer = value;
                  }),
              ),
              () => {
                this.postMutate();
              },
              {
                pre: (dropdown) => {
                  dropdown.addOptions(
                    Object.fromEntries(
                      Settings.PREFERRED_RENDERER_OPTIONS.map((type) => [
                        type,
                        i18n.t("settings.preferred-renderer-options", {
                          interpolation: { escapeValue: false },
                          type,
                        }),
                      ]),
                    ),
                  );
                },
              },
            ),
          )
          .addExtraButton(
            resetButton(
              i18n.t("asset:settings.preferred-renderer-icon"),
              i18n.t("settings.reset"),
              async () =>
                settings.mutate((settingsM) => {
                  settingsM.preferredRenderer =
                    Settings.DEFAULT.preferredRenderer;
                }),
              () => {
                this.postMutate();
              },
            ),
          );
      });
  }

  protected override snapshot0(): Partial<Settings> {
    return Settings.persistent(this.context.settings.value);
  }
}

export function loadSettings(
  context: TerminalPlugin,
  docs: loadDocumentations.Loaded,
): void {
  context.addSettingTab(new SettingTab(context, docs));
  registerSettingsCommands(context);
}
