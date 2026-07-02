class WebGPURenderer {
  constructor (canvas) {
    this.canvas = canvas;
    this._device = null;
    this._context = null;
    this._pipeline = null;
    this._uniformBuffer = null;
    this._listBuffer = null;
    this._bindGroup = null;
    this._compiled = null;
    this._readVariable = () => 0;
    this._readList = () => null;
    this._startTime = 0;
    this._running = false;
    this._rafId = null;
    this._glStateReady = false;
    this._readVariableCache = () => ({});
    this._listDataCache = null;
    this._uniformData = null;
    this._lastW = -1;
    this._lastH = -1;
    this._lastTime = -1;
    this._lastVarVals = {};
    this._uniformListBase = 0;
  }

  async init () {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not available.');
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No suitable GPU adapter found.');
    }
    this._device = await adapter.requestDevice();
    this._context = this.canvas.getContext('webgpu');
    if (!this._context) {
      throw new Error('WebGPU canvas context unavailable.');
    }
    this._format = navigator.gpu.getPreferredCanvasFormat();
    this._context.configure({
      device: this._device,
      format: this._format,
      alphaMode: 'premultiplied'
    });
    return true;
  }

  setProgram (compiled) {
    const device = this._device;
    if (!device) return false;
    this._compiled = compiled;
    this._glStateReady = false;
    let module;
    try {
      module = device.createShaderModule({ code: compiled.wgslSource });
    } catch (e) {
      console.error('[scaffolding-shader] WGSL compile error:', e);
      return false;
    }
    if (module.getCompilationInfo) {
      module.getCompilationInfo().then((info) => {
        for (const m of info.messages) {
          if (m.type === 'error') {
            console.error(`[scaffolding-shader] WGSL: ${m.message} (line ${m.lineNum})`);
          } else {
            console.warn(`[scaffolding-shader] WGSL: ${m.message} (line ${m.lineNum})`);
          }
        }
      });
    }
    this._pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs_main' },
      fragment: { module, entryPoint: 'fs_main', targets: [{ format: this._format }] },
      primitive: { topology: 'triangle-strip' }
    });

    const uniformSize = this._computeUniformSize(compiled);
    if (this._uniformBuffer) this._uniformBuffer.destroy();
    this._uniformBuffer = device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this._uniformData = new Float32Array(uniformSize / 4);

    const listSize = this._computeListBufferSize(compiled);
    if (listSize > 0) {
      if (this._listBuffer) this._listBuffer.destroy();
      this._listBuffer = device.createBuffer({
        size: listSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
    }

    this._bindGroup = device.createBindGroup({
      layout: this._pipeline.getBindGroupLayout(0),
      entries: this._buildBindGroupEntries()
    });

    return true;
  }

  _computeUniformSize (compiled) {
    let count = 2;
    count += compiled.variableUniforms.length;
    if (compiled.listTextures && compiled.listTextures.length) {
      count += 2;
      const maxTexIndex = compiled.listTextures.reduce((m, s) => Math.max(m, s.texIndex), -1);
      count += (maxTexIndex + 1) * 7;
    }
    let size = count * 4;
    size = Math.max(16, Math.ceil(size / 16) * 16);
    return size;
  }

  _computeListBufferSize (compiled) {
    if (!compiled.listTextures || !compiled.listTextures.length) return 0;
    const maxTexIndex = compiled.listTextures.reduce((m, s) => Math.max(m, s.texIndex), -1);
    const numPacks = maxTexIndex + 1;
    if (!numPacks) return 0;
    return 1024 * 1024 * 4 * 4;
  }

  _buildBindGroupEntries () {
    const entries = [{ binding: 0, resource: { buffer: this._uniformBuffer } }];
    if (this._listBuffer) {
      entries.push({ binding: 1, resource: { buffer: this._listBuffer } });
    }
    return entries;
  }

  setVariableCacheProvider (fn) {
    this._readVariableCache = fn || (() => ({}));
  }

  setListReader (fn) {
    this._readList = fn || (() => null);
  }

  uploadListData () {
    if (!this._compiled || !this._compiled.listTextures) return;
    if (!this._listBuffer || !this._device) return;
    const listSpecs = this._compiled.listTextures;
    const maxTexIndex = listSpecs.reduce((m, s) => Math.max(m, s.texIndex), -1);
    const numPacks = maxTexIndex + 1;
    if (!numPacks) return;

    let maxLen = 1;
    const packInfo = new Array(numPacks).fill(null);
    for (let pi = 0; pi < numPacks; pi++) {
      const channels = [null, null, null, null];
      for (const spec of listSpecs) {
        if (spec.texIndex !== pi) continue;
        const data = this._readList(spec.scratchName);
        if (!data) continue;
        channels[spec.channel] = { name: spec.scratchName, data };
        if (data.length > maxLen) maxLen = data.length;
      }
      packInfo[pi] = channels;
    }

    const width = Math.min(maxLen, 2048);
    const packHeights = packInfo.map((channels) => {
      let len = 1;
      for (const ch of channels) {
        if (ch && ch.data.length > len) len = ch.data.length;
      }
      return Math.max(1, Math.ceil(len / width));
    });
    let totalHeight = 0;
    const offsets = [];
    for (const h of packHeights) {
      offsets.push(totalHeight);
      totalHeight += h;
    }
    const texels = width * totalHeight;
    const buf = new Float32Array(texels * 4);
    for (let pi = 0; pi < packInfo.length; pi++) {
      const channels = packInfo[pi];
      const yOffset = offsets[pi];
      for (let c = 0; c < 4; c++) {
        const ch = channels[c];
        if (!ch) continue;
        const data = ch.data;
        const maxItems = width * packHeights[pi];
        for (let i = 0; i < data.length && i < maxItems; i++) {
          const x = i % width;
          const y = yOffset + Math.floor(i / width);
          buf[(y * width + x) * 4 + c] = data[i];
        }
      }
    }
    const byteLength = buf.byteLength;
    const padded = Math.ceil(byteLength / 16) * 16;
    if (padded !== byteLength) {
      const paddedBuf = new Float32Array(padded / 4);
      paddedBuf.set(buf);
      this._device.queue.writeBuffer(this._listBuffer, 0, paddedBuf);
    } else {
      this._device.queue.writeBuffer(this._listBuffer, 0, buf);
    }
    this._listPackInfo = packInfo.map((channels, pi) => {
      const lengths = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        if (channels[c]) lengths[c] = channels[c].data.length;
      }
      return { offset: offsets[pi], height: packHeights[pi], lengths };
    });
    this._listWidth = width;
    this._listTotalHeight = totalHeight;
  }

  resize (width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  resetTime () {
    this._startTime = performance.now();
  }

  getTime () {
    return (performance.now() - this._startTime) / 1000;
  }

  start () {
    if (this._running) return;
    if (!this._pipeline) return;
    this._running = true;
    if (!this._startTime) this._startTime = performance.now();
    this._loop();
  }

  _loop () {
    this._rafId = requestAnimationFrame(() => {
      if (!this._running) return;
      this.render();
      if (this._running) this._loop();
    });
  }

  stop () {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  render () {
    if (!this._pipeline || !this._device) return;
    const device = this._device;
    const cache = this._readVariableCache();
    let off = 0;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const t = this.getTime();
    let dirty = (this._lastW !== w || this._lastH !== h || this._lastTime !== t);
    this._uniformData[off++] = w;
    this._uniformData[off++] = h;
    this._uniformData[off++] = t;
    this._uniformData[off++] = 0;
    this._lastW = w;
    this._lastH = h;
    this._lastTime = t;
    for (const v of this._compiled.variableUniforms || []) {
      const val = cache[v.scratchName] !== undefined ? cache[v.scratchName] : 0;
      if (this._lastVarVals[v.scratchName] !== val) {
        this._uniformData[off] = val;
        this._lastVarVals[v.scratchName] = val;
        dirty = true;
      }
      off++;
    }
    if (this._listPackInfo) {
      this._uniformData[off++] = this._listWidth;
      this._uniformData[off++] = this._listTotalHeight;
      this._uniformData[off++] = 0;
      this._uniformData[off++] = 0;
      for (let pi = 0; pi < this._listPackInfo.length; pi++) {
        const pack = this._listPackInfo[pi];
        this._uniformData[off++] = pack.lengths[0] || 0;
        this._uniformData[off++] = pack.lengths[1] || 0;
        this._uniformData[off++] = pack.lengths[2] || 0;
        this._uniformData[off++] = pack.lengths[3] || 0;
        this._uniformData[off++] = this._listWidth;
        this._uniformData[off++] = pack.height;
        this._uniformData[off++] = pack.offset;
        this._uniformData[off++] = 0;
      }
    }
    if (dirty) {
      device.queue.writeBuffer(this._uniformBuffer, 0, this._uniformData.subarray(0, off));
    }
    const encoder = device.createCommandEncoder();
    const view = this._context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    pass.setPipeline(this._pipeline);
    pass.setBindGroup(0, this._bindGroup);
    pass.draw(4);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  destroy () {
    this.stop();
    if (this._uniformBuffer) {
      this._uniformBuffer.destroy();
      this._uniformBuffer = null;
    }
    if (this._listBuffer) {
      this._listBuffer.destroy();
      this._listBuffer = null;
    }
    this._pipeline = null;
    this._device = null;
  }
}

export default WebGPURenderer;
