const VERT_SRC = [
  'attribute vec2 a_pos;',
  'void main() {',
  '  gl_Position = vec4(a_pos, 0.0, 1.0);',
  '}'
].join('\n');

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const MAX_TEX_SIZE = 2048;

class ShaderRenderer {
  constructor (canvas) {
    this.canvas = canvas;
    const opts = { antialias: false, depth: false, stencil: false, premultipliedAlpha: false };
    this.gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!this.gl) {
      throw new Error('WebGL is not available; shader renderer disabled.');
    }
    this._floatExt = this.gl.getExtension('OES_texture_float');
    this._texType = this._floatExt ? this.gl.FLOAT : this.gl.UNSIGNED_BYTE;
    this._isFloat = !!this._floatExt;
    this._program = null;
    this._compiled = null;
    this._readVariable = () => 0;
    this._readList = () => null;
    this._locations = null;
    this._buffer = this.gl.createBuffer();
    this._startTime = 0;
    this._running = false;
    this._pausedAt = null;
    this._lastError = null;
    this._listTextures = [];
    this._listPackInfo = [];
    this._glErrors = [];
    this._glErrorCounts = {};
    this._maxGlErrorLog = 16;
    this._rafId = null;
    this._glStateReady = false;
    this._uniformCache = null;
    this._readVariableCache = () => ({});
    this._listDataCache = null;
    this._lastVarVals = {};
    this._lastW = -1;
    this._lastH = -1;
    this._screenListCache = new Map();

    this._computeProgram = null;
    this._computeFbo = null;
    this._computeTexture = null;
    this._computeWidth = 0;
    this._computeHeight = 0;
    this._computeColorBufferFloat = this.gl.getExtension('WEBGL_color_buffer_float');
    this._computeFloatType = (this._floatExt && this._computeColorBufferFloat) ? this.gl.FLOAT : null;

    this._computeProgramCache = null;
    this._computeProgramCacheKey = null;
    this._computeAtlas = null;
    this._computeAtlasCompiled = null;
    this._postRenderHooks = [];
    this._inputProvider = () => ({});
  }

  addPostRenderHook (fn) {
    if (typeof fn === 'function' && this._postRenderHooks.indexOf(fn) === -1) {
      this._postRenderHooks.push(fn);
    }
  }

  removePostRenderHook (fn) {
    const i = this._postRenderHooks.indexOf(fn);
    if (i !== -1) this._postRenderHooks.splice(i, 1);
  }

  clearPostRenderHooks () {
    this._postRenderHooks = [];
  }

  getGlErrors () {
    return this._glErrors.slice();
  }

  clearGlErrors () {
    this._glErrors = [];
    this._glErrorCounts = {};
  }

  _checkGlError (where) {
    const gl = this.gl;
    const err = gl.getError();
    if (!err) return;
    const key = `${where}:0x${err.toString(16)}`;
    this._glErrorCounts[key] = (this._glErrorCounts[key] || 0) + 1;
    if (this._glErrors.length < this._maxGlErrorLog) {
      this._glErrors.push({ where, code: err, count: this._glErrorCounts[key] });
    }
    console.error(`[scaffolding-shader] GL error 0x${err.toString(16)} at ${where}`);
  }

  setProgram (compiled, readVariable) {
    const gl = this.gl;
    this._compiled = compiled;
    if (readVariable) this._readVariable = readVariable;
    this._glStateReady = false;
    this._uniformCache = null;
    this._lastVarVals = {};
    this._lastW = -1;
    this._lastH = -1;
    this._screenListCache = new Map();
    const compiledProgram = this._compileProgram(compiled);
    if (!compiledProgram) return false;
    if (this._program) this.gl.deleteProgram(this._program);
    this._program = compiledProgram.program;
    this._locations = compiledProgram.locations;
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.useProgram(this._program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(this._locations.aPos);
    gl.vertexAttribPointer(this._locations.aPos, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    this._glStateReady = true;
    return true;
  }

  _compileProgram (compiled) {
    const gl = this.gl;
    const program = this._link(compiled.vertexSource, compiled.fragmentSource);
    if (!program) return null;
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    const locations = {
      aPos: posLoc,
      uResolution: gl.getUniformLocation(program, 'u_resolution'),
      uTime: gl.getUniformLocation(program, 'u_time'),
      vars: [],
      listAtlas: null
    };
    for (const v of compiled.variableUniforms || []) {
      locations.vars.push({
        name: v.scratchName,
        uniform: v.uniform,
        loc: gl.getUniformLocation(program, v.uniform)
      });
    }
    locations.listAtlas = this._buildListAtlasLocations(program, compiled.listTextures || []);
    locations.uMouseX = compiled.needsMouse ? gl.getUniformLocation(program, 'u_mouse_x') : null;
    locations.uMouseY = compiled.needsMouse ? gl.getUniformLocation(program, 'u_mouse_y') : null;
    locations.uMouseDown = compiled.needsMouse ? gl.getUniformLocation(program, 'u_mouse_down') : null;
    locations.uCounter = compiled.needsCounter ? gl.getUniformLocation(program, 'u_counter') : null;
    locations.keys = [];
    for (const k of compiled.keyUniforms || []) {
      locations.keys.push({
        key: k.key,
        uniform: k.uniform,
        loc: gl.getUniformLocation(program, k.uniform)
      });
    }
    return { program, locations };
  }

  setListReader (fn) {
    this._readList = fn || (() => null);
  }

  uploadListData () {
    if (!this._compiled || !this._compiled.listTextures) return;
    const gl = this.gl;
    const listSpecs = this._compiled.listTextures;
    const maxTexIndex = listSpecs.reduce((m, s) => Math.max(m, s.texIndex), -1);
    const numPacks = maxTexIndex + 1;
    if (!numPacks) {
      this._destroyListTextures();
      return;
    }
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
    this._listPackInfo = packInfo;
    const existing = this._listTextures[0];
    if (existing && existing.width === Math.min(maxLen, MAX_TEX_SIZE)) {
      this._updateListAtlasInPlace(existing, packInfo, maxLen);
    } else {
      this._destroyListTextures();
      this._listTextures = [this._buildListAtlas(packInfo, maxLen)];
    }
  }

  _updateListAtlasInPlace (atlas, packs, maxLen) {
    const gl = this.gl;
    const width = atlas.width;
    const packHeights = packs.map((channels) => {
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
    if (totalHeight !== atlas.height) {
      this._destroyListTextures();
      this._listTextures = [this._buildListAtlas(packs, maxLen)];
      return;
    }
    const texels = width * totalHeight;
    const buf = new Float32Array(texels * 4);
    for (let pi = 0; pi < packs.length; pi++) {
      const channels = packs[pi];
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
    gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
    const type = this._texType;
    let uploadBuf;
    if (this._isFloat) {
      uploadBuf = buf;
    } else {
      uploadBuf = new Uint8Array(texels * 4);
      for (let i = 0; i < buf.length; i++) {
        uploadBuf[i] = Math.max(0, Math.min(255, Math.round(buf[i])));
      }
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, totalHeight, gl.RGBA, type, uploadBuf);
    atlas.packs = packs.map((channels, pi) => {
      const lengths = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        if (channels[c]) lengths[c] = channels[c].data.length;
      }
      return { offset: offsets[pi], height: packHeights[pi], lengths };
    });
  }

  _buildListAtlas (packs, maxLen) {
    const gl = this.gl;
    const width = Math.min(maxLen, MAX_TEX_SIZE);
    const packHeights = packs.map((channels) => {
      let len = 1;
      for (const ch of channels) {
        if (ch && ch.data.length > len) len = ch.data.length;
      }
      return Math.max(1, Math.ceil(len / width));
    });
    const offsets = [];
    let totalHeight = 0;
    for (const h of packHeights) {
      offsets.push(totalHeight);
      totalHeight += h;
    }
    const texels = width * totalHeight;
    const buf = new Float32Array(texels * 4);
    for (let pi = 0; pi < packs.length; pi++) {
      const channels = packs[pi];
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
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const type = this._texType;
    let uploadBuf;
    if (this._isFloat) {
      uploadBuf = buf;
    } else {
      uploadBuf = new Uint8Array(texels * 4);
      for (let i = 0; i < buf.length; i++) {
        const v = Math.max(0, Math.min(255, Math.round(buf[i])));
        uploadBuf[i] = v;
      }
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, totalHeight, 0, gl.RGBA, type, uploadBuf);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const err = gl.getError();
    if (err) {
      console.error('[scaffolding-shader] Failed to upload list atlas texture:', err);
    }
    return {
      texture: tex,
      width,
      height: totalHeight,
      packs: packs.map((channels, pi) => {
        const lengths = [0, 0, 0, 0];
        for (let c = 0; c < 4; c++) {
          if (channels[c]) lengths[c] = channels[c].data.length;
        }
        return { offset: offsets[pi], height: packHeights[pi], lengths };
      })
    };
  }

  _prepareListLocations (compiled) {
    this._locations.listAtlas = this._buildListAtlasLocations(this._program, compiled.listTextures || []);
  }

  _buildListAtlasLocations (program, listSpecs) {
    const gl = this.gl;
    const maxTexIndex = listSpecs.reduce((m, s) => Math.max(m, s.texIndex), -1);
    const listAtlas = {
      tex: gl.getUniformLocation(program, 'sc_ltex'),
      size: gl.getUniformLocation(program, 'sc_ltex_size'),
      sizeInv: gl.getUniformLocation(program, 'sc_ltex_size_inv'),
      packs: []
    };
    for (let pi = 0; pi <= maxTexIndex; pi++) {
      listAtlas.packs.push({
        llen: gl.getUniformLocation(program, `sc_llen_${pi}`),
        lmeta: gl.getUniformLocation(program, `sc_lmeta_${pi}`)
      });
    }
    return listAtlas;
  }

  _compileShader (type, src) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || 'unknown shader error';
      gl.deleteShader(shader);
      this._lastError = log;
      return null;
    }
    this._checkGlError('compileShader');
    return shader;
  }

  _link (vertSrc, fragSrc) {
    const gl = this.gl;
    const vert = this._compileShader(gl.VERTEX_SHADER, vertSrc);
    if (!vert) {
      console.error('[scaffolding-shader] Vertex shader error:', this._lastError);
      return null;
    }
    const frag = this._compileShader(gl.FRAGMENT_SHADER, fragSrc);
    if (!frag) {
      console.error('[scaffolding-shader] Fragment shader error:', this._lastError);
      console.error('[scaffolding-shader] Fragment source:\n' + fragSrc);
      gl.deleteShader(vert);
      return null;
    }
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || 'unknown link error';
      console.error('[scaffolding-shader] Program link error:', log);
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  resize (width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  resetTime () {
    this._startTime = performance.now();
    this._pausedAt = null;
  }

  getTime () {
    const now = this._pausedAt !== null ? this._pausedAt : performance.now();
    return (now - this._startTime) / 1000;
  }

  pauseTime () {
    if (this._pausedAt !== null) return;
    this._pausedAt = performance.now();
  }

  resumeTime () {
    if (this._pausedAt === null) return;
    this._startTime += performance.now() - this._pausedAt;
    this._pausedAt = null;
  }

  start () {
    if (this._running) return;
    if (!this._program) return;
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
    const gl = this.gl;
    if (!this._program) return;
    if (!this._glStateReady) {
      gl.useProgram(this._program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
      gl.enableVertexAttribArray(this._locations.aPos);
      gl.vertexAttribPointer(this._locations.aPos, 2, gl.FLOAT, false, 0, 0);
      this._glStateReady = true;
      this._lastW = -1;
      this._lastH = -1;
      this._lastVarVals = {};
    }
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (this._lastW !== w || this._lastH !== h) {
      gl.uniform2f(this._locations.uResolution, w, h);
      gl.viewport(0, 0, w, h);
      this._lastW = w;
      this._lastH = h;
    }
    gl.uniform1f(this._locations.uTime, this.getTime());
    this._uploadInputUniforms(this._locations);
    this._refreshListDataIfChanged();
    const cache = this._readVariableCache();
    for (const v of this._locations.vars) {
      const val = cache[v.name] !== undefined ? cache[v.name] : 0;
      if (this._lastVarVals[v.name] !== val) {
        gl.uniform1f(v.loc, val);
        this._lastVarVals[v.name] = val;
      }
    }
    const atlas = this._listTextures[0];
    const atlasLoc = this._locations.listAtlas;
    if (atlas && atlasLoc) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(atlasLoc.tex, 0);
      gl.uniform2f(atlasLoc.size, atlas.width, atlas.height);
      gl.uniform2f(atlasLoc.sizeInv, 1 / atlas.width, 1 / atlas.height);
      for (let pi = 0; pi < atlas.packs.length; pi++) {
        const pack = atlas.packs[pi];
        const loc = atlasLoc.packs[pi];
        if (!pack || !loc) continue;
        gl.uniform4f(loc.llen, pack.lengths[0] || 0, pack.lengths[1] || 0, pack.lengths[2] || 0, pack.lengths[3] || 0);
        gl.uniform3f(loc.lmeta, atlas.width, pack.height, pack.offset);
      }
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    for (const hook of this._postRenderHooks) {
      try { hook(); } catch (e) {
        console.error('[scaffolding-shader] post-render hook error:', e && e.message || e);
      }
    }
  }

  // The screen render path used to upload list data once at enable time. If a
  // list is mutated on the CPU side while the shader is running (push/append/
  // set index), the GPU texture was never refreshed, so pixel(x,y) kept
  // reading the snapshot from the first green flag. Compute kernels already
  // rebuild their atlas every frame (see _getComputeAtlas), but the screen
  // path's render() only reads this._listTextures[0]. To fix this without
  // re-uploading every frame (which allocates a width*height*4 Float32Array
  // per call), compare each list element-wise against the last snapshot we
  // uploaded and only re-upload when one actually changed. A hashed
  // signature was tried first but silently missed single-element edits that
  // fell between sample taps (e.g. setting item 1 of a 1-element list),
  // which is exactly the case the user hit.
  _refreshListDataIfChanged () {
    const compiled = this._compiled;
    const specs = compiled && compiled.listTextures;
    if (!specs || !specs.length) return;
    if (!this._screenListCache) this._screenListCache = new Map();
    const cache = this._screenListCache;
    let changed = false;
    for (const spec of specs) {
      const data = this._readList(spec.scratchName);
      const prev = cache.get(spec.scratchName);
      if (data === prev) continue;
      if (!data || !prev || data.length !== prev.length) {
        cache.set(spec.scratchName, data);
        changed = true;
        continue;
      }
      let diff = false;
      for (let i = 0; i < data.length; i++) {
        if (data[i] !== prev[i]) { diff = true; break; }
      }
      cache.set(spec.scratchName, data);
      if (diff) changed = true;
    }
    if (changed) this.uploadListData();
  }

  _collectPackInfo (compiled, readList) {
    readList = readList || this._readList;
    const listSpecs = compiled.listTextures || [];
    const maxTexIndex = listSpecs.reduce((m, s) => Math.max(m, s.texIndex), -1);
    const numPacks = maxTexIndex + 1;
    if (!numPacks) return null;
    let maxLen = 1;
    const packInfo = new Array(numPacks).fill(null);
    for (let pi = 0; pi < numPacks; pi++) {
      const channels = [null, null, null, null];
      for (const spec of listSpecs) {
        if (spec.texIndex !== pi) continue;
        const data = readList(spec.scratchName);
        if (!data) continue;
        channels[spec.channel] = { name: spec.scratchName, data };
        if (data.length > maxLen) maxLen = data.length;
      }
      packInfo[pi] = channels;
    }
    return { packInfo, maxLen };
  }

  _buildAtlasForCompiled (compiled, readList) {
    const info = this._collectPackInfo(compiled, readList);
    if (!info) return null;
    return this._buildListAtlas(info.packInfo, info.maxLen);
  }

  _ensureComputeTarget (width, height) {
    const gl = this.gl;
    if (this._computeTexture && this._computeWidth === width && this._computeHeight === height) {
      return;
    }
    if (this._computeFbo) gl.deleteFramebuffer(this._computeFbo);
    if (this._computeTexture) gl.deleteTexture(this._computeTexture);
    this._computeWidth = width;
    this._computeHeight = height;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('[scaffolding-shader] Compute FBO incomplete:', status);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this._computeFbo = fbo;
    this._computeTexture = tex;
  }

  _getComputeProgram (compiled) {
    const key = compiled.fragmentSource;
    if (this._computeProgramCacheKey === key && this._computeProgramCache) {
      return this._computeProgramCache;
    }
    if (this._computeProgramCache) {
      this.gl.deleteProgram(this._computeProgramCache.program);
    }
    const programInfo = this._compileProgram(compiled);
    if (!programInfo) return null;
    this._computeProgramCache = programInfo;
    this._computeProgramCacheKey = key;
    if (this._computeProgram) {
      this.gl.deleteProgram(this._computeProgram);
      this._computeProgram = null;
    }
    return programInfo;
  }

  _getComputeAtlas (compiled, readList) {
    const info = this._collectPackInfo(compiled, readList);
    if (!info) return null;

    const sameCompiled = this._computeAtlasCompiled === compiled;
    const existing = this._computeAtlas;
    const width = Math.min(info.maxLen, MAX_TEX_SIZE);

    if (sameCompiled && existing && existing.width === width) {
      this._updateListAtlasInPlace(existing, info.packInfo, info.maxLen);
      return existing;
    }

    if (existing) {
      this.gl.deleteTexture(existing.texture);
    }
    const atlas = this._buildListAtlas(info.packInfo, info.maxLen);
    this._computeAtlas = atlas;
    this._computeAtlasCompiled = compiled;
    return atlas;
  }

  runComputePass (compiled, width, height, readVariable, readList) {
    const gl = this.gl;
    if (!compiled || !compiled.fragmentSource) return null;
    this._ensureComputeTarget(width, height);

    const programInfo = this._getComputeProgram(compiled);
    if (!programInfo) {
      console.error('[scaffolding-shader] Compute program failed to compile');
      return null;
    }
    if (this._computeProgram !== programInfo.program) {
      if (this._computeProgram) gl.deleteProgram(this._computeProgram);
      this._computeProgram = programInfo.program;
    }

    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._computeFbo);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this._computeProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(programInfo.locations.aPos);
    gl.vertexAttribPointer(programInfo.locations.aPos, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(programInfo.locations.uResolution, width, height);
    gl.uniform1f(programInfo.locations.uTime, 0);
    this._uploadInputUniforms(programInfo.locations);

    const variableCache = readVariable ? readVariable() : this._readVariableCache();
    for (const v of programInfo.locations.vars) {
      const val = variableCache[v.name] !== undefined ? variableCache[v.name] : 0;
      gl.uniform1f(v.loc, val);
    }

    const atlas = this._getComputeAtlas(compiled, readList);
    const atlasLoc = programInfo.locations.listAtlas;
    if (atlas && atlasLoc) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(atlasLoc.tex, 0);
      gl.uniform2f(atlasLoc.size, atlas.width, atlas.height);
      gl.uniform2f(atlasLoc.sizeInv, 1 / atlas.width, 1 / atlas.height);
      for (let pi = 0; pi < atlas.packs.length; pi++) {
        const pack = atlas.packs[pi];
        const loc = atlasLoc.packs[pi];
        if (!pack || !loc) continue;
        gl.uniform4f(loc.llen, pack.lengths[0] || 0, pack.lengths[1] || 0, pack.lengths[2] || 0, pack.lengths[3] || 0);
        gl.uniform3f(loc.lmeta, atlas.width, pack.height, pack.offset);
      }
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);

    this._glStateReady = false;

    const out = new Float32Array(width * height);
    for (let i = 0; i < out.length; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      out[i] = (r * 65536) + (g * 256) + b;
    }
    return out;
  }

  invalidateUniformCache () {
    this._uniformCache = null;
  }

  setVariableCacheProvider (fn) {
    this._readVariableCache = fn || (() => ({}));
  }

  setInputProvider (fn) {
    this._inputProvider = fn || (() => ({}));
  }

  _uploadInputUniforms (loc) {
    const gl = this.gl;
    if (!loc) return;
    let input = null;
    const getInput = () => {
      if (!input) input = this._inputProvider();
      return input;
    };
    if (loc.uMouseX != null) {
      const i = getInput();
      gl.uniform1f(loc.uMouseX, i.mouseX || 0);
      gl.uniform1f(loc.uMouseY, i.mouseY || 0);
      gl.uniform1f(loc.uMouseDown, i.mouseDown ? 1.0 : 0.0);
    }
    if (loc.uCounter != null) {
      const i = getInput();
      gl.uniform1f(loc.uCounter, i.counter || 0);
    }
    if (loc.keys && loc.keys.length) {
      const i = getInput();
      const keys = i.keys || {};
      for (const k of loc.keys) {
        gl.uniform1f(k.loc, keys[k.key] ? 1.0 : 0.0);
      }
    }
  }

  _destroyListTextures () {
    const gl = this.gl;
    for (const info of this._listTextures) {
      if (info && info.texture) gl.deleteTexture(info.texture);
    }
    this._listTextures = [];
  }

  destroy () {
    this.stop();
    this._destroyListTextures();
    if (this._program) {
      this.gl.deleteProgram(this._program);
      this._program = null;
    }
    if (this._computeProgram) {
      this.gl.deleteProgram(this._computeProgram);
      this._computeProgram = null;
    }
    if (this._computeProgramCache) {
      this.gl.deleteProgram(this._computeProgramCache.program);
      this._computeProgramCache = null;
      this._computeProgramCacheKey = null;
    }
    if (this._computeAtlas) {
      this.gl.deleteTexture(this._computeAtlas.texture);
      this._computeAtlas = null;
      this._computeAtlasCompiled = null;
    }
    if (this._computeFbo) {
      this.gl.deleteFramebuffer(this._computeFbo);
      this._computeFbo = null;
    }
    if (this._computeTexture) {
      this.gl.deleteTexture(this._computeTexture);
      this._computeTexture = null;
    }
    if (this._buffer) {
      this.gl.deleteBuffer(this._buffer);
      this._buffer = null;
    }
  }
}

export default ShaderRenderer;
