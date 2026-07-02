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
    this._listDataSig = null;
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
    const program = this._link(compiled.vertexSource, compiled.fragmentSource);
    if (!program) return false;
    if (this._program) this.gl.deleteProgram(this._program);
    this._program = program;
    const posLoc = gl.getAttribLocation(program, 'a_pos');
    this._locations = {
      aPos: posLoc,
      uResolution: gl.getUniformLocation(program, 'u_resolution'),
      uTime: gl.getUniformLocation(program, 'u_time'),
      vars: [],
      lists: []
    };
    for (const v of compiled.variableUniforms || []) {
      this._locations.vars.push({
        name: v.scratchName,
        uniform: v.uniform,
        loc: gl.getUniformLocation(program, v.uniform)
      });
    }
    this._prepareListLocations(compiled);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.useProgram(this._program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    this._glStateReady = true;
    return true;
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
      this._createListAtlas(packInfo, maxLen);
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
      this._createListAtlas(packs, maxLen);
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

  _createListAtlas (packs, maxLen) {
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
    this._listTextures = [{
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
    }];
    const err = gl.getError();
    if (err) {
      console.error('[scaffolding-shader] Failed to upload list atlas texture:', err);
    }
  }

  _prepareListLocations (compiled) {
    const gl = this.gl;
    const program = this._program;
    const listSpecs = compiled.listTextures || [];
    const maxTexIndex = listSpecs.reduce((m, s) => Math.max(m, s.texIndex), -1);
    this._locations.listAtlas = {
      tex: gl.getUniformLocation(program, 'sc_ltex'),
      size: gl.getUniformLocation(program, 'sc_ltex_size'),
      sizeInv: gl.getUniformLocation(program, 'sc_ltex_size_inv'),
      packs: []
    };
    for (let pi = 0; pi <= maxTexIndex; pi++) {
      this._locations.listAtlas.packs.push({
        llen: gl.getUniformLocation(program, `sc_llen_${pi}`),
        lmeta: gl.getUniformLocation(program, `sc_lmeta_${pi}`)
      });
    }
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
  }

  getTime () {
    return (performance.now() - this._startTime) / 1000;
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
    }
    gl.uniform2f(this._locations.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(this._locations.uTime, this.getTime());
    const cache = this._readVariableCache();
    for (const v of this._locations.vars) {
      gl.uniform1f(v.loc, cache[v.name] !== undefined ? cache[v.name] : 0);
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
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  invalidateUniformCache () {
    this._uniformCache = null;
  }

  setVariableCacheProvider (fn) {
    this._readVariableCache = fn || (() => ({}));
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
    if (this._buffer) {
      this.gl.deleteBuffer(this._buffer);
      this._buffer = null;
    }
  }
}

export default ShaderRenderer;
