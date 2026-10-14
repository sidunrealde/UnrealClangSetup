# Changelog

All notable changes to the Unreal Engine Clangd Utils extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] - 2026-10-14

Existing projects keep their old `.clangd`: run **Unreal Utils: Write .clangd Config File** to get the template fixes below (this overwrites `.clangd`).

### Added
- Lint checks based on the [Epic C++ Coding Standard](https://dev.epicgames.com/documentation/unreal-engine/epic-cplusplus-coding-standard-for-unreal-engine) in the `.clangd` template: PascalCase naming with `E` enum prefixes and `b` booleans, braces around single statements, `nullptr`, const correctness (locals, methods, parameters passed by const reference, range-for loops), no `const` by-value returns, qualified `auto`, one declaration per statement, `default` in every `switch`, `enum class`, sized integer types, no global `using` in headers, C++ casts, `override` on overrides, and no shadowed variables. Tuned so Unreal's own macros (`GENERATED_BODY`, `UE_LOG`, `DOREPLIFETIME`) and naming patterns (`K2_`, `OnRep_`, `_Implementation`) don't produce warnings.
- On startup, a warning with a **Regenerate** button when `compile_commands.json` refers to response files that no longer exist (for example after cleaning `Intermediate`). Without them clangd has no include paths or defines and reports many false errors. Runs when `unreal-utils.autoRunOnStartup` is on.

### Changed
- `modernize-use-override` is replaced by the `-Wsuggest-override` compiler warning. The Epic standard requires both `virtual` and `override`, which `modernize-use-override` reports as redundant.
- Variables, parameters and members are now checked for PascalCase (previously any case was accepted).

### Fixed
- False clangd errors such as "definition of builtin function '_m_prefetch'" when the project is built with Clang. UE's Clang compile commands set `-resource-dir` to the compiler's builtin headers (e.g. Visual Studio's Clang 19), which don't match a newer clangd. The `.clangd` template now removes `-resource-dir`, so clangd uses its own headers.
- The clang-tidy settings in the `.clangd` template were at the top level, where clangd ignores them. They are now under `Diagnostics`, so the configured checks run.
- A check that doesn't exist (`bugprone-hdr-checker`) in the template's clang-tidy list.
- When UnrealBuildTool fails without an "error" line (for example "Unable to find plugin ..."), the error message now shows that line instead of no reason.

## [0.2.2] - 2026-09-28

### Changed
- Release pipeline: GitHub Actions updated to Node 24 (`actions/checkout` and `actions/setup-node` v7), and runs skip publishing when the version is already on the Marketplace. No functional changes to the extension.

## [0.2.1] - 2026-09-28

### Added
- `unreal-utils.compiler` setting (`auto`, `Clang`, `VisualStudio`). In `auto`, if UE 5.x's default Clang toolchain isn't installed, the database is generated with the Visual Studio toolchain instead.
- "Unreal Clangd Utils" output panel that shows UnrealBuildTool's full output. Error messages now include the reason and a **Show Output** button.

### Changed
- On engines that support it, UnrealBuildTool writes `compile_commands.json` directly to the project root (`-OutputDir`) instead of the engine folder. Older engines still copy it from the engine folder.
- UnrealBuildTool is started without a shell, so paths with spaces or special characters no longer need quoting.
- The `.gitignore` file is no longer included in the published package.

### Fixed
- Generation failed on machines without Clang ("Clang x64 must be installed in order to build this target"), and the error only said "Command failed".
- An intermittent Unreal Header Tool crash during generation is now retried once automatically.

## [0.2.0] - 2026-09-27

### Added
- Detection of installed Unreal Engine versions, wherever they are installed, from the Windows registry (Epic Launcher installs and registered source builds) and the Epic Games Launcher install list (`LauncherInstalled.dat`).
- The engine matching the project's `EngineAssociation` is used for UnrealBuildTool. If that version isn't installed, the newest installed engine is used and a warning is shown.
- Support for the UE4 UnrealBuildTool location (`Engine/Binaries/DotNET/UnrealBuildTool.exe`).
- This changelog.

### Fixed
- Registry lookup failed entirely when the source-build registry key (`HKCU\Software\Epic Games\Unreal Engine\Builds`) didn't exist, so Launcher installs were never checked.
- Stale registry entries for uninstalled engines are now ignored.
- Source-build GUIDs are no longer used as regular expressions when parsing registry output.

### Removed
- Hardcoded scan of `C:`–`F:` drives for `Program Files/Epic Games` folders.

## [0.1.3] - 2026-07-19

### Added
- Extension icon.

### Changed
- Expanded README with prerequisites and troubleshooting.

## [0.1.2] - 2026-07-18

### Added
- "Generate Clang Database" button in the editor title bar for C++ and `.uproject` files.
- "Generate Clang Database" status bar item.

## [0.1.1] - 2026-07-18

### Added
- LICENSE, `.vscodeignore`, and repository metadata.

### Changed
- Publisher set to `sidunrealde` to match the Marketplace ID.

## [0.1.0] - 2026-07-18

### Added
- Initial release.
- `.clangd` configuration template tuned for Unreal Engine.
- `compile_commands.json` generation via UnrealBuildTool (`-mode=GenerateClangDatabase`) and relocation to the project root.
- Disables Microsoft C/C++ IntelliSense to avoid conflicts with clangd.
- Prompt to run setup on startup when `.clangd` or `compile_commands.json` is missing.
- GitHub Actions workflow for publishing to the VS Code Marketplace.
