const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'gpu-kernel-detector.js'), 'utf8');
const { code } = babel.transformSync(src, { presets: [['@babel/preset-env', { modules: 'cjs' }]] });
const moduleObj = { exports: {} };
new Function('module', 'exports', code)(moduleObj, moduleObj.exports);
const { GpuKernelDetector } = moduleObj.exports;

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
    getTargetForStage: () => ({ variables: {} })
  };
}

function testMapPattern () {
  // for each i in list: replace item i of result with i * 2
  const argi = block('data_variable', { fields: { VARIABLE: field('i') } });
  const two = block('math_number', { fields: { NUM: field('2') }, shadow: true });
  const mul = block('operator_multiply', { inputs: { NUM1: input(argi.id), NUM2: input(two.id) } });
  const mulShadow = block('math_number', { fields: { NUM: field('0') }, shadow: true });
  const replace = block('data_replaceitemoflist', {
    inputs: {
      INDEX: input(argi.id),
      ITEM: input(mul.id, mulShadow.id)
    },
    fields: { LIST: field('result') }
  });
  const foreach = block('control_for_each', {
    inputs: { SUBSTACK: input(replace.id) },
    fields: { VARIABLE: field('i') }
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'init', argumentnames: '[]', argumentids: '[]', argumentdefaults: '[]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: foreach.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  foreach.parent = pdef.id;
  replace.parent = foreach.id;

  const blocks = {};
  [pdef, proto, foreach, replace, argi, mul, two, mulShadow].forEach((b) => { blocks[b.id] = b; });

  const detector = new GpuKernelDetector(makeRuntime(blocks));
  const result = detector.detect();
  assert(result.loopCandidates.length === 1, 'map -> one candidate');
  assert(result.loopCandidates[0].parallelizable === true, 'map -> parallelizable, reason=' + result.loopCandidates[0].reason);
  assert(result.loopCandidates[0].pattern === 'map', 'map -> pattern is map');
  assert(result.injectedKernels.length === 1, 'map -> one injected kernel');
}

function testSelfReadingList () {
  // for each i in list: replace item i of result with item i of result + 1
  const argi = block('data_variable', { fields: { VARIABLE: field('i') } });
  const item = block('data_itemoflist', {
    inputs: { INDEX: input(argi.id) },
    fields: { LIST: field('result') }
  });
  const one = block('math_number', { fields: { NUM: field('1') }, shadow: true });
  const add = block('operator_add', { inputs: { NUM1: input(item.id), NUM2: input(one.id) } });
  const replace = block('data_replaceitemoflist', {
    inputs: { INDEX: input(argi.id), ITEM: input(add.id) },
    fields: { LIST: field('result') }
  });
  const foreach = block('control_for_each', {
    inputs: { SUBSTACK: input(replace.id) },
    fields: { VARIABLE: field('i') }
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'init', argumentnames: '[]', argumentids: '[]', argumentdefaults: '[]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: foreach.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  foreach.parent = pdef.id;
  replace.parent = foreach.id;

  const blocks = {};
  [pdef, proto, foreach, replace, argi, item, add, one].forEach((b) => { blocks[b.id] = b; });

  const detector = new GpuKernelDetector(makeRuntime(blocks));
  const result = detector.detect();
  assert(result.loopCandidates.length === 1, 'self-read -> one candidate');
  assert(result.loopCandidates[0].parallelizable === false, 'self-read -> not parallelizable');
  assert(/result.*read.*written/.test(result.loopCandidates[0].reason), 'self-read -> reason mentions read: ' + result.loopCandidates[0].reason);
}

function testAccumulator () {
  // repeat 10: set sum to sum + 1
  const sumVar = block('data_variable', { fields: { VARIABLE: field('sum') } });
  const one = block('math_number', { fields: { NUM: field('1') } });
  const add = block('operator_add', { inputs: { NUM1: input(sumVar.id), NUM2: input(one.id) } });
  const setSum = block('data_setvariableto', {
    inputs: { VALUE: input(add.id) },
    fields: { VARIABLE: field('sum') }
  });
  const repeat = block('control_repeat', {
    inputs: { SUBSTACK: input(setSum.id), TIMES: input(null, block('math_number', { fields: { NUM: field('10') }, shadow: true }).id) }
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'init', argumentnames: '[]', argumentids: '[]', argumentdefaults: '[]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: repeat.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  repeat.parent = pdef.id;
  setSum.parent = repeat.id;

  const blocks = {};
  [pdef, proto, repeat, setSum, sumVar, add, one].forEach((b) => { blocks[b.id] = b; });

  const detector = new GpuKernelDetector(makeRuntime(blocks));
  const result = detector.detect();
  assert(result.loopCandidates.length === 1, 'accumulator -> one candidate');
  assert(result.loopCandidates[0].parallelizable === false, 'accumulator -> not parallelizable');
  assert(/sum.*read before write|cross-iteration/i.test(result.loopCandidates[0].reason), 'accumulator -> reason mentions dependency: ' + result.loopCandidates[0].reason);
}

function testLoopCountKnown () {
  const five = block('math_number', { fields: { NUM: field('5') }, shadow: true });
  const setX = block('data_setvariableto', {
    inputs: { VALUE: input(five.id) },
    fields: { VARIABLE: field('x') }
  });
  const times42 = block('math_number', { fields: { NUM: field('42') }, shadow: true });
  const repeat = block('control_repeat', {
    inputs: { SUBSTACK: input(setX.id), TIMES: input(times42.id) }
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'init', argumentnames: '[]', argumentids: '[]', argumentdefaults: '[]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: repeat.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  repeat.parent = pdef.id;
  setX.parent = repeat.id;

  const blocks = {};
  [pdef, proto, repeat, setX, five, times42].forEach((b) => { blocks[b.id] = b; });

  const detector = new GpuKernelDetector(makeRuntime(blocks));
  const result = detector.detect();
  assert(result.loopCandidates.length === 1, 'count -> one candidate');
  assert(result.loopCandidates[0].unrollable === true, 'count 42 -> unrollable');
}

function testLoopCountTooLarge () {
  const five = block('math_number', { fields: { NUM: field('5') }, shadow: true });
  const setX = block('data_setvariableto', {
    inputs: { VALUE: input(five.id) },
    fields: { VARIABLE: field('x') }
  });
  const times999 = block('math_number', { fields: { NUM: field('999') }, shadow: true });
  const repeat = block('control_repeat', {
    inputs: { SUBSTACK: input(setX.id), TIMES: input(times999.id) }
  });
  const proto = block('procedures_prototype', {
    mutation: { proccode: 'init', argumentnames: '[]', argumentids: '[]', argumentdefaults: '[]' }
  });
  const pdef = block('procedures_definition', {
    topLevel: true,
    next: repeat.id,
    inputs: { custom_block: input(proto.id, proto.id) }
  });
  repeat.parent = pdef.id;
  setX.parent = repeat.id;

  const blocks = {};
  [pdef, proto, repeat, setX, five, times999].forEach((b) => { blocks[b.id] = b; });

  const detector = new GpuKernelDetector(makeRuntime(blocks));
  const result = detector.detect();
  assert(result.loopCandidates.length === 1, 'large count -> one candidate');
  assert(result.loopCandidates[0].unrollable === false, 'large count -> not unrollable');
}

testMapPattern();
testSelfReadingList();
testAccumulator();
testLoopCountKnown();
testLoopCountTooLarge();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
