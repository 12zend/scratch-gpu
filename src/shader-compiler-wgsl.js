import { ScratchShaderCompiler } from './shader-compiler.js';

const wgslNum = (n) => {
  const s = String(n);
  if (s.indexOf('.') === -1 && s.indexOf('e') === -1 && s.indexOf('E') === -1 && s.indexOf('inf') === -1 && s.indexOf('Inf') === -1 && s.indexOf('NaN') === -1) {
    return s + '.0';
  }
  return s;
};

export class ShaderCompilerWGSL extends ScratchShaderCompiler {
  constructor (runtime) {
    super(runtime);
    this._uniformFields = [];
  }

  compile () {
    this._discoverProcedures();
    if (this._procedures.size === 0) {
      return { found: false, warnings: this.warnings, errors: this.errors, backend: 'webgpu' };
    }
    this._pixel = this._findPixel();
    if (!this._pixel) {
      return { found: false, warnings: this.warnings, errors: this.errors, backend: 'webgpu' };
    }
    if (this._pixel.isReporter) {
      this.errors.push('The "pixel" block must be a command (stack) block, not a reporter.');
      return { found: true, warnings: this.warnings, errors: this.errors, backend: 'webgpu' };
    }
    this._pruneUnreachable();
    const cycle = this._detectRecursion();
    if (cycle) {
      this.errors.push(`Recursion is not supported in shaders: ${cycle.join(' -> ')}`);
      return { found: true, warnings: this.warnings, errors: this.errors, backend: 'webgpu' };
    }
    this._analyzeUsage();
    if (this.errors.length) {
      return { found: true, warnings: this.warnings, errors: this.errors, backend: 'webgpu' };
    }
    const wgslSource = this._generateWgsl();
    return {
      found: true,
      backend: 'webgpu',
      wgslSource,
      variableUniforms: this._uniformVars.slice(),
      listTextures: this._listTextures.slice(),
      pixelArgNames: this._pixel.paramNames.slice(),
      warnings: this.warnings,
      errors: this.errors
    };
  }

  _generateWgsl () {
    const lines = [];
    this._uniformFields = [];
    this._uniformFields.push('  u_resolution: vec2f,');
    this._uniformFields.push('  u_time: f32,');

    const stageVars = this._stageVariableValues();
    for (const [name, usage] of this._varUsage) {
      if (name.toLowerCase() === 'color') continue;
      const v = this._uid(name, 'sc_v_');
      this._globalVars.push(v);
      if (stageVars.has(name) && usage.read && !usage.written) {
        const u = this._uid(name, 'sc_u_');
        this._uniformVars.push({ uniform: u, scratchName: name });
        this._globalVarInitializers.set(v, 'u.' + u);
        this._uniformFields.push(`  ${u}: f32,`);
      } else {
        const initial = stageVars.has(name) ? wgslNum(parseFloat(stageVars.get(name)) || 0) : '0.0';
        this._globalVarInitializers.set(v, initial);
      }
      if (!stageVars.has(name)) {
        this.warnings.push(`Variable "${name}" was not found as a Scratch variable; it will be treated as a shader-local temporary.`);
      }
    }

    this._packLists();
    if (this._listPacks && this._listPacks.length) {
      this._uniformFields.push('  sc_ltex_size: vec2f,');
      for (let ti = 0; ti < this._listPacks.length; ti++) {
        this._uniformFields.push(`  sc_llen_${ti}: vec4f,`);
        this._uniformFields.push(`  sc_lmeta_${ti}: vec3f,`);
      }
    }

    lines.push('struct Uniforms {');
    lines.push(this._uniformFields.join('\n'));
    lines.push('}');
    lines.push('');
    lines.push('@group(0) @binding(0) var<uniform> u: Uniforms;');

    if (this._listPacks && this._listPacks.length) {
      lines.push('@group(0) @binding(1) var<storage, read> sc_ltex: array<vec4f>;');
    }
    lines.push('');

    for (const v of this._globalVars) {
      lines.push(`var<private> ${v}: f32;`);
    }
    lines.push('var<private> sc_color: f32;');
    lines.push('var<private> sc_frag_coord: vec2f;');
    lines.push('');

    if (this._listPacks && this._listPacks.length) {
      for (let ti = 0; ti < this._listPacks.length; ti++) {
        const pack = this._listPacks[ti];
        for (let ci = 0; ci < pack.channels.length; ci++) {
          const ch = pack.channels[ci];
          if (!ch) continue;
          const swiz = ['x', 'y', 'z', 'w'][ci];
          const fnName = `sc_lget_${ti}_${ci}`;
          lines.push(`fn ${fnName}(idx: f32) -> f32 {`);
          lines.push(`  let len = u.sc_llen_${ti}.${swiz};`);
          lines.push('  if (len <= 0.0) { return 0.0; }');
          lines.push('  let i = u32(clamp(idx - 1.0, 0.0, len - 1.0));');
          lines.push(`  return sc_ltex[u.sc_lmeta_${ti}.z + i].${swiz};`);
          lines.push('}');
        }
      }
      lines.push('');
    }

    if (this._mutableListNames && this._mutableListNames.size) {
      this._globalMutableArrays = [];
      for (const name of this._mutableListNames) {
        const cap = this._mutableListSizes.get(name) || 64;
        const arr = this._mutableArrayName(name);
        const len = this._mutableLenName(name);
        lines.push(`var<private> ${arr}: array<f32, ${cap}>;`);
        lines.push(`var<private> ${len}: f32;`);
        const rfn = this._uid(name, 'sc_laget_');
        this._mutableReaderName = this._mutableReaderName || new Map();
        this._mutableReaderName.set(name, rfn);
        lines.push(`fn ${rfn}(idx: f32) -> f32 {`);
        lines.push(`  if (${len} <= 0.0) { return 0.0; }`);
        lines.push(`  let gi = u32(clamp(idx - 1.0, 0.0, ${len} - 1.0));`);
        lines.push(`  return ${arr}[gi];`);
        lines.push('}');
        this._globalMutableArrays.push({ arr, len, cap });
      }
      lines.push('');
    }

    lines.push('fn sc_mod(a: f32, b: f32) -> f32 {');
    lines.push('  return a - b * floor(a / b);');
    lines.push('}');
    lines.push('');
    lines.push('fn sc_rand(co: vec3f) -> f32 {');
    lines.push('  var c = co;');
    lines.push('  c = fract(c * 0.3183099 + vec3f(0.71, 0.113, 0.419));');
    lines.push('  c += dot(c, c.yzx + 19.19);');
    lines.push('  return fract((c.x + c.y) * (c.y + c.z) * (c.z + c.x));');
    lines.push('}');
    lines.push('');

    const procOrder = this._topologicalOrder();
    for (const code of procOrder) {
      const info = this._procedures.get(code);
      const fnName = this._uid(code, 'sc_fn_');
      if (code === this._pixel.proccode) this._pixelFnName = fnName;
      this._generateProcedureBody(code, info, lines);
      lines.push('');
    }

    lines.push('@vertex');
    lines.push('fn vs_main(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {');
    lines.push('  let pos = array<vec2f, 4>(');
    lines.push('    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0)');
    lines.push('  );');
    lines.push('  return vec4f(pos[vi], 0.0, 1.0);');
    lines.push('}');
    lines.push('');

    lines.push('@fragment');
    lines.push('fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {');
    lines.push('  sc_frag_coord = pos.xy;');
    if (this._globalMutableArrays && this._globalMutableArrays.length) {
      for (const m of this._globalMutableArrays) {
        lines.push(`  ${m.len} = 0.0;`);
      }
    }
    for (const v of this._globalVars) {
      lines.push(`  ${v} = ${this._globalVarInitializers.get(v) || '0.0'};`);
    }
    lines.push('  sc_color = 0.0;');
    lines.push('  let px = pos.x - u.u_resolution.x * 0.5;');
    lines.push('  let py = pos.y - u.u_resolution.y * 0.5;');
    lines.push(`  ${this._pixelFnName}(px, py);`);
    lines.push('  let c = floor(sc_color + 0.5);');
    lines.push('  let cl = clamp(c, 0.0, 16777215.0);');
    lines.push('  let cr = floor(cl / 65536.0);');
    lines.push('  let cg = sc_mod(floor(cl / 256.0), 256.0);');
    lines.push('  let cb = sc_mod(cl, 256.0);');
    lines.push('  return vec4f(cr / 255.0, cg / 255.0, cb / 255.0, 1.0);');
    lines.push('}');

    if (!this._colorWritten) {
      this.warnings.push('The "color" variable was never set inside the pixel block; the output will be black.');
    }
    return lines.join('\n');
  }

  _generateProcedureBody (code, info, lines) {
    const fnName = this._uid(code, 'sc_fn_');
    const params = info.paramNames.map((p) => this._uid(p, 'sc_a_') + ': f32');
    const ret = info.isReporter ? '-> f32' : '';
    lines.push(`fn ${fnName}(${params.join(', ')})${ret} {`);
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
    if (!isPixel) {
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
        const cond = this._condExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        return `${ind}if ${cond} {\n${body}\n${ind}}`;
      }
      case 'control_if_else': {
        const cond = this._condExpr(b, 'CONDITION');
        const body1 = this._substack(b, 'SUBSTACK', ind + '  ');
        const body2 = this._substack(b, 'SUBSTACK2', ind + '  ');
        return `${ind}if ${cond} {\n${body1}\n${ind}} else {\n${body2}\n${ind}}`;
      }
      case 'control_repeat': {
        const times = this._inputExpr(b, 'TIMES');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const literal = this._literalInt(b.inputs && b.inputs.TIMES);
        if (literal !== null && literal >= 0 && literal <= 128) {
          const out = [];
          for (let i = 0; i < literal; i++) out.push(body);
          return out.join('\n');
        }
        const lv = this._loopVar();
        return `${ind}for (var ${lv}: i32 = 0; ${lv} < 256; ${lv}++) {\n${ind}  if (f32(${lv}) >= ${times}) { break; }\n${body}\n${ind}}`;
      }
      case 'control_repeat_until': {
        const cond = this._condExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        return `${ind}for (var ${lv}: i32 = 0; ${lv} < 256; ${lv}++) {\n${ind}  if ${cond} { break; }\n${body}\n${ind}}`;
      }
      case 'control_while': {
        const cond = this._condExpr(b, 'CONDITION');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        return `${ind}for (var ${lv}: i32 = 0; ${lv} < 256; ${lv}++) {\n${ind}  if !(${cond}) { break; }\n${body}\n${ind}}`;
      }
      case 'control_for_each': {
        const name = this._getField(b, 'VARIABLE');
        const count = this._inputExpr(b, 'VALUE');
        const body = this._substack(b, 'SUBSTACK', ind + '  ');
        const lv = this._loopVar();
        const target = this._varTarget(name);
        return `${ind}for (var ${lv}: i32 = 0; ${lv} < 256; ${lv}++) {\n${ind}  if (f32(${lv}) >= ${count}) { break; }\n${ind}  ${target} = f32(${lv}) + 1.0;\n${body}\n${ind}}`;
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
        const foreverBody = this._substack(b, 'SUBSTACK', ind + '  ');
        const fv = this._loopVar();
        return `${ind}for (var ${fv}: i32 = 0; ${fv} < 256; ${fv}++) {\n${foreverBody}\n${ind}}`;
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
        return [
          `${ind}{`,
          `${ind}  let ri = floor(${idx} + 0.5);`,
          `${ind}  if (ri >= 1.0 && ri <= ${len}) {`,
          `${ind}    ${arr}[u32(ri - 1.0)] = ${val};`,
          `${ind}  } else if (ri == ${len} + 1.0 && ${len} < f32(${cap})) {`,
          `${ind}    ${arr}[u32(${len})] = ${val};`,
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
        return `${ind}if (${len} < f32(${cap})) { ${arr}[u32(${len})] = ${val}; ${len} = ${len} + 1.0; }`;
      }
      case 'data_deleteoflist': {
        const name = this._getField(b, 'LIST');
        if (!this._isMutableList(name)) {
          this.warnings.push(`"${op}" on read-only list "${name}" is ignored in shader mode.`);
          return `${ind}`;
        }
        const len = this._mutableLenName(name);
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
      case 'operator_lt':
        return `(${this._inputExpr(b, 'OPERAND1')} < ${this._inputExpr(b, 'OPERAND2')})`;
      case 'operator_gt':
        return `(${this._inputExpr(b, 'OPERAND1')} > ${this._inputExpr(b, 'OPERAND2')})`;
      case 'operator_equals':
        return `(abs(${this._inputExpr(b, 'OPERAND1')} - ${this._inputExpr(b, 'OPERAND2')}) < 0.000001)`;
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
        return wgslNum(parseFloat(this._getField(b, 'NUM')) || 0);
      case 'text': {
        const n = parseFloat(this._getField(b, 'TEXT'));
        return wgslNum(isFinite(n) ? n : 0);
      }
      case 'data_variable': {
        const name = this._getField(b, 'VARIABLE');
        if (String(name).toLowerCase() === 'color') return 'sc_color';
        return this._uid(name, 'sc_v_');
      }
      case 'sensing_timer':
        return 'u.u_time';
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
        const dLit = this._literalValue(b, 'NUM2');
        if (dLit !== null && dLit !== 0) {
          return `(${a} / ${d})`;
        }
        return `select(1e20, ${a} / ${d}, ${d} != 0.0)`;
      }
      case 'operator_mod': {
        const a = this._inputExpr(b, 'NUM1');
        const d = this._inputExpr(b, 'NUM2');
        const dLit = this._literalValue(b, 'NUM2');
        if (dLit !== null && dLit !== 0) {
          return `sc_mod(${a}, ${d})`;
        }
        return `select(0.0, sc_mod(${a}, ${d}), ${d} != 0.0)`;
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
        const seed = this._randCounter++;
        return `mix(${a}, ${bb}, sc_rand(vec3f(sc_frag_coord, u.u_time + ${seed}.0)))`;
      }
      case 'operator_lt':
        return `select(0.0, 1.0, ${this._inputExpr(b, 'OPERAND1')} < ${this._inputExpr(b, 'OPERAND2')})`;
      case 'operator_gt':
        return `select(0.0, 1.0, ${this._inputExpr(b, 'OPERAND1')} > ${this._inputExpr(b, 'OPERAND2')})`;
      case 'operator_equals':
        return `select(0.0, 1.0, abs(${this._inputExpr(b, 'OPERAND1')} - ${this._inputExpr(b, 'OPERAND2')}) < 0.000001)`;
      case 'operator_and':
        return `select(0.0, 1.0, ${this._condExpr(b, 'OPERAND1')} && ${this._condExpr(b, 'OPERAND2')})`;
      case 'operator_or':
        return `select(0.0, 1.0, ${this._condExpr(b, 'OPERAND1')} || ${this._condExpr(b, 'OPERAND2')})`;
      case 'operator_not':
        return `select(0.0, 1.0, !(${this._condExpr(b, 'OPERAND')}))`;
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
        return `u.sc_llen_${slot.texIndex}.${swiz}`;
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

export default ShaderCompilerWGSL;
