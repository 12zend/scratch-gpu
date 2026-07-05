# Shading

Guide for AI agents (and humans) working in this repository. Read this before
making changes.

## What this repository is

`scratch-gpu` is a **fork of TurboWarp's `scratch-gui`** (which is itself a fork
of MIT's `scratch-gui`) with one major addition: an experimental **GPU shader
acceleration pipeline** implemented as a Scratch Addon.

- `package.json` still calls itself `scratch-gui` (versioned `3.2.37`) because the
  build/packaging contract with `scratch-vm`, `scratch-render`, `scratch-blocks`,
  etc. is unchanged. Do not "fix" the package name.
- The user-facing product name / brand (`src/lib/brand.js` → `APP_NAME`) is **`Shading`**
  (the site is `shading.app`). The repo directory stays `scratch-gpu`; do not rename it.
- License: GPL-3.0 for TurboWarp's modifications; the upstream MIT BSD notice is
  retained in `README.md` and `LICENSE` and **must not be removed**.
- Upstream origin: `https://github.com/12zend/scratch-gpu.git`.
- Stack: React 16 + Redux 3, Webpack 4, Babel 7, Jest 29, ESLint 8
  (`eslint-config-scratch`). Node 22 (see `.nvmrc` = `v24`, `.github/workflows`
  uses 22 — keep both consistent if you bump).

The interesting, project-specific code lives almost entirely in
`src/addons/addons/gpu-shader/`. Everything else is upstream TurboWarp/Scratch
code that should be edited cautiously and with upstream conventions in mind.

## Repository layout

```
src/
  index.js                  # Library entry (UMD build → dist/scratch-gui.js)
  playground/               # Webpack entries: editor, player, fullscreen, embed,
                            #   addon-settings, credits (each → build/*.htm)
  containers/               # Redux-connected React containers (gui.jsx = root)
  components/               # Presentational React components
  reducers/                 # Redux reducers (project-state.js = FSM, tw.js = TW)
  lib/                      # HOCs, utilities, default project, themes, brands.
                            #   vm-listener-hoc.jsx wires VM events → redux.
  addons/                   # Scratch Addons integration (vendored via pull.js)
    addons/gpu-shader/      # ← THE project-specific code
      _manifest_entry.js    # Addon manifest (settings: shader_scale, shader_on_top)
      _runtime_entry.js     # generated-by-pull.js stub (hand-edited for this addon)
      userscript.js         # Lifecycle: detect → compile → enable → run → teardown
      lib/
        gpu-kernel-detector.js   # Scan block tree for GPU-izable procedures
        shader-compiler.js       # Block tree → GLSL (ES) fragment shader
        shader-renderer.js       # WebGL program + compute-pass + list atlas
        gpu-kernel-scheduler.js  # RAF loop that runs compute kernels → Scratch lists
test/                       # Jest unit/integration/smoke (no GPU tests yet)
scripts/prepublish.mjs      # Downloads microbit hex into static/microbit
build/                      # Webpack dev/prod output (gitignored in .gitignore;
                            #   checked in only for CI deployment artifacts)
dist/                       # UMD library output (BUILD_MODE=dist)
static/                     # Copied verbatim into build/ (favicons, _redirects, …)
webpack.config.js           # Two configs: editor playground bundle + UMD library
.github/workflows/node.js.yml  # CI: npm ci → npm run build → npm run test:unit
```

Addons under `src/addons/addons/` other than `gpu-shader/` are **vendored from
 Scratch Addons via `pull.js`** (see `src/addons/README.md`). `.eslintignore`
excludes `src/addons/addons`, `src/addons/libraries`, `src/addons/api-libraries`,
and `src/addons/generated` — do **not** lint or reformat those directories, and
do not hand-edit individual files there except `gpu-shader/`. The `gpu-shader`
addon is original to this repo (its `_runtime_entry.js` notes it is
"hand-edited for gpu-shader").

## Commands

```bash
npm install           # also runs prepublish (downloads microbit hex)
npm start             # webpack-dev-server on http://localhost:8601/
npm run build         # clean + webpack (production) → build/
npm run watch         # webpack --watch
BUILD_MODE=dist npm run build   # also emit UMD bundle → dist/scratch-gui.js
npm test              # lint + unit + build + integration (full suite)
npm run test:lint     # eslint . --ext .js,.jsx
npm run test:unit     # jest test/unit/addons (add -- --watch for watch mode)
npm run test:integration  # requires `npm run build` first; uses headless browser
npm run test:smoke    # selenium smoke test
```

CI (`.github/workflows/node.js.yml`) runs `npm ci`, `npm run build`, then
`npm run test:unit`. **It does not run `test:lint` or `test:integration`.**
Before pushing, run at least `npm run test:lint && npm run test:unit` locally.

No GPU-specific test suite exists yet. When touching `gpu-shader`, manually test
in a browser (`npm start`), open the editor, load a project with a `pixel(x, y)`
screen kernel or a `gpu_<list>` compute kernel, press the green flag, and watch
the console (logs are prefixed `[gpu-shader]`, `[scaffolding-shader]`, or
`[gpu-kernel-scheduler]`). `window._gpuShaderDebug` exposes `shaderRenderer`,
`kernelScheduler`, `shaderEnabled`, `tryEnableShader`, `disableShader`, and
`refreshShaderLists` for live debugging.

## The GPU shader pipeline (read this before editing gpu-shader)

The pipeline lives in `src/addons/addons/gpu-shader/` and runs entirely in the
browser as a Scratch Addon userscript. It does **not** modify `scratch-vm` or
`scratch-render` source; it hooks VM runtime events and patches
`target.blocks.getProcedureDefinition` at runtime.

### Three kernel types

`GpuKernelDetector.detect()` (`lib/gpu-kernel-detector.js`) scans every target's
block tree and returns `kernels` of two `type`s, plus a `renderPattern`:

1. **Screen kernels** — a custom block named `pixel` (or `pen`) taking two number
   parameters, **or** any procedure that writes a variable named `color`. The
   procedure is compiled to a fragment shader that writes every stage pixel in
   parallel. Output goes to an overlay canvas attached via
   `vm.renderer.addOverlay(shaderCanvas, 'none')`.

2. **Compute kernels** — any custom block whose label starts with `gpu_`
   (e.g. `gpu_<listname>`). The body must use only the opcodes in the `safe`
   set inside `_isBodySafeForCompute` (math/data/control + procedure calls to
   other safe bodies). Output is written back into a Scratch **list** whose name
   is the proccode label with the `gpu_` prefix stripped (see
   `_outputListName`).

3. **Render pattern** — `_synthesizePixelFromRender` detects a CPU loop that
   iterates over every stage pixel calling a draw primitive (e.g.
   `for i in pixels: pen down / go to / pen stamp`) and rewrites it into an
   equivalent `pixel(x, y) → color` screen kernel. The original loop's
   `renderProccode` is added to the CPU skip set via `detection.renderPattern`.

`_injectLoopKernels` also auto-GPUizes `for each` loops whose single-statement
body is `replace item INDEX of LIST with <expr>` (a pure `map`), synthesizing a
`gpu_<list>` compute kernel. Parallelizability is decided by
`_analyzeLoopParallelizability`; loops with cross-iteration dependencies
(accumulators, self-reading lists) are left on the CPU with a warning.

### Compilation: Scratch blocks → GLSL

`ScratchShaderCompiler` (`lib/shader-compiler.js`, ~1.2k lines) walks the block
tree and emits GLSL ES 1.0 fragment-shader source. Notable constraints baked in:

- `MAX_LOOP = 256`, `MAX_UNROLL = 128`. `forever` compiles to a fixed 256-iteration
  loop (with a warning); loops/implementations beyond these caps are clamped.
- Scratch **lists** become either read-only texture atlases (read-only lists) or
  fixed-size global GLSL arrays with a length tracker (mutable/shader-written
  lists). See `_mutableArrayName`, `_listTextures`, `_globalMutableArrays`.
- Procedures are inlined; recursion is rejected upfront.
- Many opcodes are ignored with a warning in shader mode (motion, looks, sound,
  pen, sensing aside from `sensing_timer`, broadcast, etc.). The supported set
  for **compute** is the `safe` Set in `_isBodySafeForCompute`; for **screen**
  it is broader but anything that doesn't write `color` is a no-op.

`compileKernel(kernel, mode)` returns `{ found, fragmentSource, vertexSource,
variableUniforms, errors, warnings, ... }`. Both `errors` (fatal) and
`warnings` (informational) are surfaced to the console by `userscript.js`.

### Rendering: WebGL

`ShaderRenderer` (`lib/shader-renderer.js`) owns its own WebGL1 context on the
overlay canvas. Highlights:

- Single fullscreen-quad vertex shader `VERT_SRC`; everything interesting is in
  the fragment shader.
- **Screen render path:** `setProgram(compiled, readVariable)` links a program,
  caches uniform locations in `_locations`, uploads a list-data atlas texture
  (`uploadListData`), and starts a RAF loop (`start`/`_frame`/`stop`) that
  re-uploads changed uniforms and draws every frame. `u_time` uses
  `performance.now()`; `pauseTime`/`resumeTime` keep it from jumping across a
  pause.
- **Compute path:** `runComputePass(compiled, w, h, readVariable, readList)`
  renders into an FBO with a float texture (when `OES_texture_float` +
  `WEBGL_color_buffer_float` are available) or an RGBA8 texture packed 24-bit
  (R*65536 + G*256 + B). Output is read back with `gl.readPixels` and returned
  as a `Float32Array`. The compiled program and the list atlas are cached
  (`_computeProgramCache`/`_computeProgramCacheKey`, `_computeAtlas`) and only
  rebuilt when the compiled shader object identity changes — do not break this
  caching, it is the difference between 60 FPS and 2 FPS on recompile-heavy
  frames.
- `MAX_TEX_SIZE = 2048` (both files). Compute target size is
  `ceil(sqrt(len)) × ceil(len / w)`, capped. Lists longer than
  `2048*2048` are truncated with a warning.

### Scheduling and CPU fallback

`GpuKernelScheduler` (`lib/gpu-kernel-scheduler.js`) owns a RAF loop that, each
frame, runs every compute kernel, writes the `Float32Array` result back into
the corresponding Scratch list (`list.value = out`), and accounts runtime
failures. After `_maxKernelFailures = 3` consecutive failures for a kernel, the
scheduler calls `_restoreCpuCallback(proccode)` (which is
`restoreProcedureOnCPU` in `userscript.js`) and removes the kernel from
`this.kernels`, permanently falling back to CPU execution for that proccode.

### Skipping CPU execution

To actually accelerate anything, the CPU interpreter/compiled path must **not**
run the GPUized procedures. The mechanism (in `userscript.js`) is critical and
subtle — read the comment block there before touching it:

- We override `blocks.getProcedureDefinition(name)` on each target's `Blocks`
  instance so that skipped proccodes resolve to `null`. Both the interpreter
  (`sequencer.stepToProcedure`) and the compiler (`irgen.js getProcedureInfo`)
  treat a null definition as "procedure not found" → no-op, while the editor's
  block tree stays intact.
- We do **not** mutate the block tree (older code did
  `b.next = null`, which made procedure bodies vanish from the editor — see
  commit `5b0e55f`).
- After building the skip set, `_invalidateCompiledScripts` clears
  `target.blocks._cache.compiledScripts/compiledProcedures` so the compiler
  re-jits without the NOP'd procedures.
- `userscript.js` also walks every `procedures_definition` and adds to the skip
  set any procedure whose body directly calls a kernel proccode. **This is
  mandatory**: without it the CPU still enters a 480×360 = 172800-iteration loop
  calling the now-NOP'd `pixel(x,y)` every frame (see commit `9ad53ff`).

### Lifecycle (the brittle part — most performance bugs live here)

The pipeline is driven by VM runtime events and **must** keep the GPU RAF loops
in lockstep with the VM clock. `userscript.js` listens on `vm.runtime`:

| Event | Action |
|-------|--------|
| `PROJECT_LOADED`    | set `shadersDirty = true` |
| `PROJECT_CHANGED`   | set `shadersDirty = true` (recompile on next green flag) |
| `PROJECT_START`     | if dirty: `tryEnableShader()`; else: `shaderRenderer.start()` + `kernelScheduler.start()`. Always start list refresh. |
| `PROJECT_RUN_STOP`  | `shaderRenderer.stop()`, `kernelScheduler.stop()`, restore CPU procedures, set dirty (re-detect on next start — see `5cb5e32`). |
| `RUNTIME_PAUSED`    | stop both RAF loops, `shaderRenderer.pauseTime()` |
| `RUNTIME_UNPAUSED`  | resume RAF loops (only if they were running), `shaderRenderer.resumeTime()` |

Design rules enforced by recent commits (don't regress them):

- Shader compile is **deferred to the first green flag** (`PROJECT_START`), not
  done on load (`2ad9fd3`). This keeps the editor responsive on project open.
- Shaders are **kept alive across stop/start cycles** and only recompiled when
  `PROJECT_CHANGED` flips `shadersDirty`, OR on `PROJECT_RUN_STOP` (which sets
  dirty because block edits during stop must be picked up — see `5cb5e32`).
- On `PROJECT_RUN_STOP`, CPU procedures are restored so the editor stays
  interactive while stopped (`d5ec852`).
- Both RAF loops are stopped on pause to avoid the shader's `u_time` advancing
  and compute kernels racing paused CPU threads (`9f4ff74`).
- `runComputePass` caches the compiled program + list atlas to avoid
  recompiling every frame (`1da5c05`).

`window._gpuShaderDebug.tryEnableShader()` is the single entry point that
detects, compiles, attaches the overlay, starts both loops, and installs the CPU
skip set. `disableShader()` is its inverse. `tryEnableShader` is idempotent and
safe to call repeatedly.

### Settings

Manifest-defined settings (`addon.settings.get`):

- `shader_scale` (`1` default, also `0.5`, `2`): multiplies the stage
  dimensions for the shader canvas. Changing it triggers a `shaderRenderer.resize`.
- `shader_on_top` (boolean, default `true`): currently only toggles a flag;
  visual stacking is handled by `scratch-render`'s overlay order.

### Where the GPU toggle lives (and why)

The `gpu-shader` addon is **not exposed on the "Addons" settings page** — it is
hidden there (`delete supportedAddons['gpu-shader']` in
`src/addons/settings/settings.jsx`) and its manifest carries `dynamicDisable: true`.
Instead, the user-facing control is the **"Disable GPU"** checkbox in the
**Advanced Settings → Danger Zone** modal (`src/containers/tw-settings-modal.jsx`
+ `src/components/tw-settings-modal/settings-modal.jsx`). The container's
`handleDisableGpuChange`:

1. Persists the state with `SettingsStore.setAddonEnabled('gpu-shader', !value)`.
2. Broadcasts the new store over `Channels.changeChannel` so other open
   windows (player, embed) pick it up via `setStore` → `'addon-changed'`.
3. Dispatches a synthetic `'addon-changed'` event on the local `SettingsStore`
   so this window's `AddonRunner` invokes `dynamicDisable()` / `dynamicEnable()`
   immediately (the addon's own `addon.self` `disabled` / `reenabled` listeners
   call `disableShader()` / set `shadersDirty` accordingly).

GPU is on by default; checking "Disable GPU" turns it off. Do not move this
control back into the Addons page — the user has deliberately separated it.

## Conventions

- **No comments unless asked.** Existing comments in `gpu-shader` are dense and
  load-bearing (lifecycle reasoning, skip-set rationale, caching invariants) —
  preserve them. New code: prefer clear names over comments.
- **Style:** `eslint-config-scratch` (4-space indent, single quotes, no
  semicolons in `scratch-*` style — note files use 2-space in upstream
  scratch-gui; match the file you're editing, not your preference). Run
  `npm run test:lint` before committing.
- **Commits:** `commitlint` enforces
  [`@commitlint/config-conventional`](https://commitlint.js.org). Recent history
  uses `feat:`, `fix:`, `perf:`, `chore:`, `docs:`, `test:`, `revert:`.
  `release.config.js` extends `scratch-semantic-release-config`; release branches
  are `develop`, `beta`, and `hotfix/REPLACE`. Don't push tags manually.
- **Build artifacts:** `build/` and `dist/` are gitignored. Generated addon
  files (`src/addons/generated/`, `src/addons/libraries/`,
  `src/addons/addons/*` except `gpu-shader/`) are vendored — don't edit by hand.
- **WebGL:** only WebGL1 APIs and the `OES_texture_float` /
  `WEBGL_color_buffer_float` extensions are used. Do not introduce WebGL2 or
  WebGPU (it was tried and dropped — see commit `f38f975`).
- **Never commit secrets.** `.gitignore` already excludes `.secrets`,
  `node_modules`, build output, and generated translation files.

## Workflow

Commit every change you make as you go — do not leave the working tree dirty
for the user to clean up. Before committing, run at least
`npm run test:lint && npm run test:unit` locally and fix anything those surface.
Stage only the files you intentionally touched (never `git add -A` secrets,
`build/`, `dist/`, or `node_modules`), and follow the conventional-commit
subject style (`feat:`, `fix:`, `perf:`, `chore:`, `docs:`, `test:`,
`revert:`) — `commitlint` rejects anything else. Keep commits atomic and
scoped; one logical change per commit. Do not push tags (releases run via
semantic-release on `develop`/`beta`/`hotfix/*`). Unless the user explicitly
asks, do not push — `git commit` only.