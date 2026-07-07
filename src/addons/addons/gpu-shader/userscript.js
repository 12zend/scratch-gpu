import ShaderRenderer from './lib/shader-renderer.js';
import ScratchShaderCompiler from './lib/shader-compiler.js';
import GpuKernelDetector from './lib/gpu-kernel-detector.js';
import {GpuKernelScheduler} from './lib/gpu-kernel-scheduler.js';

export default async function ({addon, console}) {
  const vm = addon.tab.traps.vm;

  // Wait for the project to finish loading. Renderer and scripts will not be fully available until this happens.
  await new Promise((resolve) => {
    if (vm.editingTarget) return resolve();
    vm.runtime.once('PROJECT_LOADED', resolve);
  });

  // --- settings ---
  const readScale = () => {
    const v = addon.settings.get('shader_scale');
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 1;
  };
  let shaderScale = readScale();
  let shaderOnTop = !!addon.settings.get('shader_on_top');

  // --- shader canvas (overlay via scratch-render) ---
  const shaderCanvas = document.createElement('canvas');
  shaderCanvas.className = 'sc-shader-canvas';
  shaderCanvas.style.display = 'none';
  shaderCanvas.style.pointerEvents = 'none';
  shaderCanvas.style.width = '100%';
  shaderCanvas.style.height = '100%';
  shaderCanvas.style.position = 'absolute';
  shaderCanvas.style.top = '0';
  shaderCanvas.style.left = '0';

  const attachOverlay = () => {
    if (vm.renderer && vm.renderer.addOverlay) {
      vm.renderer.addOverlay(shaderCanvas, 'none');
      return true;
    }
    return false;
  };
  let overlayAttached = attachOverlay();
  if (!overlayAttached) {
    // retry once renderer exists
    const retry = setInterval(() => {
      if (vm.renderer && vm.renderer.addOverlay) {
        clearInterval(retry);
        overlayAttached = attachOverlay();
      }
    }, 200);
  }

  // --- state ---
  let shaderRenderer = null;
  let kernelScheduler = null;
  let shaderEnabled = false;
  let listDataCache = null;
  let shaderListRefreshTimer = null;
  let shadersDirty = false;

  // --- pen-layer integration ---
  // The screen shader is NOT rendered as a topmost overlay. Instead, every
  // frame we blit the shader canvas's contents into the Scratch Pen skin
  // (which lives in the renderer's pen layer, i.e. above the background and
  // video layers but below sprites/speech bubbles). When the project has the
  // Pen extension loaded, that extension's existing PenSkin is reused so any
  // user-side pen blocks and our shader share the same layer; when no Pen
  // extension is loaded, we lazily create our own PenSkin + drawable in the
  // same PEN_LAYER group so the output still renders. The shader canvas
  // itself stays attached to the overlay container for WebGL context lifetime
  // reasons, but is always kept invisible (display: none) so it never paints
  // on top of the stage; the user-visible image comes solely from the blit.
  let _ownPenSkinId = -1;
  let _ownPenDrawableId = -1;
  let _blitTexture = null;

  const penExtensionLoaded = () => {
    const ext = vm && vm.extensionManager;
    return !!ext && typeof ext.isExtensionLoaded === 'function' && ext.isExtensionLoaded('pen');
  };

  const ensurePenSkinId = () => {
    const renderer = vm && vm.runtime && vm.runtime.renderer;
    if (!renderer) return -1;

    if (penExtensionLoaded()) {
      const sid = renderer._penSkinId;
      if (sid != null && sid >= 0 && renderer._allSkins && renderer._allSkins[sid]) return sid;
      return -1;
    }

    if (_ownPenSkinId >= 0 && renderer._allSkins && renderer._allSkins[_ownPenSkinId]) {
      return _ownPenSkinId;
    }

    cleanupOwnedPenLayer();
    _ownPenSkinId = renderer.createPenSkin();
    _ownPenDrawableId = renderer.createDrawable('pen');
    if (renderer.markDrawableAsNoninteractive) {
      renderer.markDrawableAsNoninteractive(_ownPenDrawableId);
    }
    renderer.updateDrawableSkinId(_ownPenDrawableId, _ownPenSkinId);
    return _ownPenSkinId;
  };

  const cleanupOwnedPenLayer = () => {
    const renderer = vm && vm.runtime && vm.runtime.renderer;
    if (renderer) {
      if (_ownPenDrawableId >= 0) {
        try { renderer.destroyDrawable(_ownPenDrawableId, 'pen'); } catch (e) {}
      }
      if (_ownPenSkinId >= 0) {
        try { renderer.destroySkin(_ownPenSkinId); } catch (e) {}
      }
      if (_blitTexture != null && renderer.gl) {
        try { renderer.gl.deleteTexture(_blitTexture); } catch (e) {}
      }
    }
    _ownPenDrawableId = -1;
    _ownPenSkinId = -1;
    _blitTexture = null;
  };

  const blitToPenLayer = () => {
    const renderer = vm && vm.runtime && vm.runtime.renderer;
    if (!renderer || !renderer.gl) return;
    const skinId = ensurePenSkinId();
    if (skinId < 0) return;
    const skin = renderer._allSkins[skinId];
    if (!skin || typeof skin._drawPenTexture !== 'function') return;

    const gl = renderer.gl;
    if (_blitTexture == null) _blitTexture = gl.createTexture();
    if (_blitTexture == null) return;

    skin.clear();
    renderer.dirty = true;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, _blitTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shaderCanvas);
    } catch (e) {
      console.error('[gpu-shader] blit texImage2D error:', e && e.message || e);
      return;
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    try {
      skin._drawPenTexture(_blitTexture);
      renderer.dirty = true;
      if (renderer.requestRedraw) renderer.requestRedraw();
    } catch (e) {
      console.error('[gpu-shader] PenSkin blit error:', e && e.message || e);
    }
  };

  // --- data bridges ---
  const readShaderVariable = (name) => {
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (v.name === name && v.type !== 'list') {
          const val = v.value;
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 1 : 0;
          const n = parseFloat(val);
          return isFinite(n) ? n : 0;
        }
      }
    }
    return 0;
  };

  const readShaderList = (name) => {
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (v.name === name && v.type === 'list') {
          const arr = v.value;
          if (!Array.isArray(arr)) return null;
          const out = new Float32Array(arr.length);
          for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (typeof item === 'number') out[i] = item;
            else if (typeof item === 'boolean') out[i] = item ? 1 : 0;
            else { const n = parseFloat(item); out[i] = isFinite(n) ? n : 0; }
          }
          return out;
        }
      }
    }
    return null;
  };

  const readShaderListCached = (name) => {
    if (!listDataCache) listDataCache = new Map();
    const cached = listDataCache.get(name);
    if (cached !== undefined) return cached;
    const data = readShaderList(name);
    listDataCache.set(name, data);
    return data;
  };

  const buildVariableCache = () => {
    const cache = {};
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (v.type === 'list') continue;
        if (cache[v.name] !== undefined) continue;
        const val = v.value;
        if (typeof val === 'number') cache[v.name] = val;
        else if (typeof val === 'boolean') cache[v.name] = val ? 1 : 0;
        else { const n = parseFloat(val); cache[v.name] = isFinite(n) ? n : 0; }
      }
    }
    return cache;
  };

  const parseNum = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  const findTargetByName = (name) => {
    const runtime = vm && vm.runtime;
    if (!runtime) return null;
    const stripped = String(name).replace(/^["']|["']$/g, '');
    if (stripped === '_stage_' || stripped === 'Stage' || stripped === '') {
      return runtime.getTargetForStage && runtime.getTargetForStage();
    }
    const targets = runtime.targets || [];
    for (const t of targets) {
      if (t && t.isOriginal && t.getName && t.getName() === stripped) return t;
    }
    return null;
  };

  const lookupVariableValue = (target, varName) => {
    if (!target || !target.variables) return 0;
    for (const id in target.variables) {
      const v = target.variables[id];
      if (v.name === varName && v.type !== 'list') {
        return parseNum(v.value);
      }
    }
    return 0;
  };

  const readTargetAttribute = (target, propLower) => {
    if (!target) return 0;
    switch (propLower) {
      case 'x position': return target.x || 0;
      case 'y position': return target.y || 0;
      case 'direction': return target.direction || 0;
      case 'size': return target.size || 0;
      case 'volume': return target.volume || 0;
      case 'costume #': return (target.currentCostume != null ? target.currentCostume + 1 : 0);
      case 'costume name': {
        const costumes = target.getCostumes && target.getCostumes();
        if (costumes && costumes[target.currentCostume]) {
          return parseNum(costumes[target.currentCostume].name);
        }
        return 0;
      }
      case 'backdrop #': {
        const stage = target.runtime && target.runtime.getTargetForStage && target.runtime.getTargetForStage();
        if (stage) return (stage.currentCostume != null ? stage.currentCostume + 1 : 0);
        return 0;
      }
      case 'backdrop name': {
        const stage = target.runtime && target.runtime.getTargetForStage && target.runtime.getTargetForStage();
        if (stage) {
          const costumes = stage.getCostumes && stage.getCostumes();
          if (costumes && costumes[stage.currentCostume]) {
            return parseNum(costumes[stage.currentCostume].name);
          }
        }
        return 0;
      }
      default: return 0;
    }
  };

  const buildInputCache = () => {
    const io = vm && vm.runtime && vm.runtime.ioDevices;
    const input = {};
    if (io && io.mouse) {
      input.mouseX = io.mouse.getScratchX();
      input.mouseY = io.mouse.getScratchY();
      input.mouseDown = io.mouse.getIsDown();
    }
    if (vm && vm.runtime && vm.runtime.ext_scratch3_control) {
      input.counter = vm.runtime.ext_scratch3_control._counter || 0;
    }
    const keySet = new Set();
    const sensingSet = new Set();
    const addKeys = (compiled) => {
      if (compiled && compiled.keyUniforms) {
        for (const k of compiled.keyUniforms) keySet.add(k.key);
      }
      if (compiled && compiled.sensingUniforms) {
        for (const s of compiled.sensingUniforms) sensingSet.add(s.key);
      }
    };
    if (shaderRenderer) addKeys(shaderRenderer._compiled);
    if (kernelScheduler && kernelScheduler.kernels) {
      for (const entry of kernelScheduler.kernels) addKeys(entry.compiled);
    }
    if (keySet.size && io && io.keyboard && typeof io.keyboard.getKeyIsDown === 'function') {
      const keys = {};
      for (const key of keySet) {
        keys[key] = io.keyboard.getKeyIsDown(key);
      }
      input.keys = keys;
    }
    if (sensingSet.size) {
      const sensing = {};
      const now = new Date();
      const runtime = vm && vm.runtime;
      for (const key of sensingSet) {
        switch (key) {
          case 'current_year': sensing[key] = now.getFullYear(); break;
          case 'current_month': sensing[key] = now.getMonth() + 1; break;
          case 'current_date': sensing[key] = now.getDate(); break;
          case 'current_dayofweek': sensing[key] = now.getDay() + 1; break;
          case 'current_hour': sensing[key] = now.getHours(); break;
          case 'current_minute': sensing[key] = now.getMinutes(); break;
          case 'current_second': sensing[key] = now.getSeconds(); break;
          case 'days_since_2000': {
            const ms = Date.now() - Date.UTC(2000, 0, 1);
            sensing[key] = ms / (24 * 60 * 60 * 1000);
            break;
          }
          case 'answer': {
            const sensingExt = runtime && runtime.ext_scratch3_sensing;
            sensing[key] = sensingExt ? parseNum(sensingExt._answer) : 0;
            break;
          }
          default: {
            if (key.startsWith('of_var_')) {
              const rest = key.substring('of_var_'.length);
              const lastUnderscore = rest.lastIndexOf('_');
              let propName = rest;
              let objExpr = '';
              if (lastUnderscore > 0) {
                propName = rest.substring(0, lastUnderscore);
                objExpr = rest.substring(lastUnderscore + 1);
              }
              const stripped = propName.replace(/^_+|_+$/g, '');
              const objName = objExpr.replace(/^glslNum\(|\)$/g, '').replace(/\.0$/, '');
              const target = findTargetByName(objName);
              if (target) {
                const v = lookupVariableValue(target, stripped);
                sensing[key] = v;
              } else {
                sensing[key] = 0;
              }
            } else if (key.startsWith('of_')) {
              const rest = key.substring('of_'.length);
              const lastUnderscore = rest.lastIndexOf('_');
              let propName = rest;
              let objExpr = '';
              if (lastUnderscore > 0) {
                propName = rest.substring(0, lastUnderscore);
                objExpr = rest.substring(lastUnderscore + 1);
              }
              const stripped = propName.replace(/^_+|_+$/g, '').toLowerCase();
              const objName = objExpr.replace(/^glslNum\(|\)$/g, '').replace(/\.0$/, '');
              const target = findTargetByName(objName);
              if (target) {
                sensing[key] = readTargetAttribute(target, stripped);
              } else {
                sensing[key] = 0;
              }
            } else {
              sensing[key] = 0;
            }
          }
        }
      }
      input.sensing = sensing;
    }
    return input;
  };

  // --- CPU procedure skip / restore ---
  // Instead of mutating the block tree (b.next = null) which disconnects
  // procedure bodies in the editor, we override getProcedureDefinition on
  // each target's Blocks instance so that skipped proccodes resolve to null.
  // Both the interpreter (sequencer.stepToProcedure) and the compiler
  // (irgen.js getProcedureInfo) treat a null definition as "procedure not
  // found" and become no-ops, while the editor's block tree stays intact.
  let skipSet = null;
  const patchedTargets = new Set();

  const _patchBlocks = (blocks) => {
    if (!blocks || patchedTargets.has(blocks)) return;
    patchedTargets.add(blocks);
    const original = blocks.getProcedureDefinition.bind(blocks);
    blocks._gpuShaderOriginalGetProcedureDefinition = original;
    blocks.getProcedureDefinition = (name) => {
      if (skipSet && skipSet.has(name)) return null;
      return original(name);
    };
  };

  const _patchAllTargets = () => {
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
      if (target && target.blocks) _patchBlocks(target.blocks);
    }
  };

  const _invalidateCompiledScripts = () => {
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
      const cache = target && target.blocks && target.blocks._cache;
      if (!cache) continue;
      cache.compiledScripts = {};
      cache.compiledProcedures = {};
    }
  };

  const _invalidateCaches = _invalidateCompiledScripts;

  const skipProceduresOnCPU = (proccodes) => {
    restoreProceduresOnCPU();
    if (!proccodes || !proccodes.length) return;
    skipSet = new Set(proccodes);
    _patchAllTargets();
    _invalidateCaches();
  };

  const restoreProceduresOnCPU = () => {
    if (!skipSet) return;
    skipSet = null;
  };

  const restoreProcedureOnCPU = (proccode) => {
    if (!skipSet) return;
    skipSet.delete(proccode);
  };

  // --- list refresh (covers CPU init scripts that populate lists after green flag) ---
  const refreshShaderLists = () => {
    if (shaderRenderer && shaderEnabled) {
      listDataCache = null;
      shaderRenderer.uploadListData();
    }
  };

  const computeListSignature = () => {
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    let sig = 0;
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (!v || v.type !== 'list') continue;
        const arr = v.value;
        const len = Array.isArray(arr) ? arr.length : 0;
        sig = (sig * 31 + len) | 0;
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i += Math.max(1, Math.floor(arr.length / 16))) {
            const x = arr[i];
            const n = typeof x === 'number' ? x : parseFloat(x);
            sig = (sig * 31 + (isFinite(n) ? Math.floor(n * 1000) : 0)) | 0;
          }
        }
      }
    }
    return sig;
  };

  const startShaderListRefresh = () => {
    if (shaderListRefreshTimer) return;
    let lastSignature = null;
    let stableCount = 0;
    let tickCount = 0;
    const MAX_TICKS = 40;
    const tick = () => {
      const sig = computeListSignature();
      if (sig === lastSignature) {
        stableCount++;
      } else {
        stableCount = 0;
        lastSignature = sig;
      }
      refreshShaderLists();
      tickCount++;
      const stable = stableCount >= 3;
      if (stable || tickCount >= MAX_TICKS) {
        shaderListRefreshTimer = null;
        return;
      }
      shaderListRefreshTimer = setTimeout(tick, 250);
    };
    shaderListRefreshTimer = setTimeout(tick, 250);
  };

  // --- the master enable routine (ported from scaffolding._tryEnableShader) ---
  const tryEnableShader = () => {
    const t0 = performance.now();
    if (shaderRenderer) shaderRenderer.stop();
    if (shaderRenderer && shaderRenderer.clearGlErrors) shaderRenderer.clearGlErrors();
    if (kernelScheduler) {
      kernelScheduler.stop();
      kernelScheduler = null;
    }
    restoreProceduresOnCPU();

    const runtime = vm && vm.runtime;
    if (!runtime) return;

    const t1 = performance.now();
    const detector = new GpuKernelDetector(runtime);
    const detection = detector.detect();
    const t2 = performance.now();
    const screenKernel = detection.kernels.find((k) => k.type === 'screen' && k.status === 'ready');

    let screenCompiled = null;
    if (screenKernel) {
      const compiler = new ScratchShaderCompiler(runtime);
      try {
        screenCompiled = compiler.compileKernel(screenKernel, 'screen');
      } catch (e) {
        console.warn('[gpu-shader] Screen kernel compile error:', e && e.message || e);
      }
      if (screenCompiled && screenCompiled.errors.length) {
        console.error('[gpu-shader] Screen kernel errors:\n  ' + screenCompiled.errors.join('\n  '));
        shaderCanvas.style.display = 'none';
        shaderEnabled = false;
        return;
      }
    }

    let screenEnabled = false;
    if (screenCompiled && screenCompiled.found) {
      const ok = shaderRenderer.setProgram(screenCompiled, (name) => readShaderVariable(name));
      if (!ok) {
        console.error('[gpu-shader] GPU program failed to compile.');
        shaderCanvas.style.display = 'none';
        shaderEnabled = false;
        return;
      }
      shaderRenderer.setVariableCacheProvider(() => buildVariableCache());
      shaderRenderer.setListReader((name) => readShaderList(name));
      shaderRenderer.setInputProvider(() => buildInputCache());
      shaderRenderer.uploadListData();
      const stageW = (runtime.constructor.STAGE_WIDTH) || 480;
      const stageH = (runtime.constructor.STAGE_HEIGHT) || 360;
      shaderRenderer.resize(stageW * shaderScale, stageH * shaderScale);
      shaderCanvas.style.display = 'none';
      shaderRenderer.clearPostRenderHooks();
      shaderRenderer.addPostRenderHook(blitToPenLayer);
      shaderRenderer.resetTime();
      shaderRenderer.start();
      screenEnabled = true;
    } else {
      shaderCanvas.style.display = 'none';
    }

    const pseudoScaffolding = {
      vm,
      _buildVariableCache: buildVariableCache,
      _readShaderList: readShaderList
    };
    kernelScheduler = new GpuKernelScheduler(pseudoScaffolding, shaderRenderer, (proccode) => restoreProcedureOnCPU(proccode));
    const schedulerDiagnostics = kernelScheduler.detectAndCompile();
    if (schedulerDiagnostics.warnings.length) {
      console.warn('[gpu-shader] Scheduler warnings:', schedulerDiagnostics.warnings);
    }
    if (kernelScheduler.kernels.length > 0) {
      kernelScheduler.start();
    }

    const computeEnabled = kernelScheduler.kernels.length > 0;
    if (!screenEnabled && !computeEnabled) {
      shaderEnabled = false;
      console.log('[gpu-shader] No GPU kernels detected; CPU-only mode.');
      return;
    }

    const proccodesToSkip = [];
    if (screenEnabled && screenKernel) proccodesToSkip.push(screenKernel.proccode);
    if (detection.renderPattern) proccodesToSkip.push(detection.renderPattern.renderProccode);
    for (const entry of kernelScheduler.kernels) {
      proccodesToSkip.push(entry.kernel.proccode);
    }

    // Find procedures that directly call any skipped kernel proccode and add
    // them to the skip set too, so the CPU doesn't waste time running a tight
    // loop that calls a now-NOP'd kernel hundreds of thousands of times per
    // frame (e.g. a "render" procedure that loops over all pixels calling the
    // GPUized "pixel(x,y)"). Without this, the interpreter/compiled code still
    // enters the loop body and dispatches the NOP'd call, which is
    // surprisingly expensive at 480x360 = 172800 iterations per frame.
    if (proccodesToSkip.length) {
      const kernelSet = new Set(proccodesToSkip);
      const allTargets = (runtime && runtime.targets) || [];
      for (const tg of allTargets) {
        if (!tg || !tg.blocks || !tg.blocks._blocks) continue;
        for (const id in tg.blocks._blocks) {
          const b = tg.blocks._blocks[id];
          if (b.opcode !== 'procedures_definition') continue;
          const protoId = b.inputs && b.inputs.custom_block && b.inputs.custom_block.block;
          const proto = protoId && tg.blocks._blocks[protoId];
          if (!proto || !proto.mutation || !proto.mutation.proccode) continue;
          const procProccode = proto.mutation.proccode;
          if (proccodesToSkip.includes(procProccode)) continue; // already skipped
          // Walk the body to see if it calls any kernel proccode
          let bodyId = b.next;
          let callsKernel = false;
          const visited = new Set();
          while (bodyId && !callsKernel) {
            if (visited.has(bodyId)) break;
            visited.add(bodyId);
            const stmt = tg.blocks._blocks[bodyId];
            if (!stmt) break;
            // Check SUBSTACK too
            const stackIds = [bodyId];
            while (stackIds.length && !callsKernel) {
              const sid = stackIds.pop();
              const sb = tg.blocks._blocks[sid];
              if (!sb) continue;
              if (sb.opcode === 'procedures_call' && sb.mutation && kernelSet.has(sb.mutation.proccode)) {
                callsKernel = true;
                break;
              }
              for (const key in sb.inputs) {
                const childId = sb.inputs[key].block || sb.inputs[key].shadow;
                if (childId) stackIds.push(childId);
              }
              if (sb.opcode !== 'procedures_call' && sb.next) stackIds.push(sb.next);
            }
            bodyId = stmt.next;
          }
          if (callsKernel && !proccodesToSkip.includes(procProccode)) {
            proccodesToSkip.push(procProccode);
          }
        }
      }
    }

    const t3 = performance.now();
    skipProceduresOnCPU(proccodesToSkip);
    const t4 = performance.now();

    shaderEnabled = true;
    shadersDirty = false;
    console.log('[gpu-shader] Enabled. Screen:', screenEnabled, 'Compute kernels:', kernelScheduler.kernels.length,
      `| detect:${(t2-t1).toFixed(0)}ms compile+schedule:${(t3-t2).toFixed(0)}ms skip:${(t4-t3).toFixed(0)}ms total:${(t4-t0).toFixed(0)}ms`);
  };

  const disableShader = () => {
    if (shaderRenderer) {
      shaderRenderer.clearPostRenderHooks();
      shaderRenderer.stop();
    }
    if (kernelScheduler) {
      kernelScheduler.stop();
      kernelScheduler = null;
    }
    shaderCanvas.style.display = 'none';
    restoreProceduresOnCPU();
    cleanupOwnedPenLayer();
    shaderEnabled = false;
  };

  // --- init ShaderRenderer (own WebGL context on the overlay canvas) ---
  try {
    shaderRenderer = new ShaderRenderer(shaderCanvas);
  } catch (e) {
    console.warn('[gpu-shader] WebGL unavailable; shader disabled:', e.message);
    shaderRenderer = null;
    return;
  }

  // --- lifecycle hooks ---
  vm.runtime.on('PROJECT_LOADED', () => {
    shadersDirty = true;
    cleanupOwnedPenLayer();
  });

  vm.runtime.on('PROJECT_CHANGED', () => {
    shadersDirty = true;
  });

  vm.runtime.on('PROJECT_START', () => {
    if (shadersDirty) {
      tryEnableShader();
    } else if (shaderRenderer && shaderEnabled) {
      shaderRenderer.resetTime();
      shaderRenderer.start();
      if (kernelScheduler && !kernelScheduler.running) kernelScheduler.start();
    }
    if (shaderRenderer && shaderEnabled) {
      startShaderListRefresh();
    }
  });

  vm.runtime.on('PROJECT_RUN_STOP', () => {
    if (shaderRenderer) shaderRenderer.stop();
    if (kernelScheduler) kernelScheduler.stop();
    restoreProceduresOnCPU();
    shadersDirty = true;
  });

  // --- pause/resume hooks (Scratch Addons "pause" addon emits these) ---
  // Both ShaderRenderer and GpuKernelScheduler run their own
  // requestAnimationFrame loops independent of the VM clock. When the user
  // pauses the project (via the pause button / alt+x), the VM freezes its
  // threads and audio, but without these hooks the GPU RAF loops keep
  // advancing: the screen shader keeps animating (its time uniform uses
  // performance.now()) and compute kernels keep overwriting their output
  // lists every frame -- which also races the CPU threads that are
  // supposed to be paused. Stop both RAF loops on pause, resume on unpause,
  // and use pauseTime/resumeTime so the shader's u_time does not jump
  // forward by the pause duration when resumed.
  let _wasRenderingBeforePause = false;
  let _wasSchedulerRunningBeforePause = false;

  vm.runtime.on('RUNTIME_PAUSED', () => {
    _wasRenderingBeforePause = !!(shaderRenderer && shaderRenderer._running);
    _wasSchedulerRunningBeforePause = !!(kernelScheduler && kernelScheduler.running);
    if (shaderRenderer && _wasRenderingBeforePause) {
      shaderRenderer.pauseTime();
      shaderRenderer.stop();
    }
    if (kernelScheduler && _wasSchedulerRunningBeforePause) {
      kernelScheduler.stop();
    }
  });

  vm.runtime.on('RUNTIME_UNPAUSED', () => {
    if (shaderRenderer && _wasRenderingBeforePause && shaderEnabled) {
      shaderRenderer.resumeTime();
      if (!shaderRenderer._running) shaderRenderer.start();
    }
    if (kernelScheduler && _wasSchedulerRunningBeforePause && shaderEnabled && !kernelScheduler.running) {
      kernelScheduler.start();
    }
    _wasRenderingBeforePause = false;
    _wasSchedulerRunningBeforePause = false;
  });

  // --- settings change handling ---
  addon.settings.addEventListener('change', () => {
    const newScale = readScale();
    const newOnTop = !!addon.settings.get('shader_on_top');
    if (newScale !== shaderScale) {
      shaderScale = newScale;
      if (shaderRenderer && shaderEnabled) {
        const runtime = vm.runtime;
        const stageW = (runtime && runtime.constructor.STAGE_WIDTH) || 480;
        const stageH = (runtime && runtime.constructor.STAGE_HEIGHT) || 360;
        shaderRenderer.resize(stageW * shaderScale, stageH * shaderScale);
      }
    }
    shaderOnTop = newOnTop;
  });

  // --- teardown when addon disabled ---
  addon.self.addEventListener('disabled', () => {
    disableShader();
    if (overlayAttached && vm.renderer && vm.renderer.removeOverlay) {
      vm.renderer.removeOverlay(shaderCanvas);
      overlayAttached = false;
    }
  });
  addon.self.addEventListener('reenabled', () => {
    if (!overlayAttached) overlayAttached = attachOverlay();
    shadersDirty = true;
  });

  // initial run: set dirty flag; shaders compile on first green flag
  shadersDirty = true;

  // debug hook
  window._gpuShaderDebug = {
    get shaderRenderer () { return shaderRenderer; },
    get kernelScheduler () { return kernelScheduler; },
    get shaderEnabled () { return shaderEnabled; },
    tryEnableShader,
    disableShader,
    refreshShaderLists
  };
}
