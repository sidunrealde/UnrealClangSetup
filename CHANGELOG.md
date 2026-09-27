# Changelog

All notable changes to the Unreal Engine Clangd Utils extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-28

### Added
- Detection of installed Unreal Engine versions, wherever they are installed, from the Windows registry (Epic Launcher installs and registered source builds) and the Epic Games Launcher install list (`LauncherInstalled.dat`).
- The engine matching the project's `EngineAssociation` is used for UnrealBuildTool. If that version isn't installed, the newest installed engine is used and a warning is shown.
- Support for the UE4 UnrealBuildTool location (`Engine/Binaries/DotNET/UnrealBuildTool.exe`).
- `unreal-utils.compiler` setting (`auto`, `Clang`, `VisualStudio`). In `auto`, if UE 5.x's default Clang toolchain isn't installed, the database is generated with the Visual Studio toolchain instead.
- "Unreal Clangd Utils" output panel that shows UnrealBuildTool's full output. Error messages now include the reason and a **Show Output** button.
- This changelog.

### Changed
- On engines that support it, UnrealBuildTool writes `compile_commands.json` directly to the project root (`-OutputDir`) instead of the engine folder. Older engines still copy it from the engine folder.
- UnrealBuildTool is started without a shell, so paths with spaces or special characters no longer need quoting.

### Fixed
- Registry lookup failed entirely when the source-build registry key (`HKCU\Software\Epic Games\Unreal Engine\Builds`) didn't exist, so Launcher installs were never checked.
- Stale registry entries for uninstalled engines are now ignored.
- Source-build GUIDs are no longer used as regular expressions when parsing registry output.
- Generation failed on machines without Clang ("Clang x64 must be installed in order to build this target"), and the error only said "Command failed".
- An intermittent Unreal Header Tool crash during generation is now retried once automatically.

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
