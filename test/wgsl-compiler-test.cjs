const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const glslSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'shader-compiler.js'), 'utf8');
const { code: glslCode } = babel.transformSync(glslSrc, { presets: [['@babel/preset-env', { modules: 'cjs' }]] });
const glslModule = { exports: {} };
new Function('module', 'exports', glslCode)(glslModule, glslModule.exports);
const { ScratchShaderCompiler } = glslModule.exports;

const wgslSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'shader-compiler-wgsl.js'), 'utf8');
const { code: wgslCode } = babel.transformSync(wgslSrc, { presets: [['@babel/preset-env', { modules: 'cjs' }]] });
const wgslModule = { exports: {} };
const moduleRequire = (mod) => {
  if (mod === './shader-compiler.js') return glslModule.exports;
  return require(mod);
};
new Function('module', 'exports', 'require', wgslCode)(wgslModule, wgslModule.exports, moduleRequire);
const { ShaderCompilerWGSL } = wgslModule.exports;

let passed = 0;
let failed = 0;
const assert = (cond, msg) => {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL:', msg); }
};

const field = (value, id) => ({ name: 'x', value, ...(id ? { id } : {}) });
const input = (blockId, shadowId) => ({ block: blockId || null, shadow: (shadowId === undefined ? null : shadowId) });

let counter = 0;
const id = (p) => p + (++counter);

function block (opcode, opts) {
  return {
    id: id('b'),
    opcode,
    next: opts.next || null,
    parent: opts.parent || null,
    shadow: opts.shadow || false,
    topLevel: opts.topLevel || false,
    inputs: opts.inputs || {},
    fields: opts.fields || {},
    mutation: opts.mutation || undefined
  };
}

function makeRuntime (blocks) {
  return {
    targets: [{ blocks: { _blocks: blocks } }],
    getTargetForStage: () => ({ variables: { v: { name: 'color', value: 0 } } })
  };
}

function testBasicPixel () {
  const argx = block('argument_reporter_string_number', { fields: { VALUE: field('x') } });
  const argy = block('argument_reporter_string_number', { fields: { VALUE: field('y') } });
  const add = block('operator_add', { inputs: { NUM1: input(argx.id), NUM2: input(argy.id) } });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(add.id) },
    fields: { VARIABLE: field('color', 'vid') }
  });
  const proto = block('procedures_prototype', {
    mutation: {
      proccode: 'pixel %n %n',
      argumentnames: '["x","y"]',
      argumentids: '["ax","ay"]',
      argumentdefaults: '[0,0]'
    }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: setcolor.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  setcolor.parent = pdef.id;
  add.parent = setcolor.id;
  argx.parent = add.id;
  argy.parent = add.id;
  proto.parent = pdef.id;

  const blocks = { [pdef.id]: pdef, [proto.id]: proto, [setcolor.id]: setcolor, [add.id]: add, [argx.id]: argx, [argy.id]: argy };
  const r = new ShaderCompilerWGSL(makeRuntime(blocks)).compile();

  assert(r.found === true, 'wgsl basic pixel -> found');
  assert(r.errors.length === 0, 'wgsl basic pixel -> no errors, got: ' + JSON.stringify(r.errors));
  assert(typeof r.wgslSource === 'string', 'wgsl basic pixel -> has wgslSource');
  assert(r.wgslSource.indexOf('fn sc_fn_pixel') !== -1, 'wgsl basic pixel -> has pixel fn');
  assert(r.wgslSource.indexOf('sc_color = (sc_a_x + sc_a_y);') !== -1, 'wgsl basic pixel -> sets color to x+y\n' + r.wgslSource);
  assert(r.wgslSource.indexOf('@fragment') !== -1, 'wgsl basic pixel -> has @fragment entry');
  assert(r.wgslSource.indexOf('@vertex') !== -1, 'wgsl basic pixel -> has @vertex entry');
  assert(r.wgslSource.indexOf('struct Uniforms') !== -1, 'wgsl basic pixel -> has Uniforms struct');
  assert(r.wgslSource.indexOf('var<private> sc_color: f32;') !== -1, 'wgsl basic pixel -> has sc_color private var');
  assert(r.wgslSource.indexOf('fn vs_main') !== -1, 'wgsl basic pixel -> has vs_main');
  assert(r.wgslSource.indexOf('fn fs_main') !== -1, 'wgsl basic pixel -> has fs_main');
  assert(r.backend === 'webgpu', 'wgsl basic pixel -> backend is webgpu');
}

function testHelperReporter () {
  const argn = block('argument_reporter_string_number', { fields: { VALUE: field('n') } });
  const mul = block('operator_multiply', { inputs: { NUM1: input(argn.id), NUM2: input(argn.id) } });
  const ret = block('procedures_return', { inputs: { VALUE: input(mul.id) } });
  const proto2 = block('procedures_prototype', {
    mutation: {
      proccode: 'square %n',
      argumentnames: '["n"]',
      argumentids: '["an"]',
      argumentdefaults: '[0]'
    }
  });
  const pdef2 = block('procedures_definition', {
    topLevel: true,
    next: ret.id,
    inputs: { custom_block: input(proto2.id, proto2.id) }
  });
  ret.parent = pdef2.id;
  mul.parent = ret.id;
  argn.parent = mul.id;
  proto2.parent = pdef2.id;

  const argx = block('argument_reporter_string_number', { fields: { VALUE: field('x') } });
  const call = block('procedures_call', {
    mutation: { proccode: 'square %n', argumentids: '["an"]', return: true },
    inputs: { an: input(argx.id) }
  });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(call.id) },
    fields: { VARIABLE: field('color', 'vid') }
  });
  const proto = block('procedures_prototype', {
    mutation: {
      proccode: 'pixel %n %n',
      argumentnames: '["x","y"]',
      argumentids: '["ax","ay"]',
      argumentdefaults: '[0,0]'
    }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: setcolor.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  setcolor.parent = pdef.id;
  call.parent = setcolor.id;
  argx.parent = call.id;
  proto.parent = pdef.id;

  const blocks = {};
  [pdef, proto, setcolor, call, argx, pdef2, proto2, ret, mul, argn].forEach((b) => { blocks[b.id] = b; });
  const r = new ShaderCompilerWGSL(makeRuntime(blocks)).compile();

  assert(r.found === true, 'wgsl helper -> found');
  assert(r.errors.length === 0, 'wgsl helper -> no errors, got: ' + JSON.stringify(r.errors));
  assert(r.wgslSource.indexOf('fn sc_fn_square') !== -1, 'wgsl helper -> square is fn reporter');
  assert(r.wgslSource.indexOf('-> f32') !== -1, 'wgsl helper -> square returns f32');
  assert(r.wgslSource.indexOf('return (sc_a_n * sc_a_n);') !== -1, 'wgsl helper -> square returns n*n');
  assert(r.wgslSource.indexOf('sc_color = sc_fn_square') !== -1, 'wgsl helper -> pixel calls square\n' + r.wgslSource);
}

function testTernarySelect () {
  const num1 = block('math_number', { fields: { NUM: field('5') } });
  const num2 = block('math_number', { fields: { NUM: field('3') } });
  const lt = block('operator_lt', { inputs: { OPERAND1: input(num1.id), OPERAND2: input(num2.id) } });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(lt.id) },
    fields: { VARIABLE: field('color', 'vid') }
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'pixel %n %n', argumentnames: '["x","y"]', argumentids: '["ax","ay"]', argumentdefaults: '[0,0]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true, next: setcolor.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  setcolor.parent = pdef.id;
  proto.parent = pdef.id;
  const blocks = { [pdef.id]: pdef, [proto.id]: proto, [setcolor.id]: setcolor, [lt.id]: lt, [num1.id]: num1, [num2.id]: num2 };
  const r = new ShaderCompilerWGSL(makeRuntime(blocks)).compile();
  assert(r.errors.length === 0, 'wgsl ternary -> no errors');
  assert(r.wgslSource.indexOf('select(0.0, 1.0,') !== -1, 'wgsl ternary -> uses select() instead of ternary');
}

function testMutableListDirectIndex () {
  const argn = block('argument_reporter_string_number', { fields: { VALUE: field('n') } });
  const idx = block('math_number', { fields: { NUM: field('1') } });
  const itemof = block('data_itemoflist', {
    fields: { LIST: field('mylist', 'lid') },
    inputs: { INDEX: input(idx.id) }
  });
  const add = block('data_addtolist', {
    fields: { LIST: field('mylist', 'lid') },
    inputs: { ITEM: input(argn.id) },
    next: itemof.id
  });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(itemof.id) },
    fields: { VARIABLE: field('color', 'vid') },
    next: add.id
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'pixel %n %n', argumentnames: '["x","y"]', argumentids: '["ax","ay"]', argumentdefaults: '[0,0]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true, next: setcolor.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  setcolor.parent = pdef.id;
  add.parent = setcolor.id;
  itemof.parent = add.id;
  argn.parent = add.id;
  idx.parent = itemof.id;
  proto.parent = pdef.id;
  const blocks = { [pdef.id]: pdef, [proto.id]: proto, [setcolor.id]: setcolor, [add.id]: add, [itemof.id]: itemof, [argn.id]: argn, [idx.id]: idx };
  const runtime = {
    targets: [{ blocks: { _blocks: blocks }, variables: { lid: { name: 'mylist', value: [], type: 'list' } } }],
    getTargetForStage: () => ({ variables: { v: { name: 'color', value: 0 } } })
  };
  const r = new ShaderCompilerWGSL(runtime).compile();
  assert(r.found === true, 'wgsl mutable -> found');
  assert(r.errors.length === 0, 'wgsl mutable -> no errors, got: ' + JSON.stringify(r.errors));
  assert(r.wgslSource.indexOf('array<f32,') !== -1, 'wgsl mutable -> has array declaration\n' + r.wgslSource);
  assert(r.wgslSource.indexOf('sc_la_') !== -1, 'wgsl mutable -> has mutable array var');
}

function testNoPixel () {
  const runtime = makeRuntime({});
  const r = new ShaderCompilerWGSL(runtime).compile();
  assert(r.found === false, 'wgsl no pixel -> found false');
  assert(r.errors.length === 0, 'wgsl no pixel -> no errors');
}

function testRecursion () {
  const argx = block('argument_reporter_string_number', { fields: { VALUE: field('x') } });
  const argy = block('argument_reporter_string_number', { fields: { VALUE: field('y') } });
  const call = block('procedures_call', {
    mutation: { proccode: 'pixel %n %n', argumentids: '["ax","ay"]' },
    inputs: { ax: input(argx.id), ay: input(argy.id) }
  });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(argx.id) },
    fields: { VARIABLE: field('color', 'vid') },
    next: call.id
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'pixel %n %n', argumentnames: '["x","y"]', argumentids: '["ax","ay"]', argumentdefaults: '[0,0]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true, next: setcolor.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  setcolor.parent = pdef.id;
  call.parent = setcolor.id;
  argx.parent = setcolor.id;
  argy.parent = call.id;
  proto.parent = pdef.id;
  const blocks = {};
  [pdef, proto, setcolor, call, argx, argy].forEach((b) => { blocks[b.id] = b; });
  const r = new ShaderCompilerWGSL(makeRuntime(blocks)).compile();
  assert(r.found === true, 'wgsl recursion -> found');
  assert(r.errors.length > 0, 'wgsl recursion -> has errors');
  assert(/Recursion/.test(r.errors[0]), 'wgsl recursion -> error mentions recursion: ' + r.errors[0]);
}

testNoPixel();
testBasicPixel();
testHelperReporter();
testTernarySelect();
testMutableListDirectIndex();
testRecursion();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
