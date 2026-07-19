# Unreal Engine Clangd Utils

An extension for Visual Studio Code designed to configure Unreal Engine C++ projects (including UE 5.7 and 5.8) to work seamlessly with **clangd** IntelliSense.

Provides fast, accurate, and responsive code completion, navigation, and diagnostics for Unreal Engine C++ code, eliminating the common false-positive "red squiggles" and high CPU usage issues associated with the default Microsoft C++ IntelliSense engine.

---

## Prerequisites

Before using this extension, please ensure your system meets the following requirements:

1. **Install clangd Toolchain**:
   - You need the `clangd` language server binary on your machine.
   - You can download the LLVM/clangd toolchain from [LLVM Releases](https://github.com/llvm/llvm-project/releases) or let VS Code install it automatically.
2. **Install VS Code Extensions**:
   - **[clangd VS Code Extension](https://marketplace.visualstudio.com/items?itemName=llvm-vs-code-extensions.vscode-clangd)** (Required: this runs the language server client).
   - **[C/C++ Extension by Microsoft](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools)** (Recommended: needed for launching/debugging your game targets, though we disable its IntelliSense engine to avoid conflicts).
3. **Compile the Project At Least Once**:
   - Unreal Engine relies heavily on reflection and code generation (creating `*.generated.h` files).
   - You **must compile your project at least once** via Unreal Editor or VS Code build tasks before generating the clang database. If you don't compile, `clangd` will report errors about missing generated headers.

---

## Key Features

- **Automated Clangd Setup**: Automatically creates a custom project-specific `.clangd` file with optimized compiler arguments, disabled template parsing warnings, and specific diagnostic suppressions for Unreal Engine's macro systems (`UCLASS`, `GENERATED_BODY`, etc.).
- **Automatic Compile Commands Generation**: Locates the `UnrealBuildTool` executable (by scanning tasks, the registry, or standard installation paths) and runs it with `-mode=GenerateClangDatabase` to build `compile_commands.json`.
- **Database Relocation**: Automatically moves/copies the generated `compile_commands.json` database from the Engine root folder to your project root where the `clangd` language server can find it.
- **Conflict Prevention**: Disables Microsoft C/C++ extension's IntelliSense workspace engine (`C_Cpp.intelliSenseEngine = disabled`) to prevent duplicate diagnostics, lag, and resource conflicts.
- **One-Click UI Controls**:
  - **Status Bar Button**: Displays a `Generate Clang Database` shortcut button at the bottom of the window.
  - **Editor Title Button**: Shows a database sync icon in the top-right toolbar when editing C++ or `.uproject` files for quick regeneration.
- **Auto-Run on Startup**: Prompts you to run the initial setup automatically if your project is missing a `.clangd` file or `compile_commands.json` upon opening.

---

## How to Use

1. **First-time Setup**:
   - Open your Unreal Engine C++ project directory in VS Code.
   - If it's a fresh setup, you will see a notification prompting you to configure the project. Click **Setup Now**.
   - Alternatively, open the Command Palette (`Ctrl+Shift+P`) and select **`Unreal Utils: Setup Project for Clangd`**.
2. **Updating the Database**:
   - Whenever you add new C++ files, rename modules, or add new plugin dependencies, the compiler paths change.
   - Simply click the **Generate Clang Database** button on the bottom status bar, or click the **Sync Database** icon in the editor toolbar (top-right of C++ files) to regenerate and copy `compile_commands.json`.

---

## Troubleshooting

### Issue: Missing `*.generated.h` files
* **Cause**: The project hasn't been built yet, or UBT generated the database without building files.
* **Solution**: Build your project inside Unreal Editor (e.g. click "Live Coding" or Compile) or run a standard build task in VS Code. Once built, restart the `clangd` server via the Command Palette (`clangd: Restart language server`).

### Issue: Extension says "Could not locate UnrealBuildTool"
* **Cause**: Your project doesn't have generated VS Code workspace files, or the Engine is in a non-standard location not indexed by the registry.
* **Solution**: 
  1. Open Unreal Editor and select **Tools -> Generate Visual Studio Code Project**.
  2. Open VS Code Settings (`Ctrl+,`), search for `Unreal Build Tool Path`, and manually paste the absolute path to your `UnrealBuildTool.exe`.

### Issue: Duplicate Diagnostics or Slow Editing Performance
* **Cause**: Microsoft's C/C++ extension IntelliSense is still running.
* **Solution**: Ensure your workspace settings file (`.vscode/settings.json`) contains `"C_Cpp.intelliSenseEngine": "disabled"`. This extension attempts to set this automatically during initial setup.

---

## Extension Settings

This extension contributes the following settings:

* `unreal-utils.unrealBuildToolPath`: Custom path to the `UnrealBuildTool` executable. If empty, the extension will auto-resolve it from `.vscode/tasks.json` or registry entries.
* `unreal-utils.targetName`: Custom project target name (e.g. `MyGameEditor`). If left empty, it auto-detects based on the `.Target.cs` files in your `Source/` folder.
* `unreal-utils.buildConfiguration`: The build configuration to use when generating compile commands (defaults to `Development`).
* `unreal-utils.buildPlatform`: The target platform (defaults to `Win64`).
* `unreal-utils.autoRunOnStartup`: Toggles whether the extension prompts you to run setup if configurations are missing on startup (default: `true`).
* `unreal-utils.useNoExecCodeGenActions`: Appends the `-NoExecCodeGenActions` flag to the UBT command to significantly speed up database generation (default: `true`).

---

## License

MIT License. Copyright (c) 2026 Siddartha Gonnabattula.
