const PIXEL_NAME = 'pixel';
const MAX_LOOP = 256;
const MAX_UNROLL = 128;
const MAX_TEX_SIZE = 2048;
const SUBSTACK_INPUTS = new Set(['SUBSTACK', 'SUBSTACK2', 'SUBSTACK3']);

const sanitize = (logical, prefix) => {
  let s = String(logical == null ? '' : logical).trim().replace(/[^a-zA-Z0-9_]/g, '_');
  s = s.replace(/_+/g, '_');
  if (!/^[a-zA-Z_]/.test(s)) s = '_' + s;
  let result = prefix + s;
  result = result.replace(/_+/g, '_');
  return result;
};

const parseNum = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const glslNum = (n) => {
  if (n === Infinity) return '1e20';
  if (n === -Infinity) return '-1e20';
  if (isNaN(n)) return '0.0';
  const s = String(n);
  if (s.indexOf('.') === -1 && s.indexOf('e') === -1 && s.indexOf('E') === -1) {
    return s + '.0';
  }
  return s;
};

export class ScratchShaderCompiler {
  constructor (runtime) {
    this.runtime = runtime;
    this.warnings = [];
    this.errors = [];
    this._blocks = null;
    this._nameMap = new Map();
    this._usedNames = new Set();
    this._usedNames.add('main');
    this._procedures = new Map();
    this._pixel = null;
    this._pixelFnName = null;
    this._kernel = null;
    this._kernelMode = 'screen';
    this._varUsage = new Map();
    this._listUsage = new Map();
    this._uniformVars = [];
    this._globalVars = [];
    this._globalVarInitializers = new Map();
    this._listTextures = [];
    this._scope = null;
    this._isReporterFn = false;
    this._colorWritten = false;
    this._loopCounter = 0;
    this._randCounter = 0;
    this._mutableListNames = new Set();
    this._mutableListSizes = new Map();
    this._listInitialLengths = new Map();
    this._globalMutableArrays = [];
    this._mutableReaderName = new Map();
    this._needsMouse = false;
    this._needsCounter = false;
    this._keyUniforms = new Map();
    this._mutableIndexOffFns = new Map();
    this._readOnlyIndexOffFns = new Map();
  }

  _uid (logical, prefix) {
    const key = prefix + '|' + logical;
    const cached = this._nameMap.get(key);
    if (cached) return cached;
    let base = sanitize(logical, prefix);
    let name = base;
    let i = 2;
    while (this._usedNames.has(name)) {
      name = base + '_' + i++;
    }
    this._usedNames.add(name);
    this._nameMap.set(key, name);
    return name;
  }

  // GLSL array name for a mutable (shader-written) list.
  _mutableArrayName (scratchName) {
    return this._uid(scratchName, 'sc_la_');
  }

  // GLSL length-tracking variable name for a mutable list.
  _mutableLenName (scratchName) {
    return this._uid(scratchName, 'sc_len_');
  }

  _isMutableList (scratchName) {
    return this._mutableListNames && this._mutableListNames.has(scratchName);
  }

  _block (id) {
    if (!id) return null;
    return this._blocks._blocks[id] || null;
  }

  _inputChild (input) {
    if (!input) return null;
    if (input.block !== null && input.block !== undefined) return input.block;
    if (input.shadow !== null && input.shadow !== undefined) return input.shadow;
    return null;
  }

  _getField (block, name) {
    const f = block && block.fields && block.fields[name];
    return f ? f.value : null;
  }

  compile () {
    return this.compileKernel(null, 'screen');
  }

  compileKernel (kernel, mode = 'screen') {
    this._kernel = kernel;
    this._kernelMode = mode;
    this._discoverProcedures();
    if (this._procedures.size === 0) {
      return { found: false, warnings: this.warnings, errors: this.errors };
    }
    if (kernel) {
      const info = this._procedures.get(kernel.proccode);
      if (!info) {
        return { found: false, warnings: this.warnings, errors: this.errors };
      }
      this._pixel = info;
      if (this._pixel.isReporter) {
        this.errors.push(`The "${kernel.proccode}" block must be a command (stack) block, not a reporter.`);
        return { found: true, warnings: this.warnings, errors: this.errors };
      }
    } else {
      this._pixel = this._findPixel();
      if (!this._pixel) {
        return { found: false, warnings: this.warnings, errors: this.errors };
      }
      if (this._pixel.isReporter) {
        this.errors.push('The "pixel" block must be a command (stack) block, not a reporter.');
        return { found: true, warnings: this.warnings, errors: this.errors };
      }
    }
    this._pruneUnreachable();
    const cycle = this._detectRecursion();
    if (cycle) {
      this.errors.push(`Recursion is not supported in shaders: ${cycle.join(' -> ')}`);
      return { found: true, warnings: this.warnings, errors: this.errors };
    }
    this._analyzeUsage();
    if (this.errors.length) {
      return { found: true, warnings: this.warnings, errors: this.errors };
    }
    const fragmentSource = this._generateFragment();
    const vertexSource = this._generateVertex();
    return {
      found: true,
      fragmentSource,
      vertexSource,
      variableUniforms: this._uniformVars.slice(),
      listTextures: this._listTextures.slice(),
      pixelArgNames: this._pixel.paramNames.slice(),
      kernelMode: this._kernelMode,
      warnings: this.warnings,
      errors: this.errors,
      needsMouse: this._needsMouse,
      keyUniforms: Array.from(this._keyUniforms.entries()).map(([key, uniform]) => ({key, uniform})),
      needsCounter: this._needsCounter
    };
  }

  _discoverProcedures () {
    const targets = (this.runtime && this.runtime.targets) || [];
    for (const target of targets) {
      const blocks = target && target.blocks;
      if (!blocks || !blocks._blocks) continue;
      for (const id in blocks._blocks) {
        const b = blocks._blocks[id];
        if (b.opcode !== 'procedures_definition') continue;
        const proto = blocks._blocks[b.inputs && b.inputs.custom_block && b.inputs.custom_block.block];
        if (!proto || !proto.mutation || !proto.mutation.proccode) continue;
        const proccode = proto.mutation.proccode;
        let paramNames = [];
        try { paramNames = JSON.parse(proto.mutation.argumentnames || '[]'); } catch (e) { paramNames = []; }
        const bodyHead = b.next || null;
        const isReporter = this._bodyContainsReturn(bodyHead, blocks);
        if (this._procedures.has(proccode)) {
          this.warnings.push(`Duplicate custom block definition ignored: ${proccode}`);
          continue;
        }
        this._procedures.set(proccode, {
          proccode,
          paramNames,
          bodyHead,
          isReporter,
          blocks
        });
      }
    }
  }

  _bodyContainsReturn (headId, blocks) {
    let id = headId;
    while (id) {
      const b = blocks._blocks[id];
      if (!b) break;
      if (b.opcode === 'procedures_return') return true;
      id = b.next;
    }
    return false;
  }

  _findPixel () {
    let found = null;
    for (const info of this._procedures.values()) {
      const label = info.proccode.replace(/%[nsb]/g, '').trim().toLowerCase();
      if (label === PIXEL_NAME && info.paramNames.length === 2) {
        if (found) {
          this.warnings.push('Multiple "pixel" blocks found; using the first one.');
          break;
        }
        found = info;
      }
    }
    return found;
  }

  _pruneUnreachable () {
    const reachable = new Set();
    const queue = [this._pixel.proccode];
    while (queue.length) {
      const code = queue.pop();
      if (reachable.has(code)) continue;
      reachable.add(code);
      const info = this._procedures.get(code);
      if (!info) continue;
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        if (b.opcode === 'procedures_call' && b.mutation && b.mutation.proccode) {
          const callee = b.mutation.proccode;
          if (this._procedures.has(callee) && !reachable.has(callee)) {
            queue.push(callee);
          }
        }
      });
    }
    for (const code of this._procedures.keys()) {
      if (!reachable.has(code)) {
        this._procedures.delete(code);
      }
    }
  }

  _packLists () {
    this._listPacks = [];
    this._listSlot = new Map();
    // Lists that are both read and written inside the shader (e.g. a per-ray
    // traversal "stack") cannot live in a read-only texture. They are compiled
    // to fixed-size GLSL arrays instead. The mutable set is computed once in
    // _collectMutableLists() during _analyzeUsage(); here we just pack the
    // remaining read-only lists into texture channels.
    const readLists = [];
    for (const [name, usage] of this._listUsage) {
      if (!usage.read) continue;
      if (this._mutableListNames && this._mutableListNames.has(name)) continue;
      readLists.push(name);
    }
    const PACK_SIZE = 4;
    for (let i = 0; i < readLists.length; i += PACK_SIZE) {
      const batch = readLists.slice(i, i + PACK_SIZE);
      const channels = [];
      for (let c = 0; c < PACK_SIZE; c++) {
        if (c < batch.length) {
          channels.push(batch[c]);
          this._listSlot.set(batch[c], { texIndex: this._listPacks.length, channel: c });
        } else {
          channels.push(null);
        }
      }
      this._listPacks.push({ channels });
    }
    for (let pi = 0; pi < this._listPacks.length; pi++) {
      const pack = this._listPacks[pi];
      for (let ci = 0; ci < pack.channels.length; ci++) {
        if (pack.channels[ci]) {
          this._listTextures.push({
            scratchName: pack.channels[ci],
            texIndex: pi,
            channel: ci
          });
        }
      }
    }
  }

  _detectRecursion () {
    const calls = new Map();
    for (const [code, info] of this._procedures) {
      const callees = new Set();
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        if (b.opcode === 'procedures_call' && b.mutation && b.mutation.proccode) {
          callees.add(b.mutation.proccode);
        }
      });
      calls.set(code, callees);
    }
    const visiting = new Set();
    const path = [];
    const dfs = (node) => {
      if (visiting.has(node)) {
        const start = path.indexOf(node);
        return path.slice(start).concat(node);
      }
      visiting.add(node);
      path.push(node);
      const next = calls.get(node);
      if (next) {
        for (const c of next) {
          if (this._procedures.has(c)) {
            const cycle = dfs(c);
            if (cycle) return cycle;
          }
        }
      }
      path.pop();
      visiting.delete(node);
      return null;
    };
    for (const code of this._procedures.keys()) {
      const cycle = dfs(code);
      if (cycle) return cycle;
    }
    return null;
  }

  _walkAll (headId, blocks, visit) {
    let id = headId;
    while (id) {
      const b = blocks._blocks[id];
      if (!b) break;
      visit(b);
      for (const key in b.inputs) {
        const childId = this._inputChild(b.inputs[key]);
        if (!childId) continue;
        if (SUBSTACK_INPUTS.has(key)) {
          this._walkAll(childId, blocks, visit);
        } else {
          this._walkValue(childId, blocks, visit);
        }
      }
      id = b.next;
    }
  }

  _walkValue (blockId, blocks, visit) {
    const b = blocks._blocks[blockId];
    if (!b) return;
    visit(b);
    for (const key in b.inputs) {
      const childId = this._inputChild(b.inputs[key]);
      if (!childId) continue;
      if (SUBSTACK_INPUTS.has(key)) {
        this._walkAll(childId, blocks, visit);
      } else {
        this._walkValue(childId, blocks, visit);
      }
    }
  }

  _markUsage (name, read, written) {
    if (!name) return;
    const key = String(name);
    const entry = this._varUsage.get(key) || { read: false, written: false };
    if (read) entry.read = true;
    if (written) entry.written = true;
    this._varUsage.set(key, entry);
  }

  _markListUsage (name, read, written) {
    if (!name) return;
    const key = String(name);
    const entry = this._listUsage.get(key) || { read: false, written: false };
    if (read) entry.read = true;
    if (written) entry.written = true;
    this._listUsage.set(key, entry);
  }

  _analyzeUsage () {
    for (const info of this._procedures.values()) {
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        const op = b.opcode;
        if (op === 'data_variable') {
          this._markUsage(this._getField(b, 'VARIABLE'), true, false);
        } else if (op === 'data_setvariableto' || op === 'data_changevariableby') {
          this._markUsage(this._getField(b, 'VARIABLE'), false, true);
        } else if (op === 'control_for_each') {
          this._markUsage(this._getField(b, 'VARIABLE'), false, true);
        } else if (op === 'data_itemoflist' || op === 'data_lengthoflist' || op === 'data_listcontainsitem' || op === 'data_itemnumoflist' || op === 'data_listcontents') {
          this._markListUsage(this._getField(b, 'LIST'), true, false);
        } else if (op === 'data_replaceitemoflist' || op === 'data_addtolist' || op === 'data_insertatlist' || op === 'data_deleteoflist' || op === 'data_deletealloflist') {
          this._markListUsage(this._getField(b, 'LIST'), false, true);
        }
      });
    }
    this._collectMutableLists();
  }

  _collectMutableLists () {
    // The capacity of a mutable (read+write) GLSL array. The sb3's
    // `list.length` at compile time is only a lower bound: the path-tracer
    // and BVH traversal can legitimately grow the list further, and if the
    // array is too small every push past the cap becomes a silent no-op,
    // which corrupts the BVH stack and makes the BVH miss entire regions of
    // the scene. The CPU execution uses scratch-vm lists which grow on
    // demand, so we have to over-provision the shader's fixed-size array
    // to keep the two executions in lock-step. 1024 covers any BVH that
    // fits in a 480x360 stage without degenerating into a linked list.
    const MUTABLE_CAP_DEFAULT = 256;
    const MUTABLE_CAP_MAX = 1024;
    this._collectListInitialLengths();
    this._mutableListNames = new Set();
    this._mutableListSizes = new Map();
    for (const [name, usage] of this._listUsage) {
      if (usage.read && usage.written) {
        let cap = this._listInitialLengths.get(name) || MUTABLE_CAP_DEFAULT;
        if (cap < 1) cap = 1;
        if (cap > MUTABLE_CAP_MAX) cap = MUTABLE_CAP_MAX;
        this._mutableListNames.add(name);
        this._mutableListSizes.set(name, cap);
      }
    }
  }

  _generateVertex () {
    return [
      'attribute vec2 a_pos;',
      'void main() {',
      '  gl_Position = vec4(a_pos, 0.0, 1.0);',
      '}'
    ].join('\n');
  }

  _generateFragment () {
    const lines = [];
    lines.push('precision highp float;');
    lines.push('');
    lines.push('uniform vec2 u_resolution;');
    lines.push('uniform float u_time;');
    if (this._needsMouse) {
      lines.push('uniform float u_mouse_x;');
      lines.push('uniform float u_mouse_y;');
      lines.push('uniform float u_mouse_down;');
    }
    if (this._needsCounter) {
      lines.push('uniform float u_counter;');
    }
    if (this._keyUniforms.size) {
      for (const [, uniformName] of this._keyUniforms) {
        lines.push(`uniform float ${uniformName};`);
      }
    }
    const stageVars = this._stageVariableValues();
    for (const [name, usage] of this._varUsage) {
      if (name.toLowerCase() === 'color') continue;
      const v = this._uid(name, 'sc_v_');
      this._globalVars.push(v);
      if (stageVars.has(name) && usage.read && !usage.written) {
        const u = this._uid(name, 'sc_u_');
        this._uniformVars.push({ uniform: u, scratchName: name });
        this._globalVarInitializers.set(v, u);
        lines.push(`uniform float ${u};`);
      } else {
        const initial = stageVars.has(name) ? glslNum(parseNum(stageVars.get(name))) : '0.0';
        this._globalVarInitializers.set(v, initial);
      }
      if (!stageVars.has(name)) {
        this.warnings.push(`Variable "${name}" was not found as a Scratch variable; it will be treated as a shader-local temporary.`);
      }
      lines.push(`float ${v};`);
    }
    const colorGlobal = 'sc_color';
    lines.push(`float ${colorGlobal};`);
    lines.push('float sc_color_written;');
    lines.push('');
    this._packLists();
    if (this._listPacks.length) {
      lines.push('uniform sampler2D sc_ltex;');
      lines.push('uniform vec2 sc_ltex_size;');
      lines.push('uniform vec2 sc_ltex_size_inv;');
      for (let ti = 0; ti < this._listPacks.length; ti++) {
        const pack = this._listPacks[ti];
        // Pack sc_lsize and sc_loffset into a single vec3 uniform:
        //   .x = texture width (constant for the whole atlas),
        //   .y = pack height,
        //   .z = vertical offset in the atlas.
        lines.push(`uniform vec3 sc_lmeta_${ti};`);
        lines.push(`uniform vec4 sc_llen_${ti};`);
        for (let ci = 0; ci < pack.channels.length; ci++) {
          const ch = pack.channels[ci];
          if (!ch) continue;
          const swiz = ['x', 'y', 'z', 'w'][ci];
          const fnName = `sc_lget_${ti}_${ci}`;
          lines.push(`float ${fnName}(float idx) {`);
          lines.push(`  float len = sc_llen_${ti}.${swiz};`);
          lines.push('  if (len <= 0.0) return 0.0;');
          lines.push('  float i = clamp(idx - 1.0, 0.0, len - 1.0);');
          lines.push(`  float x = mod(i, sc_lmeta_${ti}.x) + 0.5;`);
          lines.push(`  float y = sc_lmeta_${ti}.z + floor(i / sc_lmeta_${ti}.x) + 0.5;`);
          lines.push(`  return texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).${swiz};`);
          lines.push('}');
          const iofn = `sc_lindexof_${ti}_${ci}`;
          lines.push(`float ${iofn}(float item) {`);
          lines.push(`  float len = sc_llen_${ti}.${swiz};`);
          lines.push('  if (len <= 0.0) return 0.0;');
          lines.push(`  for (int mi = 0; mi < ${MAX_TEX_SIZE}; mi++) {`);
          lines.push('    if (float(mi) >= len) break;');
          lines.push(`    float x = mod(float(mi), sc_lmeta_${ti}.x) + 0.5;`);
          lines.push(`    float y = sc_lmeta_${ti}.z + floor(float(mi) / sc_lmeta_${ti}.x) + 0.5;`);
          lines.push(`    float val = texture2D(sc_ltex, vec2(x * sc_ltex_size_inv.x, y * sc_ltex_size_inv.y)).${swiz};`);
          lines.push('    if (abs(val - item) < 0.000001) return float(mi) + 1.0;');
          lines.push('  }');
          lines.push('  return 0.0;');
          lines.push('}');
        }
      }
    }
    if (this._listPacks.length) lines.push('');
    // Mutable (shader-written) lists become fixed-size global arrays, with a
    // length-tracking scalar. They are reset to empty at the start of main().
    if (this._mutableListNames && this._mutableListNames.size) {
      this._globalMutableArrays = [];
      for (const name of this._mutableListNames) {
        const cap = this._mutableListSizes.get(name) || 64;
        const arr = this._mutableArrayName(name);
        const len = this._mutableLenName(name);
        lines.push(`float ${arr}[${cap}];`);
        lines.push(`float ${len};`);
        // Reader function. Searching in a loop keeps array indexing inside a
        // loop body, which is required for dynamic indices in GLSL ES 1.00.
        const rfn = this._uid(name, 'sc_laget_');
        this._mutableReaderName = this._mutableReaderName || new Map();
        this._mutableReaderName.set(name, rfn);
        lines.push(`float ${rfn}(float idx) {`);
        lines.push(`  if (${len} <= 0.0) return 0.0;`);
        lines.push(`  float gi = clamp(idx - 1.0, 0.0, ${len} - 1.0);`);
        lines.push(`  float result = 0.0;`);
        lines.push(`  for (int mi = 0; mi < ${cap}; mi++) {`);
        lines.push(`    if (float(mi) == gi) { result = ${arr}[mi]; break; }`);
        lines.push(`  }`);
        lines.push(`  return result;`);
        lines.push(`}`);
        const iofn = this._uid(name, 'sc_laindexof_');
        this._mutableIndexOffFns.set(name, iofn);
        lines.push(`float ${iofn}(float item) {`);
        lines.push(`  if (${len} <= 0.0) return 0.0;`);
        lines.push(`  for (int mi = 0; mi < ${cap}; mi++) {`);
        lines.push(`    if (float(mi) >= ${len}) break;`);
        lines.push(`    if (abs(${arr}[mi] - item) < 0.000001) return float(mi) + 1.0;`);
        lines.push(`  }`);
        lines.push(`  return 0.0;`);
        lines.push(`}`);
        this._globalMutableArrays.push({ arr, len, cap });
      }
      lines.push('');
    }
    lines.push('float sc_rand(vec3 co) {');
    lines.push('  co = fract(co * 0.3183099 + vec3(0.71, 0.113, 0.419));');
    lines.push('  co += dot(co, co.yzx + 19.19);');
    lines.push('  return fract((co.x + co.y) * (co.y + co.z) * (co.z + co.x));');
    lines.push('}');
    lines.push('');
    lines.push('float sc_tan(float angle) {');
    lines.push('  float a = mod(angle, 360.0);');
    lines.push('  if (abs(a - 90.0) < 1e-6) return 1e20;');
    lines.push('  if (abs(a - 270.0) < 1e-6) return -1e20;');
    lines.push('  return floor(tan(angle * 0.017453292519943295) * 1e10 + 0.5) / 1e10;');
    lines.push('}');
    lines.push('');
    const procOrder = this._topologicalOrder();
    for (const code of procOrder) {
      const info = this._procedures.get(code);
      const fnName = this._uid(code, 'sc_fn_');
      if (code === this._pixel.proccode) this._pixelFnName = fnName;
      const params = info.paramNames.map((p) => 'in float ' + this._uid(p, 'sc_a_'));
      const ret = info.isReporter ? 'float' : 'void';
      lines.push(`${ret} ${fnName}(${params.join(', ')});`);
    }
    lines.push('');
    for (const code of procOrder) {
      const info = this._procedures.get(code);
      this._generateProcedureBody(code, info, lines);
    }
    lines.push('');
    this._generateMain(lines);
    if (!this._colorWritten) {
      this.warnings.push('The "color" variable was never set inside the pixel block; the output will be black.');
    }
    return lines.join('\n');
  }

  _generateMain (lines) {
    const mode = this._kernelMode;
    const paramCount = this._pixel.paramNames.length;
    lines.push('void main() {');
    // Reset mutable (shader-written) lists to empty for this pixel.
    if (this._globalMutableArrays && this._globalMutableArrays.length) {
      for (const m of this._globalMutableArrays) {
        const li = this._loopVar();
        lines.push(`  ${m.len} = 0.0;`);
        lines.push(`  for (int ${li} = 0; ${li} < ${m.cap}; ${li}++) { ${m.arr}[${li}] = 0.0; }`);
      }
    }
    for (const v of this._globalVars) {
      lines.push(`  ${v} = ${this._globalVarInitializers.get(v) || '0.0'};`);
    }
    lines.push('  sc_color = 0.0;');
    lines.push('  sc_color_written = 0.0;');
    if (mode === 'compute') {
      if (paramCount !== 1) {
        this.errors.push(`Compute kernel "${this._pixel.proccode}" must accept exactly one parameter (index); found ${paramCount}.`);
      }
      // Scratch indices are 1-based, so the first fragment (idx=0) maps to list item 1.
      lines.push('  float sc_idx = gl_FragCoord.x + (gl_FragCoord.y * u_resolution.x) + 1.0;');
      lines.push(`  ${this._pixelFnName}(sc_idx);`);
    } else {
      if (paramCount !== 2) {
        this.errors.push(`Screen kernel "${this._pixel.proccode}" must accept exactly two parameters (x, y); found ${paramCount}.`);
      }
      lines.push('  float sc_px = gl_FragCoord.x - (u_resolution.x * 0.5);');
      lines.push('  float sc_py = gl_FragCoord.y - (u_resolution.y * 0.5);');
      lines.push(`  ${this._pixelFnName}(sc_px, sc_py);`);
    }
    lines.push('  float c = floor(sc_color + 0.5);');
    lines.push('  c = clamp(c, 0.0, 16777215.0);');
    lines.push('  float cr = floor(c / 65536.0);');
    lines.push('  float cg = mod(floor(c / 256.0), 256.0);');
    lines.push('  float cb = mod(c, 256.0);');
    lines.push('  gl_FragColor = vec4(cr / 255.0, cg / 255.0, cb / 255.0, sc_color_written);');
    lines.push('}');
  }

  _stageVariableValues () {
    const values = new Map();
    const targets = (this.runtime && this.runtime.targets) || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (Array.isArray(v)) {
          if (v[2] !== 'list') values.set(v[0], v[1]);
        } else if (v && v.type !== 'list') {
          values.set(v.name, v.value);
        }
      }
    }
    return values;
  }

  _collectListInitialLengths () {
    this._listInitialLengths = this._listInitialLengths || new Map();
    const targets = (this.runtime && this.runtime.targets) || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        // Deserialized runtime form: { name, value: [...], type: 'list' }
        if (v && v.type === 'list') {
          const arr = Array.isArray(v.value) ? v.value : [];
          if (!this._listInitialLengths.has(v.name) || arr.length > this._listInitialLengths.get(v.name)) {
            this._listInitialLengths.set(v.name, arr.length);
          }
        }
        // sb3 raw form: [name, items, 'list']
        if (Array.isArray(v) && v.length >= 3 && v[2] === 'list') {
          const arr = Array.isArray(v[1]) ? v[1] : [];
          if (!this._listInitialLengths.has(v[0]) || arr.length > this._listInitialLengths.get(v[0])) {
            this._listInitialLengths.set(v[0], arr.length);
          }
        }
      }
    }
  }

  _topologicalOrder () {
    const calls = new Map();
    for (const [code, info] of this._procedures) {
      const callees = [];
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        if (b.opcode === 'procedures_call' && b.mutation && b.mutation.proccode && this._procedures.has(b.mutation.proccode)) {
          callees.push(b.mutation.proccode);
        }
      });
      calls.set(code, callees);
    }
    const order = [];
    const visited = new Set();
    const visit = (code) => {
      if (visited.has(code)) return;
      visited.add(code);
      for (const c of calls.get(code) || []) visit(c);
      order.push(code);
    };
    for (const code of this._procedures.keys()) visit(code);
    return order;
  }

  _generateProcedureBody (code, info, lines) {
    const fnName = this._uid(code, 'sc_fn_');
    const params = info.paramNames.map((p) => 'in float ' + this._uid(p, 'sc_a_'));
    const ret = info.isReporter ? 'float' : 'void';
    lines.push(`${ret} ${fnName}(${params.join(', ')}) {`);
    const savedBlocks = this._blocks;
    const savedScope = this._scope;
    const savedReporter = this._isReporterFn;
    const savedColorWritten = this._colorWritten;
    const isPixel = (code === this._pixel.proccode);
    if (isPixel) this._colorWritten = false;
    this._blocks = info.blocks;
    this._isReporterFn = info.isReporter;
    this._scope = new Map();
    for (const p of info.paramNames) {
      this._scope.set(String(p), this._uid(p, 'sc_a_'));
    }
    const body = this._stmts(info.bodyHead, '  ');
    if (body) lines.push(body);
    if (info.isReporter) {
      lines.push('  return 0.0;');
    }
    lines.push('}');
    lines.push('');
    if (isPixel) {
      // _colorWritten was set during this body
    } else {
      this._colorWritten = savedColorWritten;
    }
    this._blocks = savedBlocks;
    this._scope = savedScope;
    this._isReporterFn = savedReporter;
  }

  _stmts (headId, ind) {
    const parts = [];
    let id = headId;
    while (id) {
      const b = this._block(id);
      if (!b) break;
      const s = this._stmt(b, ind);
      if (s) parts.push(s);
      id = b.next;
    }
    return parts.join('\n');
  }

  _stmt (b, ind) {
    const op = b.opcode;
    switch (op) {
      case 'data_setvariableto': {
        const name = this._getField(b, 'VARIABLE');
        const val = this._inputExpr(b, 'VALUE');
        const target = this._varTarget(name);
        const writeFlag = String(name).toLowerCase() === 'color' ? `\n${ind}sc_color_written = 1.0;` : '';
        return `${ind}${target} = ${val};${writeFlag}`;
      }
      case 'data_changevariableby': {
        const name = this._getField(b, 'VARIABLE');
        const valLit = this._literalValue(b, 'VALUE');
        if (valLit === 0) return `${ind}`;
        const val = this._inputExpr(b, 'VALUE');
        const target = this._varTarget(name);
        const writeFlag = String(name).toLowerCase() === 'color' ? `\n${ind}sc_color_written = 1.0;` : '';
        return `${ind}${target} += ${val};${writeFlag}`;
      }
      case 'control_if': {
        const cond = this._condExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        return `${ind}if (${cond}) {\n${body}\n${ind}}`;
      }
      case 'control_if_else': {
        const cond = this._condExpr(b, 'CONDITION');
        const body1 = this._substack(b, 'SUBSTACK', ind + '  ');
        const body2 = this._substack(b, 'SUBSTACK2', ind + '  ');
        return `${ind}if (${cond}) {\n${body1}\n${ind}} else {\n${body2}\n${ind}}`;
      }
      case 'control_repeat': {
        const times = this._inputExpr(b, 'TIMES');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const literal = this._literalInt(b.inputs && b.inputs.TIMES);
        if (literal !== null) {
          if (literal >= 0 && literal <= MAX_UNROLL) {
            const out = [];
            for (let i = 0; i < literal; i++) out.push(body);
            return out.join('\n');
          }
          if (literal > MAX_LOOP) {
            this.warnings.push(`Loop repeats ${literal} times but shader supports up to ${MAX_LOOP}; result may be incorrect.`);
          }
        }
        const lv = this._loopVar();
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (float(${lv}) >= ${times}) break;\n${body}\n${ind}}`;
      }
      case 'control_repeat_until': {
        const cond = this._condExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (${cond}) break;\n${body}\n${ind}}`;
      }
      case 'control_while': {
        const cond = this._condExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (!(${cond})) break;\n${body}\n${ind}}`;
      }
      case 'control_for_each': {
        const name = this._getField(b, 'VARIABLE');
        const count = this._inputExpr(b, 'VALUE');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const literal = this._literalInt(b.inputs && b.inputs.VALUE);
        if (literal !== null && literal > MAX_LOOP) {
          this.warnings.push(`for-each iterates ${literal} times but shader supports up to ${MAX_LOOP}; result may be incorrect.`);
        }
        const lv = this._loopVar();
        const target = this._varTarget(name);
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (float(${lv}) >= ${count}) break;\n${ind}  ${target} = float(${lv}) + 1.0;\n${body}\n${ind}}`;
      }
      case 'control_stop': {
        const option = this._getField(b, 'STOP_OPTION');
        if (option === 'this script') {
          if (this._isReporterFn) return `${ind}return 0.0;`;
          return `${ind}return;`;
        }
        this.warnings.push(`"${op}" with option "${option}" is ignored in shader mode.`);
        return `${ind}`;
      }
      case 'procedures_call': {
        const proccode = b.mutation && b.mutation.proccode;
        if (!proccode || !this._procedures.has(proccode)) {
          this.warnings.push(`Call to unknown custom block ignored: ${proccode}`);
          return `${ind}`;
        }
        const fnName = this._uid(proccode, 'sc_fn_');
        const argIds = this._parseArgIds(b);
        const args = argIds.map((aid) => this._inputExpr(b, aid));
        const isReporter = this._procedures.get(proccode).isReporter;
        if (isReporter) {
          this.warnings.push(`Custom reporter "${proccode}" used as a statement; its return value is discarded.`);
        }
        return `${ind}${fnName}(${args.join(', ')});`;
      }
      case 'procedures_return': {
        if (this._isReporterFn) {
          const val = this._inputExpr(b, 'VALUE');
          return `${ind}return ${val};`;
        }
        return `${ind}return;`;
      }
      case 'control_forever': {
        this.warnings.push('"forever" loop is compiled as a fixed 256-iteration loop in shader mode; it will not run forever.');
        const foreverBody = this._substack(b, 'SUBSTACK', ind + '  ');
        const fv = this._loopVar();
        return `${ind}for (int ${fv} = 0; ${fv} < ${MAX_LOOP}; ${fv}++) {\n${foreverBody}\n${ind}}`;
      }
      case 'control_wait':
      case 'control_wait_until':
        this.warnings.push(`"${op}" is ignored in shader mode.`);
        return `${ind}`;
      case 'control_all_at_once': {
        const body = this._substack(b, 'SUBSTACK', ind);
        return `${ind}${body}`;
      }
      case 'control_clear_counter':
        this.warnings.push('"clear counter" is ignored in shader mode: a shared counter is not meaningful when every pixel runs in parallel.');
        return `${ind}`;
      case 'control_incr_counter':
        this.warnings.push('"incr counter" is ignored in shader mode: a shared counter is not meaningful when every pixel runs in parallel.');
        return `${ind}`;
      case 'data_replaceitemoflist': {
        const name = this._getField(b, 'LIST');
        if (!this._isMutableList(name)) {
          this.warnings.push(`"${op}" on read-only list "${name}" is ignored in shader mode.`);
          return `${ind}`;
        }
        const arr = this._mutableArrayName(name);
        const len = this._mutableLenName(name);
        const cap = this._mutableListSizes.get(name) || 64;
        const idx = this._inputExpr(b, 'INDEX');
        const val = this._inputExpr(b, 'ITEM');
        const iv = this._loopVar();
        const ridx = this._loopVar();
        // Scratch indices are 1-based. "replace item N of list with X" semantics:
        //   - If 1 <= N <= len: overwrites the Nth item.
        //   - If N == len + 1 and len < cap: appends (extends the list).
        //   - Otherwise: no-op (out of range, Scratch silently does nothing).
        // We previously used `clamp(idx, 1, len)` here, which incorrectly
        // turned out-of-range indices into writes at position `len`. That
        // silently corrupted the BVH stack and made many pixels render wrong.
        return [
          `${ind}for (int ${iv} = 0; ${iv} < ${cap}; ${iv}++) {`,
          `${ind}  float ci = float(${iv} + 1);`,
          `${ind}  float ${ridx} = floor(${idx} + 0.5);`,
          `${ind}  if (ci == ${ridx} && ${idx} >= 1.0 && ${idx} <= ${len}) {`,
          `${ind}    ${arr}[${iv}] = ${val};`,
          `${ind}    break;`,
          `${ind}  } else if (ci == ${len} + 1.0 && ci <= float(${cap}) && ${ridx} == ci) {`,
          `${ind}    ${arr}[${iv}] = ${val};`,
          `${ind}    ${len} = ${len} + 1.0;`,
          `${ind}    break;`,
          `${ind}  }`,
          `${ind}}`
        ].join('\n');
      }
      case 'data_addtolist': {
        const name = this._getField(b, 'LIST');
        if (!this._isMutableList(name)) {
          this.warnings.push(`"${op}" on read-only list "${name}" is ignored in shader mode.`);
          return `${ind}`;
        }
        const arr = this._mutableArrayName(name);
        const len = this._mutableLenName(name);
        const cap = this._mutableListSizes.get(name) || 64;
        const val = this._inputExpr(b, 'ITEM');
        const iv = this._loopVar();
        // Append at the end while there is capacity.
        return `${ind}for (int ${iv} = 0; ${iv} < ${cap}; ${iv}++) {\n${ind}  if (float(${iv}) < ${len}) { continue; }\n${ind}  ${arr}[${iv}] = ${val};\n${ind}  ${len} = ${len} + 1.0;\n${ind}  break;\n${ind}}`;
      }
      case 'data_deleteoflist': {
        const name = this._getField(b, 'LIST');
        if (!this._isMutableList(name)) {
          this.warnings.push(`"${op}" on read-only list "${name}" is ignored in shader mode.`);
          return `${ind}`;
        }
        const arr = this._mutableArrayName(name);
        const len = this._mutableLenName(name);
        const cap = this._mutableListSizes.get(name) || 64;
        const indexBlock = b.inputs && b.inputs.INDEX && this._block(this._inputChild(b.inputs.INDEX));
        const indexFieldValue = indexBlock && indexBlock.opcode === 'text'
          ? this._getField(indexBlock, 'TEXT') : null;
        if (indexFieldValue === 'all') {
          return `${ind}${len} = 0.0;`;
        }
        if (indexFieldValue === 'last') {
          return `${ind}${len} = max(0.0, ${len} - 1.0);`;
        }
        const iv = this._loopVar();
        const carryVar = this._uid('del_carry_' + (this._loopCounter++), 'sc_t_');
        const startedVar = this._uid('del_started_' + (this._loopCounter++), 'sc_b_');
        if (indexFieldValue === 'random' || indexFieldValue === 'any') {
          const rv = this._randCounter++;
          return [
            `${ind}float ${carryVar} = 0.0;`,
            `${ind}bool ${startedVar} = false;`,
            `${ind}float _randIdx = floor(sc_rand(vec3(gl_FragCoord.xy, u_time + ${rv}.0)) * ${len});`,
            `${ind}for (int ${iv} = 0; ${iv} < ${cap}; ${iv}++) {`,
            `${ind}  if (float(${iv}) >= ${len}) break;`,
            `${ind}  if (${startedVar}) {`,
            `${ind}    float _tmp = ${arr}[${iv}];`,
            `${ind}    ${arr}[${iv}] = ${carryVar};`,
            `${ind}    ${carryVar} = _tmp;`,
            `${ind}  } else if (abs(float(${iv}) - _randIdx) < 0.5) {`,
            `${ind}    ${carryVar} = ${arr}[${iv}];`,
            `${ind}    ${startedVar} = true;`,
            `${ind}  }`,
            `${ind}}`,
            `${ind}if (${startedVar}) ${len} = max(0.0, ${len} - 1.0);`
          ].join('\n');
        }
        const idx = this._inputExpr(b, 'INDEX');
        return [
          `${ind}float ${carryVar} = 0.0;`,
          `${ind}bool ${startedVar} = false;`,
          `${ind}for (int ${iv} = 0; ${iv} < ${cap}; ${iv}++) {`,
          `${ind}  if (float(${iv}) >= ${len}) break;`,
          `${ind}  if (${startedVar}) {`,
          `${ind}    float _tmp = ${arr}[${iv}];`,
          `${ind}    ${arr}[${iv}] = ${carryVar};`,
          `${ind}    ${carryVar} = _tmp;`,
          `${ind}  } else if (float(${iv}) + 1.0 >= floor(${idx} + 0.5)) {`,
          `${ind}    ${carryVar} = ${arr}[${iv}];`,
          `${ind}    ${startedVar} = true;`,
          `${ind}  }`,
          `${ind}}`,
          `${ind}if (${startedVar}) ${len} = max(0.0, ${len} - 1.0);`
        ].join('\n');
      }
      case 'data_deletealloflist': {
        const name = this._getField(b, 'LIST');
        if (!this._isMutableList(name)) {
          this.warnings.push(`"${op}" on read-only list "${name}" is ignored in shader mode.`);
          return `${ind}`;
        }
        const len = this._mutableLenName(name);
        return `${ind}${len} = 0.0;`;
      }
      case 'data_insertatlist': {
        const name = this._getField(b, 'LIST');
        if (!this._isMutableList(name)) {
          this.warnings.push(`"${op}" on read-only list "${name}" is ignored in shader mode.`);
          return `${ind}`;
        }
        const arr = this._mutableArrayName(name);
        const len = this._mutableLenName(name);
        const cap = this._mutableListSizes.get(name) || 64;
        const idx = this._inputExpr(b, 'INDEX');
        const val = this._inputExpr(b, 'ITEM');
        const iv = this._loopVar();
        const carryVar = this._uid('ins_carry_' + (this._loopCounter++), 'sc_t_');
        const startedVar = this._uid('ins_started_' + (this._loopCounter++), 'sc_b_');
        const origLenVar = this._uid('ins_origlen_' + (this._loopCounter++), 'sc_t_');
        return [
          `${ind}float ${origLenVar} = ${len};`,
          `${ind}if (${len} < float(${cap}) && ${idx} >= 1.0 && ${idx} <= ${origLenVar} + 1.0) {`,
          `${ind}  float ${carryVar} = ${val};`,
          `${ind}  bool ${startedVar} = false;`,
          `${ind}  for (int ${iv} = 0; ${iv} < ${cap}; ${iv}++) {`,
          `${ind}    if (float(${iv}) >= ${origLenVar}) {`,
          `${ind}      if (!${startedVar}) {`,
          `${ind}        ${arr}[${iv}] = ${carryVar};`,
          `${ind}        ${len} = ${len} + 1.0;`,
          `${ind}      }`,
          `${ind}      break;`,
          `${ind}    }`,
          `${ind}    if (${startedVar}) {`,
          `${ind}      float _tmp = ${arr}[${iv}];`,
          `${ind}      ${arr}[${iv}] = ${carryVar};`,
          `${ind}      ${carryVar} = _tmp;`,
          `${ind}    } else if (float(${iv}) + 1.0 >= floor(${idx} + 0.5)) {`,
          `${ind}      float _tmp = ${arr}[${iv}];`,
          `${ind}      ${arr}[${iv}] = ${carryVar};`,
          `${ind}      ${carryVar} = _tmp;`,
          `${ind}      ${startedVar} = true;`,
          `${ind}      ${len} = ${len} + 1.0;`,
          `${ind}    }`,
          `${ind}  }`,
          `${ind}}`
        ].join('\n');
      }
      default:
        if (op && (op.startsWith('pen_') || op.startsWith('motion_') || op.startsWith('looks_') || op.startsWith('sound_') || op.startsWith('event_') || op.startsWith('sensing_') || op.startsWith('data_') || op.startsWith('control_'))) {
          this.warnings.push(`"${op}" is ignored in shader mode.`);
          return `${ind}`;
        }
        this.warnings.push(`Unsupported statement ignored: ${op}`);
        return `${ind}`;
    }
  }

  _substack (block, inputName, ind) {
    const childId = this._inputChild(block.inputs && block.inputs[inputName]);
    if (!childId) return `${ind}`;
    return this._stmts(childId, ind) || `${ind}`;
  }

  _loopVar () {
    const name = this._uid('i_' + (this._loopCounter++), 'sc_i_');
    return name;
  }

  _varTarget (name) {
    if (String(name).toLowerCase() === 'color') {
      this._colorWritten = true;
      return 'sc_color';
    }
    return this._uid(name, 'sc_v_');
  }

  _parseArgIds (block) {
    if (!block.mutation || !block.mutation.argumentids) return [];
    try { return JSON.parse(block.mutation.argumentids); } catch (e) { return []; }
  }

  _literalInt (input) {
    if (!input) return null;
    const childId = this._inputChild(input);
    if (!childId) return null;
    const b = this._block(childId);
    if (!b) return null;
    if (['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'math_angle'].includes(b.opcode)) {
      const n = parseNum(this._getField(b, 'NUM'));
      return Math.round(n);
    }
    return null;
  }

  _literalValue (block, inputName) {
    const input = block.inputs && block.inputs[inputName];
    if (!input) return null;
    const childId = this._inputChild(input);
    if (!childId) return null;
    return this._exprLiteral(childId);
  }

  _exprLiteral (blockId) {
    if (!blockId) return null;
    const b = this._block(blockId);
    if (!b) return null;
    const op = b.opcode;
    if (['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'math_angle'].includes(op)) {
      return parseNum(this._getField(b, 'NUM'));
    }
    if (op === 'text') {
      return parseNum(this._getField(b, 'TEXT'));
    }
    if (op === 'operator_add') {
      const a = this._exprLiteral(this._inputChild(b.inputs.NUM1));
      const d = this._exprLiteral(this._inputChild(b.inputs.NUM2));
      if (a !== null && d !== null) return a + d;
    } else if (op === 'operator_subtract') {
      const a = this._exprLiteral(this._inputChild(b.inputs.NUM1));
      const d = this._exprLiteral(this._inputChild(b.inputs.NUM2));
      if (a !== null && d !== null) return a - d;
    } else if (op === 'operator_multiply') {
      const a = this._exprLiteral(this._inputChild(b.inputs.NUM1));
      const d = this._exprLiteral(this._inputChild(b.inputs.NUM2));
      if (a !== null && d !== null) return a * d;
    } else if (op === 'operator_divide') {
      const a = this._exprLiteral(this._inputChild(b.inputs.NUM1));
      const d = this._exprLiteral(this._inputChild(b.inputs.NUM2));
      if (a !== null && d !== null && d !== 0) return a / d;
    }
    return null;
  }

  _constFoldString (blockId) {
    if (!blockId) return null;
    const b = this._block(blockId);
    if (!b) return null;
    const op = b.opcode;
    if (op === 'text') {
      const t = this._getField(b, 'TEXT');
      return t == null ? '' : String(t);
    }
    if (['math_number', 'math_positive_number', 'math_whole_number', 'math_integer', 'math_angle'].includes(op)) {
      return String(parseNum(this._getField(b, 'NUM')));
    }
    if (op === 'operator_join') {
      const left = this._constFoldString(this._inputChild(b.inputs.STRING1));
      const right = this._constFoldString(this._inputChild(b.inputs.STRING2));
      if (left !== null && right !== null) return left + right;
      return null;
    }
    if (op === 'operator_letter_of') {
      const str = this._constFoldString(this._inputChild(b.inputs.STRING));
      const letterLit = this._literalValue(b, 'LETTER');
      if (str !== null && letterLit !== null) {
        const idx = Math.floor(letterLit);
        if (idx >= 1 && idx <= str.length) return str[idx - 1];
        return '';
      }
      return null;
    }
    if (op === 'data_variable') {
      const name = this._getField(b, 'VARIABLE');
      const vals = this._stageVariableValues();
      if (vals.has(name)) {
        const v = vals.get(name);
        return v == null ? '' : String(v);
      }
      return null;
    }
    return null;
  }

  // Strict string-literal fold for comparison operands. Unlike
  // _constFoldString, this does NOT fold data_variable (whose value
  // mutates at runtime, so folding its initial value into a
  // compile-time comparison freezes loop conditions that depend on it)
  // or math_number (whose string ordering differs from numeric ordering,
  // e.g. "10" < "9" as strings but 10 > 9 numerically). Only text and
  // string ops on literals qualify — the cases where Scratch's
  // case-insensitive string comparison semantics actually apply.
  _constFoldStringLiteral (blockId) {
    if (!blockId) return null;
    const b = this._block(blockId);
    if (!b) return null;
    const op = b.opcode;
    if (op === 'text') {
      const t = this._getField(b, 'TEXT');
      return t == null ? '' : String(t);
    }
    if (op === 'operator_join') {
      const left = this._constFoldStringLiteral(this._inputChild(b.inputs.STRING1));
      const right = this._constFoldStringLiteral(this._inputChild(b.inputs.STRING2));
      if (left !== null && right !== null) return left + right;
      return null;
    }
    if (op === 'operator_letter_of') {
      const str = this._constFoldStringLiteral(this._inputChild(b.inputs.STRING));
      const letterLit = this._literalValue(b, 'LETTER');
      if (str !== null && letterLit !== null) {
        const idx = Math.floor(letterLit);
        if (idx >= 1 && idx <= str.length) return str[idx - 1];
        return '';
      }
      return null;
    }
    return null;
  }

  _evalMathop (which, n) {
    switch (which) {
      case 'abs': return Math.abs(n);
      case 'floor': return Math.floor(n);
      case 'ceiling': return Math.ceil(n);
      case 'sqrt': return n < 0 ? 0 : Math.sqrt(n);
      case 'sin': return Math.round(Math.sin(n * Math.PI / 180) * 1e10) / 1e10;
      case 'cos': return Math.round(Math.cos(n * Math.PI / 180) * 1e10) / 1e10;
      case 'tan': {
        const m = n % 360;
        if (m === 90 || m === -270) return Infinity;
        if (m === -90 || m === 270) return -Infinity;
        return Math.round(Math.tan(n * Math.PI / 180) * 1e10) / 1e10;
      }
      case 'asin': return Math.asin(Math.max(-1, Math.min(1, n))) * 180 / Math.PI;
      case 'acos': return Math.acos(Math.max(-1, Math.min(1, n))) * 180 / Math.PI;
      case 'atan': return Math.atan(n) * 180 / Math.PI;
      case 'ln': return n <= 0 ? 0 : Math.log(n);
      case 'log': return n <= 0 ? 0 : Math.log(n) / Math.LN10;
      case 'e ^': return Math.exp(n);
      case '10 ^': return Math.pow(10, n);
      default: return null;
    }
  }

  _inputExpr (block, inputName) {
    const input = block.inputs && block.inputs[inputName];
    const childId = this._inputChild(input);
    if (!childId) return '0.0';
    return this._expr(childId);
  }

  _condExpr (block, inputName) {
    const input = block.inputs && block.inputs[inputName];
    const childId = this._inputChild(input);
    if (!childId) {
      return `(${this._inputExpr(block, inputName)} != 0.0)`;
    }
    const b = this._block(childId);
    if (!b) {
      return `(${this._inputExpr(block, inputName)} != 0.0)`;
    }
    const op = b.opcode;
    switch (op) {
      case 'operator_lt': {
        const s1 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND1));
        const s2 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND2));
        if (s1 !== null && s2 !== null) {
          return s1.toLowerCase() < s2.toLowerCase() ? '(true)' : '(false)';
        }
        return `(${this._inputExpr(b, 'OPERAND1')} < ${this._inputExpr(b, 'OPERAND2')})`;
      }
      case 'operator_gt': {
        const s1 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND1));
        const s2 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND2));
        if (s1 !== null && s2 !== null) {
          return s1.toLowerCase() > s2.toLowerCase() ? '(true)' : '(false)';
        }
        return `(${this._inputExpr(b, 'OPERAND1')} > ${this._inputExpr(b, 'OPERAND2')})`;
      }
      case 'operator_equals': {
        const s1 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND1));
        const s2 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND2));
        if (s1 !== null && s2 !== null) {
          return s1.toLowerCase() === s2.toLowerCase() ? '(true)' : '(false)';
        }
        return `(abs(${this._inputExpr(b, 'OPERAND1')} - ${this._inputExpr(b, 'OPERAND2')}) < 0.000001)`;
      }
      case 'operator_and':
        return `(${this._condExpr(b, 'OPERAND1')} && ${this._condExpr(b, 'OPERAND2')})`;
      case 'operator_or':
        return `(${this._condExpr(b, 'OPERAND1')} || ${this._condExpr(b, 'OPERAND2')})`;
      case 'operator_not':
        return `(!(${this._condExpr(b, 'OPERAND')}))`;
      default:
        return `(${this._inputExpr(block, inputName)} != 0.0)`;
    }
  }

  _expr (blockId) {
    const b = this._block(blockId);
    if (!b) return '0.0';
    const op = b.opcode;
    switch (op) {
      case 'math_number':
      case 'math_positive_number':
      case 'math_whole_number':
      case 'math_integer':
      case 'math_angle':
        return glslNum(parseNum(this._getField(b, 'NUM')));
      case 'text': {
        const n = parseNum(this._getField(b, 'TEXT'));
        return glslNum(n);
      }
      case 'data_variable': {
        const name = this._getField(b, 'VARIABLE');
        if (String(name).toLowerCase() === 'color') return 'sc_color';
        return this._uid(name, 'sc_v_');
      }
      case 'sensing_timer':
        return 'u_time';
      case 'sensing_mousex':
        this._needsMouse = true;
        return 'u_mouse_x';
      case 'sensing_mousey':
        this._needsMouse = true;
        return 'u_mouse_y';
      case 'sensing_mousedown':
        this._needsMouse = true;
        return 'u_mouse_down';
      case 'sensing_keypressed': {
        this._needsMouse = true;
        const keyField = b.fields && b.fields.KEY_OPTION;
        const keyName = keyField ? String(keyField.value).toLowerCase() : '';
        if (!keyName) {
          this.warnings.push('sensing_keypressed without key option; returning 0.');
          return '0.0';
        }
        let uniformName = this._keyUniforms.get(keyName);
        if (!uniformName) {
          uniformName = this._uid(keyName, 'u_key_');
          this._keyUniforms.set(keyName, uniformName);
        }
        return uniformName;
      }
      case 'control_get_counter':
        this._needsCounter = true;
        return 'u_counter';
      case 'argument_reporter_string_number':
      case 'argument_reporter_boolean': {
        const name = String(this._getField(b, 'VALUE'));
        const mapped = this._scope && this._scope.get(name);
        if (mapped) return mapped;
        this.warnings.push(`Argument reporter "${name}" is not a parameter of this block; using 0.`);
        return '0.0';
      }
      case 'operator_add': {
        const aLit = this._literalValue(b, 'NUM1');
        const bLit = this._literalValue(b, 'NUM2');
        if (aLit !== null && bLit !== null) return glslNum(aLit + bLit);
        if (aLit === 0) return this._inputExpr(b, 'NUM2');
        if (bLit === 0) return this._inputExpr(b, 'NUM1');
        return `(${this._inputExpr(b, 'NUM1')} + ${this._inputExpr(b, 'NUM2')})`;
      }
      case 'operator_subtract': {
        const aLit = this._literalValue(b, 'NUM1');
        const bLit = this._literalValue(b, 'NUM2');
        if (aLit !== null && bLit !== null) return glslNum(aLit - bLit);
        if (bLit === 0) return this._inputExpr(b, 'NUM1');
        return `(${this._inputExpr(b, 'NUM1')} - ${this._inputExpr(b, 'NUM2')})`;
      }
      case 'operator_multiply': {
        const aLit = this._literalValue(b, 'NUM1');
        const bLit = this._literalValue(b, 'NUM2');
        if (aLit !== null && bLit !== null) return glslNum(aLit * bLit);
        if (aLit === 0 || bLit === 0) return '0.0';
        if (aLit === 1) return this._inputExpr(b, 'NUM2');
        if (bLit === 1) return this._inputExpr(b, 'NUM1');
        return `(${this._inputExpr(b, 'NUM1')} * ${this._inputExpr(b, 'NUM2')})`;
      }
      case 'operator_divide': {
        const aLit = this._literalValue(b, 'NUM1');
        const bLit = this._literalValue(b, 'NUM2');
        if (aLit !== null && bLit !== null && bLit !== 0) return glslNum(aLit / bLit);
        if (aLit === 0) return '0.0';
        const a = this._inputExpr(b, 'NUM1');
        const d = this._inputExpr(b, 'NUM2');
        if (bLit !== null && bLit !== 0) {
          return `(${a} / ${d})`;
        }
        return `((${d} == 0.0) ? ((${a} > 0.0) ? 1e20 : ((${a} < 0.0) ? -1e20 : 0.0)) : (${a} / ${d}))`;
      }
      case 'operator_mod': {
        const a = this._inputExpr(b, 'NUM1');
        const d = this._inputExpr(b, 'NUM2');
        const dLit = this._literalValue(b, 'NUM2');
        if (dLit !== null && dLit !== 0) {
          return `mod(${a}, ${d})`;
        }
        return `((${d} == 0.0) ? 0.0 : mod(${a}, ${d}))`;
      }
      case 'operator_round':
        return `floor(${this._inputExpr(b, 'NUM')} + 0.5)`;
      case 'operator_mathop': {
        const which = String(this._getField(b, 'OPERATOR') || '').toLowerCase();
        const nLit = this._literalValue(b, 'NUM');
        if (nLit !== null) {
          const r = this._evalMathop(which, nLit);
          if (r !== null) return glslNum(r);
        }
        const n = this._inputExpr(b, 'NUM');
        switch (which) {
          case 'abs': return `abs(${n})`;
          case 'floor': return `floor(${n})`;
          case 'ceiling': return `ceil(${n})`;
          case 'sqrt': return `((${n} < 0.0) ? 0.0 : sqrt(${n}))`;
          case 'sin': return `(floor(sin((${n}) * 0.017453292519943295) * 1e10 + 0.5) / 1e10)`;
          case 'cos': return `(floor(cos((${n}) * 0.017453292519943295) * 1e10 + 0.5) / 1e10)`;
          case 'tan': return `sc_tan(${n})`;
          case 'asin': return `(asin(clamp(${n}, -1.0, 1.0)) * 57.29577951308232)`;
          case 'acos': return `(acos(clamp(${n}, -1.0, 1.0)) * 57.29577951308232)`;
          case 'atan': return `(atan(${n}) * 57.29577951308232)`;
          case 'ln': return `((${n} <= 0.0) ? 0.0 : log(${n}))`;
          case 'log': return `((${n} <= 0.0) ? 0.0 : (log(${n}) / 2.302585092994046))`;
          case 'e ^': return `exp(${n})`;
          case '10 ^': return `pow(10.0, ${n})`;
          default:
            this.warnings.push(`Unknown math op "${which}"; using 0.`);
            return '0.0';
        }
      }
      case 'operator_random': {
        const a = this._inputExpr(b, 'FROM');
        const bb = this._inputExpr(b, 'TO');
        // Each call site (and each dynamic invocation) must produce a distinct
        // pseudo-random value. Using a per-call-site integer offset combined with
        // gl_FragCoord and u_time ensures that multiple random() calls within the
        // same pixel do not all collapse to the same number.
        const seed = this._randCounter++;
        return `mix(${a}, ${bb}, sc_rand(vec3(gl_FragCoord.xy, u_time + ${seed}.0)))`;
      }
      case 'operator_lt': {
        const s1 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND1));
        const s2 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND2));
        if (s1 !== null && s2 !== null) {
          return s1.toLowerCase() < s2.toLowerCase() ? '1.0' : '0.0';
        }
        return `((${this._inputExpr(b, 'OPERAND1')} < ${this._inputExpr(b, 'OPERAND2')}) ? 1.0 : 0.0)`;
      }
      case 'operator_gt': {
        const s1 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND1));
        const s2 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND2));
        if (s1 !== null && s2 !== null) {
          return s1.toLowerCase() > s2.toLowerCase() ? '1.0' : '0.0';
        }
        return `((${this._inputExpr(b, 'OPERAND1')} > ${this._inputExpr(b, 'OPERAND2')}) ? 1.0 : 0.0)`;
      }
      case 'operator_equals': {
        const s1 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND1));
        const s2 = this._constFoldStringLiteral(this._inputChild(b.inputs.OPERAND2));
        if (s1 !== null && s2 !== null) {
          return s1.toLowerCase() === s2.toLowerCase() ? '1.0' : '0.0';
        }
        return `((abs(${this._inputExpr(b, 'OPERAND1')} - ${this._inputExpr(b, 'OPERAND2')}) < 0.000001) ? 1.0 : 0.0)`;
      }
      case 'operator_and':
        return `((${this._inputExpr(b, 'OPERAND1')} != 0.0 && ${this._inputExpr(b, 'OPERAND2')} != 0.0) ? 1.0 : 0.0)`;
      case 'operator_or':
        return `((${this._inputExpr(b, 'OPERAND1')} != 0.0 || ${this._inputExpr(b, 'OPERAND2')} != 0.0) ? 1.0 : 0.0)`;
      case 'operator_not':
        return `((${this._inputExpr(b, 'OPERAND')} == 0.0) ? 1.0 : 0.0)`;
      case 'procedures_call': {
        const isReporter = b.mutation && b.mutation.return;
        if (!isReporter) {
          this.warnings.push(`Custom command used as a reporter; using 0.`);
          return '0.0';
        }
        const proccode = b.mutation && b.mutation.proccode;
        if (!proccode || !this._procedures.has(proccode)) {
          this.warnings.push(`Call to unknown custom reporter: ${proccode}`);
          return '0.0';
        }
        const fnName = this._uid(proccode, 'sc_fn_');
        const argIds = this._parseArgIds(b);
        const args = argIds.map((aid) => this._inputExpr(b, aid));
        return `${fnName}(${args.join(', ')})`;
      }
      case 'data_itemoflist': {
        const name = this._getField(b, 'LIST');
        const idx = this._inputExpr(b, 'INDEX');
        if (this._isMutableList(name)) {
          const rfn = this._mutableReaderName.get(name);
          return `${rfn}(${idx})`;
        }
        const slot = this._listSlot.get(name);
        if (!slot) {
          this.warnings.push(`List "${name}" is written but never read in shader; returning 0.`);
          return '0.0';
        }
        return `sc_lget_${slot.texIndex}_${slot.channel}(${idx})`;
      }
      case 'data_lengthoflist': {
        const name = this._getField(b, 'LIST');
        if (this._isMutableList(name)) {
          return this._mutableLenName(name);
        }
        const slot = this._listSlot.get(name);
        if (!slot) return '0.0';
        const swiz = ['x', 'y', 'z', 'w'][slot.channel];
        return `sc_llen_${slot.texIndex}.${swiz}`;
      }
      case 'operator_join': {
        const left = this._constFoldString(this._inputChild(b.inputs.STRING1));
        const right = this._constFoldString(this._inputChild(b.inputs.STRING2));
        if (left !== null && right !== null) {
          const joined = left + right;
          const n = parseFloat(joined);
          return isNaN(n) ? '0.0' : glslNum(n);
        }
        this.warnings.push('Dynamic "join" is not supported in shader mode; result is 0.');
        return '0.0';
      }
      case 'operator_length': {
        const str = this._constFoldString(this._inputChild(b.inputs.STRING));
        if (str !== null) return glslNum(str.length);
        this.warnings.push('Dynamic "length of" is not supported in shader mode; result is 0.');
        return '0.0';
      }
      case 'operator_letter_of': {
        const str = this._constFoldString(this._inputChild(b.inputs.STRING));
        const letterLit = this._literalValue(b, 'LETTER');
        if (str !== null && letterLit !== null) {
          const idx = Math.floor(letterLit);
          if (idx >= 1 && idx <= str.length) {
            const ch = str[idx - 1];
            const n = parseFloat(ch);
            return isNaN(n) ? '0.0' : glslNum(n);
          }
          return '0.0';
        }
        this.warnings.push('Dynamic "letter of" is not supported in shader mode; result is 0.');
        return '0.0';
      }
      case 'operator_contains': {
        const str = this._constFoldString(this._inputChild(b.inputs.STRING1));
        const sub = this._constFoldString(this._inputChild(b.inputs.STRING2));
        if (str !== null && sub !== null) {
          return str.toLowerCase().indexOf(sub.toLowerCase()) !== -1 ? '1.0' : '0.0';
        }
        this.warnings.push('Dynamic "contains" is not supported in shader mode; result is 0.');
        return '0.0';
      }
      case 'data_itemnumoflist': {
        const name = this._getField(b, 'LIST');
        const item = this._inputExpr(b, 'ITEM');
        if (this._isMutableList(name)) {
          const fn = this._mutableIndexOffFns.get(name);
          if (!fn) return '0.0';
          return `${fn}(${item})`;
        }
        const slot = this._listSlot.get(name);
        if (!slot) {
          this.warnings.push(`List "${name}" not found; returning 0.`);
          return '0.0';
        }
        return `sc_lindexof_${slot.texIndex}_${slot.channel}(${item})`;
      }
      case 'data_listcontainsitem': {
        const name = this._getField(b, 'LIST');
        const item = this._inputExpr(b, 'ITEM');
        let idxExpr;
        if (this._isMutableList(name)) {
          const fn = this._mutableIndexOffFns.get(name);
          if (!fn) return '0.0';
          idxExpr = `${fn}(${item})`;
        } else {
          const slot = this._listSlot.get(name);
          if (!slot) {
            this.warnings.push(`List "${name}" not found; returning 0.`);
            return '0.0';
          }
          idxExpr = `sc_lindexof_${slot.texIndex}_${slot.channel}(${item})`;
        }
        return `((${idxExpr} > 0.0) ? 1.0 : 0.0)`;
      }
      case 'data_listcontents':
        this.warnings.push('"list contents" is not supported in shader mode; returning 0.');
        return '0.0';
      default:
        if (op && op.startsWith('data_')) {
          this.warnings.push(`Unsupported data reporter treated as 0: ${op}`);
          return '0.0';
        }
        this.warnings.push(`Unsupported reporter treated as 0: ${op}`);
        return '0.0';
    }
  }
}

export default ScratchShaderCompiler;
