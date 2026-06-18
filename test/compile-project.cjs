const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Load and transpile the compiler
const compilerSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'shader-compiler.js'), 'utf8');
const { code: compilerCode } = babel.transformSync(compilerSrc, { presets: [['@babel/preset-env', { modules: 'cjs' }]] });
const compilerModule = { exports: {} };
new Function('module', 'exports', compilerCode)(compilerModule, compilerModule.exports);
const { ScratchShaderCompiler } = compilerModule.exports;

// Load sb3 deserialization
const sb3 = require('scratch-vm/src/serialization/sb3.js');

const projectPath = process.argv[2] || '/var/folders/1z/4q29wdfs5t3905mc17nm4fzw0000gn/T/opencode/uow4/project.json';
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

// Deserialize blocks for each target
const targets = [];
for (const target of project.targets) {
  const blocksCopy = JSON.parse(JSON.stringify(target.blocks));
  const deserialized = sb3.deserializeBlocks(blocksCopy);
  targets.push({
    name: target.name,
    isStage: target.isStage,
    blocks: { _blocks: deserialized },
    variables: target.variables
  });
}

// Build a fake runtime
const stageVars = {};
const stageTarget = targets.find(t => t.isStage);
if (stageTarget) {
  for (const id in stageTarget.variables) {
    stageVars[stageTarget.variables[id][0]] = stageTarget.variables[id][1];
  }
}
// Also include renderer sprite variables as "global" for shader purposes
const rendererTarget = targets.find(t => t.name === 'renderer');
const allVars = { ...stageVars };
if (rendererTarget) {
  for (const id in rendererTarget.variables) {
    allVars[rendererTarget.variables[id][0]] = rendererTarget.variables[id][1];
  }
}

const runtime = {
  targets,
  getTargetForStage: () => ({
    variables: Object.fromEntries(
      Object.entries(allVars).map(([name, value]) => [name, { name, value }])
    )
  })
};

console.log('Compiling', projectPath);
console.log('Targets:', targets.map(t => t.name).join(', '));
console.log('Total variables:', Object.keys(allVars).length);

const compiler = new ScratchShaderCompiler(runtime);
const result = compiler.compile();

console.log('\n=== Result ===');
console.log('found:', result.found);
console.log('errors:', result.errors.length);
result.errors.forEach(e => console.log('  ERROR:', e));
console.log('warnings:', result.warnings.length);
result.warnings.slice(0, 30).forEach(w => console.log('  WARN:', w));
if (result.warnings.length > 30) console.log('  ... and', result.warnings.length - 30, 'more warnings');

if (result.fragmentSource) {
  const lines = result.fragmentSource.split('\n');
  console.log('\n=== Fragment shader ===');
  console.log('Lines:', lines.length);
  console.log('Chars:', result.fragmentSource.length);
  console.log('Variable uniforms:', result.variableUniforms.length);
  console.log('Pixel arg names:', result.pixelArgNames);

  // Write to file for inspection
  const outPath = path.join(__dirname, 'output.glsl');
  fs.writeFileSync(outPath, result.fragmentSource);
  console.log('\nFragment shader written to', outPath);

  // Show first 80 and last 30 lines
  console.log('\n--- First 80 lines ---');
  console.log(lines.slice(0, 80).join('\n'));
  console.log('\n--- Last 30 lines ---');
  console.log(lines.slice(-30).join('\n'));
}
