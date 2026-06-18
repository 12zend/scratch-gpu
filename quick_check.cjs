const babel = require('@babel/core');
const fs = require('fs');
const sb3 = require('scratch-vm/src/serialization/sb3.js');
const project = JSON.parse(fs.readFileSync('/tmp/uow5_extract/project.json', 'utf8'));
const src = fs.readFileSync('src/shader-compiler.js', 'utf8');
const { code } = babel.transformSync(src, { presets: [['@babel/preset-env', { modules: 'cjs' }]] });
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const { ScratchShaderCompiler } = mod.exports;
const targets = [];
for (const t of project.targets) {
  const blocksCopy = JSON.parse(JSON.stringify(t.blocks));
  const deserialized = sb3.deserializeBlocks(blocksCopy);
  targets.push({name: t.name, isStage: t.isStage, blocks: {_blocks: deserialized}, variables: t.variables, lists: t.lists});
}
const c = new ScratchShaderCompiler({targets});
c.compile();
const reachFromPixel = new Set();
const queue = ['pixel %s %s'];
while (queue.length) {
  const code = queue.pop();
  if (reachFromPixel.has(code)) continue;
  reachFromPixel.add(code);
  const info = c._procedures.get(code);
  if (!info) continue;
  c._walkAll(info.bodyHead, info.blocks, b => {
    if (b.opcode === 'procedures_call' && b.mutation && b.mutation.proccode) {
      queue.push(b.mutation.proccode);
    }
  });
}
console.log('Reachable from pixel:');
for (const r of reachFromPixel) console.log('  ' + r);
const trigCalled = reachFromPixel.has('trigonometry');
console.log('\ntrigonometry called from pixel chain?', trigCalled);
