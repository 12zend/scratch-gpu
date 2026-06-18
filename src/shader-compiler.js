const PIXEL_NAME = 'pixel';
const MAX_LOOP = 256;
// A `forever` block in Scratch is unwound into a `for` loop with this
// upper bound. The BVH traversal is itself a `forever`, so this must be
// large enough to finish visiting every node the BVH might emit before
// a hit. 64 was not enough for the uow5 BVH (which can legitimately
// push dozens of nodes onto the stack) and silently truncated the
// traversal, leaving whole regions of the scene unlit.
const MAX_FOREVER = 4096;
const MAX_UNROLL = 128;
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
  return isFinite(n) ? n : 0;
};

const glslNum = (n) => {
  const s = String(n);
  if (s.indexOf('.') === -1 && s.indexOf('e') === -1 && s.indexOf('E') === -1 && s.indexOf('inf') === -1 && s.indexOf('Inf') === -1 && s.indexOf('NaN') === -1) {
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
    this._proceduresUsingStack = new Set();
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
    this._discoverProcedures();
    if (this._procedures.size === 0) {
      return { found: false, warnings: this.warnings, errors: this.errors };
    }
    this._pixel = this._findPixel();
    if (!this._pixel) {
      return { found: false, warnings: this.warnings, errors: this.errors };
    }
    if (this._pixel.isReporter) {
      this.errors.push('The "pixel" block must be a command (stack) block, not a reporter.');
      return { found: true, warnings: this.warnings, errors: this.errors };
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
      warnings: this.warnings,
      errors: this.errors
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
        } else if (op === 'data_itemoflist' || op === 'data_lengthoflist' || op === 'data_listcontainsitem') {
          this._markListUsage(this._getField(b, 'LIST'), true, false);
        } else if (op === 'data_replaceitemoflist' || op === 'data_addtolist' || op === 'data_insertatlist' || op === 'data_deleteoflist' || op === 'data_deletealloflist') {
          this._markListUsage(this._getField(b, 'LIST'), false, true);
        }
      });
    }
    this._collectMutableLists();
    for (const [code, info] of this._procedures) {
      if (this._procedureWritesMutableList(info)) {
        this._proceduresUsingStack.add(code);
      }
    }
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
    const MUTABLE_CAP_DEFAULT = 1024;
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

  _procedureWritesMutableList (info) {
    let found = false;
    this._walkAll(info.bodyHead, info.blocks, (b) => {
      if (found) return;
      if (b.opcode === 'data_replaceitemoflist' || b.opcode === 'data_addtolist' || b.opcode === 'data_insertatlist' || b.opcode === 'data_deleteoflist' || b.opcode === 'data_deletealloflist') {
        const name = this._getField(b, 'LIST');
        if (name && this._mutableListNames && this._mutableListNames.has(name)) {
          found = true;
        }
      }
    });
    return found;
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
    lines.push('');
    this._packLists();
    if (this._listPacks.length) {
      lines.push('uniform sampler2D sc_ltex;');
      lines.push('uniform vec2 sc_ltex_size;');
      for (let ti = 0; ti < this._listPacks.length; ti++) {
        const pack = this._listPacks[ti];
        lines.push(`uniform vec4 sc_llen_${ti};`);
        lines.push(`uniform vec2 sc_lsize_${ti};`);
        lines.push(`uniform float sc_loffset_${ti};`);
        for (let ci = 0; ci < pack.channels.length; ci++) {
          const ch = pack.channels[ci];
          if (!ch) continue;
          const swiz = ['x', 'y', 'z', 'w'][ci];
          const fnName = `sc_lget_${ti}_${ci}`;
          lines.push(`float ${fnName}(float idx) {`);
          lines.push(`  float len = sc_llen_${ti}.${swiz};`);
          lines.push('  if (len <= 0.0) return 0.0;');
          lines.push('  float i = clamp(idx - 1.0, 0.0, len - 1.0);');
          lines.push(`  float x = mod(i, sc_lsize_${ti}.x) + 0.5;`);
          lines.push(`  float y = sc_loffset_${ti} + floor(i / sc_lsize_${ti}.x) + 0.5;`);
          lines.push('  return texture2D(sc_ltex, vec2(x / sc_ltex_size.x, y / sc_ltex_size.y)).' + swiz + ';');
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
        lines.push(`    if (float(mi) == gi) result = ${arr}[mi];`);
        lines.push(`  }`);
        lines.push(`  return result;`);
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
    lines.push('  float sc_px = gl_FragCoord.x - (u_resolution.x * 0.5);');
    lines.push('  float sc_py = gl_FragCoord.y - (u_resolution.y * 0.5);');
    lines.push(`  ${this._pixelFnName}(sc_px, sc_py);`);
    lines.push('  float c = floor(sc_color + 0.5);');
    lines.push('  c = clamp(c, 0.0, 16777215.0);');
    lines.push('  float cr = floor(c / 65536.0);');
    lines.push('  float cg = mod(floor(c / 256.0), 256.0);');
    lines.push('  float cb = mod(c, 256.0);');
    lines.push('  gl_FragColor = vec4(cr / 255.0, cg / 255.0, cb / 255.0, 1.0);');
    lines.push('}');
    if (!this._colorWritten) {
      this.warnings.push('The "color" variable was never set inside the pixel block; the output will be black.');
    }
    return lines.join('\n');
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
    // Per-ray mutable list(s) act as global scratch space shared across calls.
    // Any procedure that writes to one must start with a clean length to avoid
    // inheriting leftover state from a previous invocation (e.g. the BVH
    // traversal "stack" leaking between bounces in a path tracer).
    if (this._proceduresUsingStack && this._proceduresUsingStack.has(code)) {
      for (const name of this._mutableListNames) {
        const len = this._mutableLenName(name);
        lines.push(`  ${len} = 0.0;`);
      }
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
        return `${ind}${this._varTarget(name)} = ${val};`;
      }
      case 'data_changevariableby': {
        const name = this._getField(b, 'VARIABLE');
        const val = this._inputExpr(b, 'VALUE');
        return `${ind}${this._varTarget(name)} += ${val};`;
      }
      case 'control_if': {
        const cond = this._inputExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        return `${ind}if (${cond} != 0.0) {\n${body}\n${ind}}`;
      }
      case 'control_if_else': {
        const cond = this._inputExpr(b, 'CONDITION');
        const body1 = this._substack(b, 'SUBSTACK', ind + '  ');
        const body2 = this._substack(b, 'SUBSTACK2', ind + '  ');
        return `${ind}if (${cond} != 0.0) {\n${body1}\n${ind}} else {\n${body2}\n${ind}}`;
      }
      case 'control_repeat': {
        const times = this._inputExpr(b, 'TIMES');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const literal = this._literalInt(b.inputs && b.inputs.TIMES);
        if (literal !== null && literal >= 0 && literal <= MAX_UNROLL) {
          const out = [];
          for (let i = 0; i < literal; i++) out.push(body);
          return out.join('\n');
        }
        const lv = this._loopVar();
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (float(${lv}) >= ${times}) break;\n${body}\n${ind}}`;
      }
      case 'control_repeat_until': {
        const cond = this._inputExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (${cond} != 0.0) break;\n${body}\n${ind}}`;
      }
      case 'control_while': {
        const cond = this._inputExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        return `${ind}for (int ${lv} = 0; ${lv} < ${MAX_LOOP}; ${lv}++) {\n${ind}  if (${cond} == 0.0) break;\n${body}\n${ind}}`;
      }
      case 'control_for_each': {
        const name = this._getField(b, 'VARIABLE');
        const count = this._inputExpr(b, 'VALUE');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
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
        // "forever" has no exit condition in Scratch; in the shader we bound it
        // to a fixed iteration count. The loop body typically exits via
        // "control_stop (this script)" which compiles to `return;`, terminating
        // the whole function (and thus the loop) early. Forever loops in
        // particular can be very heavy on a GPU, so we use a smaller bound
        // (MAX_FOREVER) than for ordinary repeat/while loops.
        const foreverBody = this._substack(b, 'SUBSTACK', ind + '  ');
        const fv = this._loopVar();
        return `${ind}for (int ${fv} = 0; ${fv} < ${MAX_FOREVER}; ${fv}++) {\n${foreverBody}\n${ind}}`;
      }
      case 'control_wait':
      case 'control_wait_until':
      case 'control_all_at_once':
        this.warnings.push(`"${op}" is ignored in shader mode.`);
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
          `${ind}  } else if (ci == ${len} + 1.0 && ci <= float(${cap}) && ${ridx} == ci) {`,
          `${ind}    ${arr}[${iv}] = ${val};`,
          `${ind}    ${len} = ${len} + 1.0;`,
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
        const len = this._mutableLenName(name);
        // Simplification: delete the last item (Scratch supports index/all/last).
        return `${ind}${len} = max(0.0, ${len} - 1.0);`;
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
      case 'data_insertatlist':
        this.warnings.push(`"${op}" is not supported in shader mode (use add or replace).`);
        return `${ind}`;
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

  _inputExpr (block, inputName) {
    const input = block.inputs && block.inputs[inputName];
    const childId = this._inputChild(input);
    if (!childId) {
      if (this._isDistanceArgument(block, inputName)) return '1e20';
      return '0.0';
    }
    if (this._isEmptyDistanceInput(block, inputName, input)) {
      return '1e20';
    }
    return this._expr(childId);
  }

  _isEmptyDistanceInput (block, inputName, input) {
    if (!this._isDistanceArgument(block, inputName)) return false;
    if (!input) return true;
    const hasExplicitBlock = input.block !== null && input.block !== undefined && input.block !== input.shadow;
    return !hasExplicitBlock;
  }

  _isDistanceArgument (block, inputName) {
    if (!block || block.opcode !== 'procedures_call') return false;
    if (!block.mutation || !block.mutation.argumentids) return false;
    let ids;
    try { ids = JSON.parse(block.mutation.argumentids); } catch (e) { return false; }
    const idx = ids.indexOf(inputName);
    if (idx < 0) return false;
    const proccode = block.mutation.proccode;
    if (!proccode || !this._procedures.has(proccode)) return false;
    const info = this._procedures.get(proccode);
    const name = info.paramNames && info.paramNames[idx];
    if (!name) return false;
    const lower = String(name).toLowerCase();
    return lower === 'dist' || lower === 'distance';
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
      case 'argument_reporter_string_number':
      case 'argument_reporter_boolean': {
        const name = String(this._getField(b, 'VALUE'));
        const mapped = this._scope && this._scope.get(name);
        if (mapped) return mapped;
        this.warnings.push(`Argument reporter "${name}" is not a parameter of this block; using 0.`);
        return '0.0';
      }
      case 'operator_add':
        return `(${this._inputExpr(b, 'NUM1')} + ${this._inputExpr(b, 'NUM2')})`;
      case 'operator_subtract':
        return `(${this._inputExpr(b, 'NUM1')} - ${this._inputExpr(b, 'NUM2')})`;
      case 'operator_multiply':
        return `(${this._inputExpr(b, 'NUM1')} * ${this._inputExpr(b, 'NUM2')})`;
      case 'operator_divide': {
        const a = this._inputExpr(b, 'NUM1');
        const d = this._inputExpr(b, 'NUM2');
        // Scratch's `1 / 0` is `Infinity`, but `1.0 / 0.0` in GLSL ES 1.00
        // is undefined behavior. Returning `0.0` was tempting but it broke
        // the BVH slab test: when `rayDX == 0`, the X slab's
        // `t_near` and `t_far` both collapsed to `0 * (boundary - ox) = 0`,
        // so the combined slab test always reported a miss for any
        // axis-aligned ray, hiding entire walls/regions of the scene.
        // Returning `1e20` mimics Scratch's `Infinity` propagation, so
        // `a * 1e20` then yields the correct ±Infinity for the slab test.
        return `((${d} == 0.0) ? 1e20 : (${a} / ${d}))`;
      }
      case 'operator_mod': {
        const a = this._inputExpr(b, 'NUM1');
        const d = this._inputExpr(b, 'NUM2');
        return `((${d} == 0.0) ? 0.0 : mod(${a}, ${d}))`;
      }
      case 'operator_round':
        return `floor(${this._inputExpr(b, 'NUM')} + 0.5)`;
      case 'operator_mathop': {
        const which = String(this._getField(b, 'OPERATOR') || '').toLowerCase();
        const n = this._inputExpr(b, 'NUM');
        switch (which) {
          case 'abs': return `abs(${n})`;
          case 'floor': return `floor(${n})`;
          case 'ceiling': return `ceil(${n})`;
          case 'sqrt': return `sqrt(${n})`;
          case 'sin': return `sin((${n}) * 0.017453292519943295)`;
          case 'cos': return `cos((${n}) * 0.017453292519943295)`;
          case 'tan': return `tan((${n}) * 0.017453292519943295)`;
          case 'asin': return `asin(${n}) * 57.29577951308232`;
          case 'acos': return `acos(${n}) * 57.29577951308232`;
          case 'atan': return `atan(${n}) * 57.29577951308232`;
          case 'ln': return `log(${n})`;
          case 'log': return `log(${n}) / 2.302585092994046`;
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
      case 'operator_lt':
        return `((${this._inputExpr(b, 'OPERAND1')} < ${this._inputExpr(b, 'OPERAND2')}) ? 1.0 : 0.0)`;
      case 'operator_gt':
        return `((${this._inputExpr(b, 'OPERAND1')} > ${this._inputExpr(b, 'OPERAND2')}) ? 1.0 : 0.0)`;
      case 'operator_equals':
        return `((abs(${this._inputExpr(b, 'OPERAND1')} - ${this._inputExpr(b, 'OPERAND2')}) < 0.000001) ? 1.0 : 0.0)`;
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
