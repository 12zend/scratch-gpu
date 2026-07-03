import ScratchShaderCompiler from './shader-compiler.js';
import GpuKernelDetector from './gpu-kernel-detector.js';

const MAX_TEX_SIZE = 2048;

const getProcLabel = (proccode) => proccode.replace(/%[nsb]/g, '').trim().toLowerCase();

const generateId = () => 'gpu_' + Math.random().toString(36).slice(2) + '_' + Date.now();

export class GpuKernelScheduler {
  constructor (scaffolding, shaderRenderer, restoreCpuCallback) {
    this.scaffolding = scaffolding;
    this.shaderRenderer = shaderRenderer;
    this._restoreCpuCallback = restoreCpuCallback || null;
    this.kernels = [];
    this.diagnostics = {
      detected: [],
      loopCandidates: [],
      penCandidates: [],
      warnings: []
    };
    this.running = false;
    this._rafId = null;
    this._kernelFailures = new Map();
    this._maxKernelFailures = 3;
  }

  detectAndCompile () {
    this.kernels = [];
    this.diagnostics = {
      detected: [],
      loopCandidates: [],
      penCandidates: [],
      warnings: []
    };
    const runtime = this.scaffolding.vm && this.scaffolding.vm.runtime;
    if (!runtime) return this.diagnostics;

    const detector = new GpuKernelDetector(runtime);
    const detection = detector.detect();

    this.diagnostics.detected = detection.kernels.map((k) => ({
      proccode: k.proccode,
      type: k.type,
      status: k.status,
      reason: k.reason
    }));
    this.diagnostics.loopCandidates = detection.loopCandidates;
    this.diagnostics.penCandidates = detection.penCandidates;
    this.diagnostics.warnings = detection.warnings;

    for (const k of detection.kernels) {
      if (k.type !== 'compute' || k.status !== 'ready') continue;
      const compiler = new ScratchShaderCompiler(runtime);
      const result = compiler.compileKernel(k, 'compute');
      if (!result.found || result.errors.length) {
        this.diagnostics.warnings.push(`Compute kernel "${k.proccode}" failed to compile: ${result.errors.join('; ')}`);
        continue;
      }
      const outputListName = this._outputListName(k.proccode);
      this.kernels.push({
        kernel: k,
        compiled: result,
        outputListName,
        label: getProcLabel(k.proccode)
      });
    }

    return this.diagnostics;
  }

  _outputListName (proccode) {
    const label = proccode.replace(/%[nsb]/g, '').trim();
    const lower = label.toLowerCase();
    if (lower.startsWith('gpu_')) {
      return label.slice(4);
    }
    return label;
  }

  _computeTargetSize (length) {
    const maxArea = MAX_TEX_SIZE * MAX_TEX_SIZE;
    const len = Math.min(length, maxArea);
    const w = Math.min(MAX_TEX_SIZE, Math.ceil(Math.sqrt(len)));
    const h = Math.min(MAX_TEX_SIZE, Math.ceil(len / w));
    return { width: w, height: h, capped: length > maxArea };
  }

  start () {
    if (this.running) return;
    this.running = true;
    this._tick();
  }

  stop () {
    this.running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick () {
    this._rafId = requestAnimationFrame(() => {
      if (!this.running) return;
      this._runKernels();
      if (this.running) this._tick();
    });
  }

  _runKernels () {
    if (!this.shaderRenderer || !this.kernels.length) return;
    for (const entry of this.kernels) {
      this._runKernel(entry);
    }
  }

  _runKernel (entry) {
    const list = this._lookupOrCreateList(entry.outputListName);
    if (!list) return;
    const length = Array.isArray(list.value) ? list.value.length : 0;
    if (length === 0) return;

    const { width, height, capped } = this._computeTargetSize(length);
    if (capped) {
      console.warn(`[gpu-kernel-scheduler] List "${entry.outputListName}" is too large; only first ${MAX_TEX_SIZE * MAX_TEX_SIZE} elements will be updated.`);
    }
    const result = this.shaderRenderer.runComputePass(
      entry.compiled,
      width,
      height,
      () => this.scaffolding._buildVariableCache(),
      (name) => this.scaffolding._readShaderList(name)
    );
    if (!result) {
      this._handleKernelFailure(entry);
      return;
    }

    this._kernelFailures.delete(entry.kernel.proccode);

    const out = new Array(length);
    for (let i = 0; i < length; i++) {
      out[i] = result[i];
    }
    list.value = out;
  }

  _handleKernelFailure (entry) {
    const proccode = entry.kernel.proccode;
    const failures = (this._kernelFailures.get(proccode) || 0) + 1;
    this._kernelFailures.set(proccode, failures);
    const msg = `Compute kernel "${proccode}" runtime failure (${failures}/${this._maxKernelFailures})`;
    this.diagnostics.warnings.push(msg);
    console.warn(`[gpu-kernel-scheduler] ${msg}`);

    if (failures >= this._maxKernelFailures) {
      const fallbackMsg = `Disabling GPU compute kernel "${proccode}" and falling back to CPU execution.`;
      this.diagnostics.warnings.push(fallbackMsg);
      console.warn(`[gpu-kernel-scheduler] ${fallbackMsg}`);
      if (this._restoreCpuCallback) {
        try {
          this._restoreCpuCallback(proccode);
        } catch (e) {
          console.error('[gpu-kernel-scheduler] Failed to restore CPU execution:', e);
        }
      }
      this.kernels = this.kernels.filter((k) => k.kernel.proccode !== proccode);
    }
  }

  _lookupOrCreateList (name) {
    const stage = this.scaffolding.vm.runtime.getTargetForStage();
    if (!stage) return null;
    let variable = stage.lookupVariableByNameAndType(name, 'list');
    if (!variable) {
      try {
        variable = stage.createVariable(generateId(), 'list', name, false);
      } catch (e) {
        console.warn('[gpu-kernel-scheduler] Could not create list:', name, e);
        return null;
      }
    }
    return variable;
  }
}

export default GpuKernelScheduler;
