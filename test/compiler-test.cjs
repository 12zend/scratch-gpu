const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'shader-compiler.js'), 'utf8');
const { code } = babel.transformSync(src, { presets: [['@babel/preset-env', { modules: 'cjs' }]] });
const moduleObj = { exports: {} };
new Function('module', 'exports', code)(moduleObj, moduleObj.exports);
const { ScratchShaderCompiler } = moduleObj.exports;

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

function testNoPixel () {
  const runtime = makeRuntime({});
  const r = new ScratchShaderCompiler(runtime).compile();
  assert(r.found === false, 'no pixel proc -> found false');
  assert(r.errors.length === 0, 'no pixel proc -> no errors');
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
  const r = new ScratchShaderCompiler(makeRuntime(blocks)).compile();

  assert(r.found === true, 'basic pixel -> found');
  assert(r.errors.length === 0, 'basic pixel -> no errors, got: ' + JSON.stringify(r.errors));
  assert(typeof r.fragmentSource === 'string', 'basic pixel -> has fragmentSource');
  assert(r.fragmentSource.indexOf('void sc_fn_pixel') !== -1, 'basic pixel -> has pixel fn');
  assert(r.fragmentSource.indexOf('sc_color = (sc_a_x + sc_a_y);') !== -1, 'basic pixel -> sets color to x+y\n' + r.fragmentSource);
  assert(r.fragmentSource.indexOf('uniform vec2 u_resolution;') !== -1, 'basic pixel -> has resolution uniform');
  assert(r.fragmentSource.indexOf('gl_FragColor') !== -1, 'basic pixel -> writes gl_FragColor');
  assert(r.fragmentSource.indexOf('sc_a_x') !== -1 && r.fragmentSource.indexOf('sc_a_y') !== -1, 'basic pixel -> has args');
  assert(r.variableUniforms.every((u) => u.scratchName !== 'color'), 'basic pixel -> color not a uniform');
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
  const r = new ScratchShaderCompiler(makeRuntime(blocks)).compile();

  assert(r.found === true, 'helper -> found');
  assert(r.errors.length === 0, 'helper -> no errors, got: ' + JSON.stringify(r.errors));
  assert(r.fragmentSource.indexOf('float sc_fn_square') !== -1, 'helper -> square is float reporter');
  assert(r.fragmentSource.indexOf('return (sc_a_n * sc_a_n);') !== -1, 'helper -> square returns n*n');
  assert(r.fragmentSource.indexOf('sc_color = sc_fn_square') !== -1, 'helper -> pixel calls square\n' + r.fragmentSource);
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
  argx.parent = setcolor.id;
  argy.parent = call.id;
  proto.parent = pdef.id;

  const blocks = {};
  [pdef, proto, setcolor, call, argx, argy].forEach((b) => { blocks[b.id] = b; });
  const r = new ScratchShaderCompiler(makeRuntime(blocks)).compile();

  assert(r.found === true, 'recursion -> found');
  assert(r.errors.length > 0, 'recursion -> has errors');
  assert(/Recursion/.test(r.errors[0]), 'recursion -> error mentions recursion: ' + r.errors[0]);
}

function testEmptyDistanceArgument () {
  // Build: pixel -> call castRay(ox,oy,oz,dx,dy,dz,dist=empty) -> set color
  // The "dist" parameter is empty (no explicit block, only a text shadow with "Infinity" that parses to 0).
  // Expected: the generated call uses 1e20 for the dist argument.

  const argDist = block('argument_reporter_string_number', { fields: { VALUE: field('dist') } });
  const setHitT = block('data_setvariableto', {
    inputs: { VALUE: input(argDist.id) },
    fields: { VARIABLE: field('hitT', 'hid') }
  });
  const castRayProto = block('procedures_prototype', {
    mutation: {
      proccode: 'castRay %s %s %s dir %s %s %s dist %s',
      argumentnames: '["ox","oy","oz","dx","dy","dz","dist"]',
      argumentids: '["ax","ay","az","adx","ady","adz","adist"]',
      argumentdefaults: '[null,null,null,null,null,null,null]'
    }
  });
  const castRayDef = block('procedures_definition', {
    topLevel: true,
    next: setHitT.id,
    inputs: { custom_block: input(castRayProto.id, castRayProto.id) }
  });
  setHitT.parent = castRayDef.id;
  argDist.parent = setHitT.id;
  castRayProto.parent = castRayDef.id;

  // The default-empty "Infinity" text shadow for the dist input (block === shadow).
  const distShadow = block('text', { fields: { TEXT: field('Infinity') }, shadow: true });
  // Default empty math_number shadow for the other args.
  const emptyShadow = block('math_number', { fields: { NUM: field('') }, shadow: true });

  const callCastRay = block('procedures_call', {
    mutation: {
      proccode: 'castRay %s %s %s dir %s %s %s dist %s',
      argumentids: '["ax","ay","az","adx","ady","adz","adist"]'
    },
    inputs: {
      ax: input(null, emptyShadow.id),
      ay: input(null, emptyShadow.id),
      az: input(null, emptyShadow.id),
      adx: input(null, emptyShadow.id),
      ady: input(null, emptyShadow.id),
      adz: input(null, emptyShadow.id),
      adist: input(distShadow.id, distShadow.id)
    }
  });
  const argx2 = block('argument_reporter_string_number', { fields: { VALUE: field('x') } });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(argx2.id) },
    fields: { VARIABLE: field('color', 'vid') }
  });
  const pixelProto = block('procedures_prototype', {
    mutation: {
      proccode: 'pixel %n %n',
      argumentnames: '["x","y"]',
      argumentids: '["px","py"]',
      argumentdefaults: '[0,0]'
    }
  });
  const pixelDef = block('procedures_definition', {
    topLevel: true,
    next: callCastRay.id,
    inputs: { custom_block: input(pixelProto.id, pixelProto.id) }
  });
  callCastRay.next = setcolor.id;
  setcolor.parent = pixelDef.id;
  callCastRay.parent = pixelDef.id;
  argx2.parent = setcolor.id;
  pixelProto.parent = pixelDef.id;

  const blocks = {};
  [pixelDef, pixelProto, setcolor, argx2,
    castRayDef, castRayProto, setHitT, argDist,
    callCastRay, distShadow, emptyShadow].forEach((b) => { blocks[b.id] = b; });

  const r = new ScratchShaderCompiler(makeRuntime(blocks)).compile();
  assert(r.found === true, 'empty dist -> found, errors=' + JSON.stringify(r.errors));
  assert(r.errors.length === 0, 'empty dist -> no errors, got: ' + JSON.stringify(r.errors));
  // Find the call site. The function signature uses "in float" parameters; the call uses
  // bare expressions. Match a call whose first arg does not start with "in float".
  const callMatch = r.fragmentSource.match(/sc_fn_castRay_s_s_s_dir_s_s_s_dist_s\((?:(?!in float)[\s\S])+\);/);
  assert(callMatch, 'empty dist -> castRay call exists in shader');
  assert(callMatch && /1e20/.test(callMatch[0]), 'empty dist -> call uses 1e20, got: ' + (callMatch && callMatch[0]));
}

function testExplicitDistanceArgument () {
  // Build: pixel -> call castRay(ox,oy,oz,dx,dy,dz,dist=42) -> set color
  // The "dist" parameter has an explicit user-provided value of 42.
  // Expected: the call should use 42.0, not 1e20.

  const argDist = block('argument_reporter_string_number', { fields: { VALUE: field('dist') } });
  const setHitT = block('data_setvariableto', {
    inputs: { VALUE: input(argDist.id) },
    fields: { VARIABLE: field('hitT', 'hid') }
  });
  const castRayProto = block('procedures_prototype', {
    mutation: {
      proccode: 'castRay %s %s %s dir %s %s %s dist %s',
      argumentnames: '["ox","oy","oz","dx","dy","dz","dist"]',
      argumentids: '["ax","ay","az","adx","ady","adz","adist"]',
      argumentdefaults: '[null,null,null,null,null,null,null]'
    }
  });
  const castRayDef = block('procedures_definition', {
    topLevel: true,
    next: setHitT.id,
    inputs: { custom_block: input(castRayProto.id, castRayProto.id) }
  });
  setHitT.parent = castRayDef.id;
  argDist.parent = setHitT.id;
  castRayProto.parent = castRayDef.id;

  // The shadow for the dist input and the explicit user-provided 42.
  const distShadow = block('math_number', { fields: { NUM: field('0') }, shadow: true });
  const distVal = block('math_number', { fields: { NUM: field('42') } });
  const emptyShadow = block('math_number', { fields: { NUM: field('') }, shadow: true });

  const callCastRay = block('procedures_call', {
    mutation: {
      proccode: 'castRay %s %s %s dir %s %s %s dist %s',
      argumentids: '["ax","ay","az","adx","ady","adz","adist"]'
    },
    inputs: {
      ax: input(null, emptyShadow.id),
      ay: input(null, emptyShadow.id),
      az: input(null, emptyShadow.id),
      adx: input(null, emptyShadow.id),
      ady: input(null, emptyShadow.id),
      adz: input(null, emptyShadow.id),
      adist: input(distVal.id, distShadow.id)
    }
  });
  const argx2 = block('argument_reporter_string_number', { fields: { VALUE: field('x') } });
  const setcolor = block('data_setvariableto', {
    inputs: { VALUE: input(argx2.id) },
    fields: { VARIABLE: field('color', 'vid') }
  });
  const pixelProto = block('procedures_prototype', {
    mutation: {
      proccode: 'pixel %n %n',
      argumentnames: '["x","y"]',
      argumentids: '["px","py"]',
      argumentdefaults: '[0,0]'
    }
  });
  const pixelDef = block('procedures_definition', {
    topLevel: true,
    next: callCastRay.id,
    inputs: { custom_block: input(pixelProto.id, pixelProto.id) }
  });
  callCastRay.next = setcolor.id;
  setcolor.parent = pixelDef.id;
  callCastRay.parent = pixelDef.id;
  argx2.parent = setcolor.id;
  pixelProto.parent = pixelDef.id;

  const blocks = {};
  [pixelDef, pixelProto, setcolor, argx2,
    castRayDef, castRayProto, setHitT, argDist,
    callCastRay, distVal, distShadow, emptyShadow].forEach((b) => { blocks[b.id] = b; });

  const r = new ScratchShaderCompiler(makeRuntime(blocks)).compile();
  assert(r.found === true, 'explicit dist -> found, errors=' + JSON.stringify(r.errors));
  assert(r.errors.length === 0, 'explicit dist -> no errors, got: ' + JSON.stringify(r.errors));
  const callMatch = r.fragmentSource.match(/sc_fn_castRay_s_s_s_dir_s_s_s_dist_s\((?:(?!in float)[\s\S])+\);/);
  assert(callMatch, 'explicit dist -> castRay call exists in shader');
  assert(callMatch && /42\.0/.test(callMatch[0]), 'explicit dist -> call uses 42.0, got: ' + (callMatch && callMatch[0]));
  assert(callMatch && !/1e20/.test(callMatch[0]), 'explicit dist -> call does NOT use 1e20, got: ' + (callMatch && callMatch[0]));
}

testNoPixel();
testBasicPixel();
testHelperReporter();
testRecursion();
testEmptyDistanceArgument();
testExplicitDistanceArgument();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
