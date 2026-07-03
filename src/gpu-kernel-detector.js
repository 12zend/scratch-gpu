const SUBSTACK_INPUTS = new Set(['SUBSTACK', 'SUBSTACK2', 'SUBSTACK3']);

const getProcLabel = (proccode) => proccode.replace(/%[nsb]/g, '').trim().toLowerCase();

const inputChild = (input) => {
  if (!input) return null;
  if (input.block !== null && input.block !== undefined) return input.block;
  if (input.shadow !== null && input.shadow !== undefined) return input.shadow;
  return null;
};

const getField = (block, name) => {
  const f = block && block.fields && block.fields[name];
  return f ? f.value : null;
};

export class GpuKernelDetector {
  constructor (runtime) {
    this.runtime = runtime;
    this.warnings = [];
  }

  detect () {
    this.warnings = [];
    this._injectIdCounter = 0;
    let procedures = this._discoverProcedures();
    const injected = this._injectLoopKernels(procedures);
    const renderPattern = this._synthesizePixelFromRender(procedures);
    // Re-discover so that injected/synthesized blocks are visible.
    procedures = this._discoverProcedures();
    const screenKernels = this._findScreenKernels(procedures);
    const computeKernels = this._findComputeKernels(procedures);
    const loopCandidates = this._findLoopCandidates(procedures);
    const penCandidates = this._findPenCandidates(procedures);

    const kernels = [];
    for (const k of screenKernels) kernels.push(k);
    for (const k of computeKernels) kernels.push(k);

    return {
      kernels,
      injectedKernels: injected,
      renderPattern,
      loopCandidates,
      penCandidates,
      warnings: this.warnings.slice()
    };
  }

  _discoverProcedures () {
    const procedures = [];
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
        procedures.push({
          blockId: id,
          proccode,
          paramNames,
          bodyHead,
          blocks,
          target
        });
      }
    }
    return procedures;
  }

  _walkAll (headId, blocks, visit) {
    let id = headId;
    while (id) {
      const b = blocks._blocks[id];
      if (!b) break;
      visit(b);
      for (const key in b.inputs) {
        const childId = inputChild(b.inputs[key]);
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
      const childId = inputChild(b.inputs[key]);
      if (!childId) continue;
      if (SUBSTACK_INPUTS.has(key)) {
        this._walkAll(childId, blocks, visit);
      } else {
        this._walkValue(childId, blocks, visit);
      }
    }
  }

  _hasOpcode (headId, blocks, opcode) {
    let found = false;
    this._walkAll(headId, blocks, (b) => {
      if (b.opcode === opcode) found = true;
    });
    return found;
  }

  _writesVariable (headId, blocks, varName) {
    let found = false;
    const lower = String(varName).toLowerCase();
    this._walkAll(headId, blocks, (b) => {
      if ((b.opcode === 'data_setvariableto' || b.opcode === 'data_changevariableby') &&
          String(getField(b, 'VARIABLE')).toLowerCase() === lower) {
        found = true;
      }
    });
    return found;
  }

  _findScreenKernels (procedures) {
    const kernels = [];
    for (const info of procedures) {
      const label = getProcLabel(info.proccode);
      // gpu_ prefixed blocks are compute kernels even if they write color.
      if (label.startsWith('gpu_')) continue;
      if (label === 'pixel' && info.paramNames.length === 2) {
        kernels.push({
          type: 'screen',
          proccode: info.proccode,
          paramNames: info.paramNames,
          blockId: info.blockId,
          target: info.target,
          status: 'ready',
          reason: 'Detected pixel(x,y) screen kernel'
        });
      } else if (label === 'pen' && info.paramNames.length === 2) {
        kernels.push({
          type: 'screen',
          proccode: info.proccode,
          paramNames: info.paramNames,
          blockId: info.blockId,
          target: info.target,
          status: 'ready',
          reason: 'Detected pen(x,y) screen kernel (treated as point-per-pixel drawing)'
        });
      } else if (this._writesVariable(info.bodyHead, info.blocks, 'color')) {
        kernels.push({
          type: 'screen',
          proccode: info.proccode,
          paramNames: info.paramNames,
          blockId: info.blockId,
          target: info.target,
          status: info.paramNames.length === 2 ? 'ready' : 'planned',
          reason: info.paramNames.length === 2
            ? 'Writes "color" variable with 2 parameters'
            : 'Writes "color" variable but does not match screen kernel signature'
        });
      }
    }
    return kernels;
  }

  _findComputeKernels (procedures) {
    const kernels = [];
    for (const info of procedures) {
      const label = getProcLabel(info.proccode);
      if (!label.startsWith('gpu_')) continue;
      const safe = this._isBodySafeForCompute(info.bodyHead, info.blocks, procedures);
      if (safe.supported) {
        kernels.push({
          type: 'compute',
          proccode: info.proccode,
          paramNames: info.paramNames,
          blockId: info.blockId,
          target: info.target,
          status: 'ready',
          reason: `GPU-prefixed custom block: ${info.proccode}`
        });
      } else {
        kernels.push({
          type: 'compute',
          proccode: info.proccode,
          paramNames: info.paramNames,
          blockId: info.blockId,
          target: info.target,
          status: 'unsupported',
          reason: `GPU-prefixed but contains unsupported opcodes: ${safe.reason}`
        });
      }
    }
    return kernels;
  }

  _isBodySafeForCompute (headId, blocks, allProcedures, visiting = new Set()) {
    const unsupported = [];
    const safe = new Set([
      'data_variable', 'data_setvariableto', 'data_changevariableby',
      'data_itemoflist', 'data_lengthoflist', 'data_listcontainsitem',
      'data_replaceitemoflist', 'data_addtolist', 'data_insertatlist',
      'data_deleteoflist', 'data_deletealloflist',
      'control_if', 'control_if_else', 'control_repeat', 'control_repeat_until',
      'control_while', 'control_for_each', 'control_forever', 'control_stop',
      'procedures_call', 'procedures_return', 'procedures_definition',
      'argument_reporter_string_number', 'argument_reporter_boolean',
      'math_number', 'math_positive_number', 'math_whole_number', 'math_integer',
      'math_angle', 'text',
      'operator_add', 'operator_subtract', 'operator_multiply', 'operator_divide',
      'operator_mod', 'operator_round', 'operator_mathop', 'operator_random',
      'operator_lt', 'operator_gt', 'operator_equals', 'operator_and', 'operator_or',
      'operator_not', 'sensing_timer'
    ]);
    this._walkAll(headId, blocks, (b) => {
      const op = b.opcode;
      if (op === 'procedures_call' && b.mutation && b.mutation.proccode) {
        const callee = b.mutation.proccode;
        if (visiting.has(callee)) return;
        const calleeInfo = allProcedures.find(p => p.proccode === callee);
        if (!calleeInfo) return;
        visiting.add(callee);
        const calleeSafe = this._isBodySafeForCompute(calleeInfo.bodyHead, calleeInfo.blocks, allProcedures, visiting);
        visiting.delete(callee);
        if (!calleeSafe.supported) {
          unsupported.push(`call to ${callee}: ${calleeSafe.reason}`);
        }
        return;
      }
      if (!safe.has(op)) {
        unsupported.push(op);
      }
    });
    if (unsupported.length) {
      return { supported: false, reason: [...new Set(unsupported)].slice(0, 5).join(', ') };
    }
    return { supported: true, reason: '' };
  }

  _findLoopCandidates (procedures) {
    const candidates = [];
    for (const info of procedures) {
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        if (!b.opcode.startsWith('control_repeat') && b.opcode !== 'control_forever' && b.opcode !== 'control_for_each') return;
        const bodyId = inputChild(b.inputs && b.inputs.SUBSTACK);
        if (!bodyId) return;
        const safe = this._isBodySafeForCompute(bodyId, info.blocks, procedures);
        if (safe.supported) {
          candidates.push({
            location: `${info.proccode}`,
            opcode: b.opcode,
            reason: 'Body uses only arithmetic/list ops; could be unrolled/parallelized on GPU'
          });
        }
      });
    }
    return candidates;
  }

  _findPenCandidates (procedures) {
    const candidates = [];
    for (const info of procedures) {
      let hasPen = false;
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        if (b.opcode && b.opcode.startsWith('pen_')) hasPen = true;
      });
      if (hasPen) {
        candidates.push({
          proccode: info.proccode,
          reason: 'Contains pen blocks; line/point rasterization could be GPUized'
        });
      }
    }
    return candidates;
  }

  _synthesizePixelFromRender (procedures) {
    const existingProccodes = new Set(procedures.map(p => p.proccode));
    if (existingProccodes.has('pixel %s %s')) return null;

    for (const info of procedures) {
      let pattern = this._findRenderPattern(info.bodyHead, info.blocks);
      if (!pattern) {
        pattern = this._findBufferPattern(info.bodyHead, info.blocks);
      }
      if (!pattern) continue;

      const { helperProccode, colorExprId } = pattern;
      try {
        const blocks = this._buildPixelBlocks(helperProccode, colorExprId, info.blocks);
        Object.assign(info.blocks._blocks, blocks);
        return {
          helperProccode,
          renderProccode: info.proccode,
          reason: pattern.reason || `Synthesized pixel(x,y) from render routine calling ${helperProccode}`
        };
      } catch (e) {
        this.warnings.push(`Failed to synthesize pixel from ${info.proccode}: ${e && e.message}`);
      }
    }
    return null;
  }

  _findRenderPattern (headId, blocks) {
    let helperProccode = null;
    let colorExprId = null;
    let hasDown = false;
    let hasUp = false;

    // Look for an inner loop body that calls a 2-arg helper with motion x/y,
    // then sets pen color and does penDown/penUp.
    this._walkAll(headId, blocks, (b) => {
      if (b.opcode !== 'control_repeat' && b.opcode !== 'control_forever') return;
      const outerBodyId = inputChild(b.inputs && b.inputs.SUBSTACK);
      if (!outerBodyId) return;
      this._walkAll(outerBodyId, blocks, (innerB) => {
        if (innerB.opcode !== 'control_repeat' && innerB.opcode !== 'control_forever') return;
        const innerBodyId = inputChild(innerB.inputs && innerB.inputs.SUBSTACK);
        if (!innerBodyId) return;

        let localHelper = null;
        let localColor = null;
        let localDown = false;
        let localUp = false;

        this._walkAll(innerBodyId, blocks, (stmt) => {
          if (stmt.opcode === 'procedures_call' && stmt.mutation && stmt.mutation.proccode) {
            const args = this._callArgs(stmt, blocks);
            if (args.length === 2 &&
                this._isMotionPosition(args[0], 'x') &&
                this._isMotionPosition(args[1], 'y')) {
              localHelper = stmt.mutation.proccode;
            }
          }
          if (stmt.opcode === 'pen_setPenColorToColor') {
            localColor = inputChild(stmt.inputs && stmt.inputs.COLOR);
          }
          if (stmt.opcode === 'pen_penDown') localDown = true;
          if (stmt.opcode === 'pen_penUp') localUp = true;
        });

        if (localHelper && localColor && localDown && localUp) {
          helperProccode = localHelper;
          colorExprId = localColor;
          hasDown = true;
          hasUp = true;
        }
      });
    });

    if (!helperProccode || !colorExprId) return null;
    return { helperProccode, colorExprId };
  }

  _findBufferPattern (headId, blocks) {
    // Detect patterns like BIGBOX [3D]3:
    //   for y:
    //     for x:
    //       call helper(x, y)
    //       replace item N of buff with packed-color
    //   ...later...
    //   for y:
    //     for x:
    //       set pen color to item N of buff
    //       penDown / penUp
    // When found, fuse the helper + packed-color into a single pixel(x,y).
    const fills = [];
    const draws = [];

    for (const { innerBodyId } of this._findDoubleLoops(headId, blocks)) {
      const stmts = this._iterStatements(innerBodyId, blocks);

      let helperProccode = null;
      let helperArgVars = [];
      let colorExprId = null;
      let listName = null;

      let drawList = null;
      let hasDown = false;
      let hasUp = false;

      for (const stmtId of stmts) {
        const b = blocks._blocks[stmtId];
        if (!b) continue;

        if (b.opcode === 'procedures_call' && b.mutation && b.mutation.proccode) {
          const args = this._callArgs(b, blocks);
          if (args.length === 2 && args.every(a => a && a.opcode === 'data_variable')) {
            helperProccode = b.mutation.proccode;
            helperArgVars = args.map(a => getField(a, 'VARIABLE'));
          }
        }

        if (b.opcode === 'data_replaceitemoflist') {
          listName = getField(b, 'LIST');
          colorExprId = inputChild(b.inputs && b.inputs.ITEM);
        }

        if (b.opcode === 'pen_setPenColorToColor') {
          const colorId = inputChild(b.inputs && b.inputs.COLOR);
          const colorBlock = colorId ? blocks._blocks[colorId] : null;
          if (colorBlock && colorBlock.opcode === 'data_itemoflist') {
            drawList = getField(colorBlock, 'LIST');
          }
        }
        if (b.opcode === 'pen_penDown') hasDown = true;
        if (b.opcode === 'pen_penUp') hasUp = true;
      }

      if (helperProccode && colorExprId && listName) {
        fills.push({ helperProccode, colorExprId, listName, helperArgVars });
      }
      if (drawList && hasDown && hasUp) {
        draws.push(drawList);
      }
    }

    for (const f of fills) {
      if (draws.includes(f.listName)) {
        return {
          helperProccode: f.helperProccode,
          colorExprId: f.colorExprId,
          reason: `Synthesized pixel(x,y) from buffer fill/draw loops using ${f.helperProccode}`
        };
      }
    }
    return null;
  }

  _findDoubleLoops (headId, blocks) {
    const found = [];
    this._walkAll(headId, blocks, (b) => {
      if (b.opcode !== 'control_repeat' && b.opcode !== 'control_forever') return;
      const outerBodyId = inputChild(b.inputs && b.inputs.SUBSTACK);
      if (!outerBodyId) return;
      this._walkAll(outerBodyId, blocks, (innerB) => {
        if (innerB.opcode !== 'control_repeat' && innerB.opcode !== 'control_forever') return;
        const innerBodyId = inputChild(innerB.inputs && innerB.inputs.SUBSTACK);
        if (!innerBodyId) return;
        found.push({ outerLoopId: b, innerLoopId: innerB, innerBodyId });
      });
    });
    return found;
  }

  _iterStatements (headId, blocks) {
    const ids = [];
    let id = headId;
    while (id) {
      const b = blocks._blocks[id];
      if (!b) break;
      ids.push(id);
      id = b.next || null;
    }
    return ids;
  }

  _callArgs (callBlock, blocks) {
    const args = [];
    const argIds = [];
    try { argIds.push(...JSON.parse(callBlock.mutation.argumentids || '[]')); } catch (e) {}
    for (const id of argIds) {
      const child = inputChild(callBlock.inputs && callBlock.inputs[id]);
      args.push(child ? blocks._blocks[child] : null);
    }
    return args;
  }

  _isMotionPosition (block, axis) {
    if (!block) return false;
    return block.opcode === (axis === 'x' ? 'motion_xposition' : 'motion_yposition');
  }

  _buildPixelBlocks (helperProccode, colorExprId, blocks) {
    const newBlocks = {};

    // call helper(x, y)
    const helperProto = this._findProcedurePrototype(helperProccode, blocks);
    let argIds = [];
    try { argIds = JSON.parse(helperProto?.mutation?.argumentids || '[]'); } catch (e) { argIds = []; }
    const callInputs = {};
    for (let i = 0; i < argIds.length; i++) {
      const argName = i === 0 ? 'x' : (i === 1 ? 'y' : `arg${i}`);
      const argId = this._newId('sc_gpu_arg_');
      newBlocks[argId] = {
        opcode: 'argument_reporter_string_number',
        fields: { VALUE: { value: argName, name: 'VALUE' } },
        inputs: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: false
      };
      callInputs[argIds[i]] = { block: argId };
    }

    const callId = this._newId('sc_gpu_call_');
    newBlocks[callId] = {
      opcode: 'procedures_call',
      fields: {},
      inputs: callInputs,
      mutation: {
        proccode: helperProccode,
        argumentids: helperProto?.mutation?.argumentids || '[]',
        argumentnames: helperProto?.mutation?.argumentnames || '[]'
      },
      next: null,
      parent: null,
      shadow: false,
      topLevel: false
    };

    // set color to cloned color expression
    const newColorExprId = this._cloneExprForPixel(colorExprId, blocks, newBlocks);
    const setColorId = this._newId('sc_gpu_setcolor_');
    newBlocks[setColorId] = {
      opcode: 'data_setvariableto',
      fields: {
        VARIABLE: { value: 'color', name: 'VARIABLE' }
      },
      inputs: {
        VALUE: { block: newColorExprId }
      },
      next: null,
      parent: null,
      shadow: false,
      topLevel: false
    };

    // pixel(x, y) prototype & definition
    const protoId = this._newId('sc_gpu_proto_');
    newBlocks[protoId] = {
      opcode: 'procedures_prototype',
      fields: {},
      inputs: {},
      mutation: {
        proccode: 'pixel %s %s',
        argumentnames: '["x","y"]',
        argumentids: '["x","y"]',
        argumentdefaults: '["",""]',
        warp: 'false'
      },
      next: null,
      parent: null,
      shadow: true,
      topLevel: false
    };

    const defId = this._newId('sc_gpu_def_');
    newBlocks[defId] = {
      opcode: 'procedures_definition',
      fields: {},
      inputs: {
        custom_block: { block: protoId, shadow: true }
      },
      mutation: {},
      next: callId,
      parent: null,
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };

    // chain call -> set color
    newBlocks[callId].next = setColorId;

    return newBlocks;
  }

  _findProcedurePrototype (proccode, blocks) {
    for (const id in blocks._blocks) {
      const b = blocks._blocks[id];
      if (b.opcode === 'procedures_definition') {
        const proto = blocks._blocks[b.inputs?.custom_block?.block];
        if (proto && proto.mutation && proto.mutation.proccode === proccode) {
          return proto;
        }
      }
    }
    return null;
  }

  _cloneExprForPixel (blockId, blocks, newBlocks) {
    if (!blockId) return null;
    const b = blocks._blocks[blockId];
    if (!b) return null;

    if (b.opcode === 'motion_xposition') {
      const id = this._newId('sc_gpu_arg_');
      newBlocks[id] = {
        opcode: 'argument_reporter_string_number',
        fields: { VALUE: { value: 'x', name: 'VALUE' } },
        inputs: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: false
      };
      return id;
    }
    if (b.opcode === 'motion_yposition') {
      const id = this._newId('sc_gpu_arg_');
      newBlocks[id] = {
        opcode: 'argument_reporter_string_number',
        fields: { VALUE: { value: 'y', name: 'VALUE' } },
        inputs: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: false
      };
      return id;
    }

    const newId = this._newId('sc_gpu_expr_');
    const newInputs = {};
    for (const key in b.inputs) {
      const inp = b.inputs[key];
      const child = inputChild(inp);
      const clonedChild = child ? this._cloneExprForPixel(child, blocks, newBlocks) : null;
      const shadow = inp.shadow && inp.shadow !== child ? this._cloneExprForPixel(inp.shadow, blocks, newBlocks) : clonedChild;
      newInputs[key] = {
        name: inp.name || key,
        block: clonedChild,
        shadow
      };
    }

    const newFields = {};
    for (const key in b.fields) {
      newFields[key] = { ...b.fields[key] };
    }

    newBlocks[newId] = {
      opcode: b.opcode,
      fields: newFields,
      inputs: newInputs,
      mutation: b.mutation ? { ...b.mutation } : {},
      next: null,
      parent: null,
      shadow: !!b.shadow,
      topLevel: false
    };
    return newId;
  }

  _injectLoopKernels (procedures) {
    const injected = [];
    const existingProccodes = new Set(procedures.map(p => p.proccode));
    for (const info of procedures) {
      this._walkAll(info.bodyHead, info.blocks, (b) => {
        if (b.opcode !== 'control_for_each') return;
        const varName = getField(b, 'VARIABLE');
        const bodyId = inputChild(b.inputs && b.inputs.SUBSTACK);
        if (!varName || !bodyId) return;

        const bodyHead = info.blocks._blocks[bodyId];
        if (!bodyHead || bodyHead.opcode !== 'data_replaceitemoflist') return;
        if (bodyHead.next) return; // only single-statement bodies for now

        const indexId = inputChild(bodyHead.inputs && bodyHead.inputs.INDEX);
        if (!indexId) return;
        const indexBlock = info.blocks._blocks[indexId];
        if (!indexBlock || indexBlock.opcode !== 'data_variable' || getField(indexBlock, 'VARIABLE') !== varName) return;

        const listName = getField(bodyHead, 'LIST');
        const exprId = inputChild(bodyHead.inputs && bodyHead.inputs.ITEM);
        if (!listName || !exprId) return;

        const safe = this._isBodySafeForCompute(bodyId, info.blocks, procedures);
        if (!safe.supported) return;

        const proccode = `gpu_${listName}`;
        if (existingProccodes.has(proccode)) {
          this.warnings.push(`Cannot auto-GPUize loop for list "${listName}": a block named "${proccode}" already exists.`);
          return;
        }
        existingProccodes.add(proccode);

        try {
          const blocks = this._buildLoopKernelBlocks(proccode, exprId, info.blocks, varName);
          Object.assign(info.blocks._blocks, blocks);
          injected.push({ proccode, listName, source: info.proccode });
        } catch (e) {
          this.warnings.push(`Failed to auto-GPUize loop for list "${listName}": ${e && e.message}`);
        }
      });
    }
    return injected;
  }

  _sanitizeForProccode (name) {
    return String(name).trim().replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');
  }

  _buildLoopKernelBlocks (proccode, exprId, blocks, loopVarName) {
    const newBlocks = {};
    const newExprId = this._cloneExpr(exprId, blocks, newBlocks, loopVarName);

    const setColorId = this._newId('sc_gpu_setcolor_');
    newBlocks[setColorId] = {
      opcode: 'data_setvariableto',
      fields: {
        VARIABLE: { value: 'color', name: 'VARIABLE' }
      },
      inputs: {
        VALUE: { block: newExprId }
      },
      next: null,
      parent: null,
      shadow: false,
      topLevel: false
    };

    const protoId = this._newId('sc_gpu_proto_');
    newBlocks[protoId] = {
      opcode: 'procedures_prototype',
      fields: {},
      inputs: {},
      mutation: {
        proccode: `${proccode} %s`,
        argumentnames: '["i"]',
        argumentids: '["i"]',
        argumentdefaults: '[""]',
        warp: 'false'
      },
      next: null,
      parent: null,
      shadow: true,
      topLevel: false
    };

    const defId = this._newId('sc_gpu_def_');
    newBlocks[defId] = {
      opcode: 'procedures_definition',
      fields: {},
      inputs: {
        custom_block: { block: protoId, shadow: true }
      },
      mutation: {},
      next: setColorId,
      parent: null,
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };

    return newBlocks;
  }

  _cloneExpr (blockId, blocks, newBlocks, loopVarName) {
    if (!blockId) return null;
    const b = blocks._blocks[blockId];
    if (!b) return null;

    // Replace references to the loop variable with the kernel argument 'i'.
    if (b.opcode === 'data_variable' && getField(b, 'VARIABLE') === loopVarName) {
      const id = this._newId('sc_gpu_arg_');
      newBlocks[id] = {
        opcode: 'argument_reporter_string_number',
        fields: { VALUE: { value: 'i', name: 'VALUE' } },
        inputs: {},
        next: null,
        parent: null,
        shadow: false,
        topLevel: false
      };
      return id;
    }

    const newId = this._newId('sc_gpu_expr_');
    const newInputs = {};
    for (const key in b.inputs) {
      const inp = b.inputs[key];
      const child = inputChild(inp);
      const clonedChild = child ? this._cloneExpr(child, blocks, newBlocks, loopVarName) : null;
      const shadow = inp.shadow && inp.shadow !== child ? this._cloneExpr(inp.shadow, blocks, newBlocks, loopVarName) : clonedChild;
      newInputs[key] = {
        name: inp.name || key,
        block: clonedChild,
        shadow
      };
    }

    const newFields = {};
    for (const key in b.fields) {
      newFields[key] = { ...b.fields[key] };
    }

    newBlocks[newId] = {
      opcode: b.opcode,
      fields: newFields,
      inputs: newInputs,
      mutation: b.mutation ? { ...b.mutation } : {},
      next: null,
      parent: null,
      shadow: !!b.shadow,
      topLevel: false
    };
    return newId;
  }

  _newId (prefix) {
    return `${prefix}${this._injectIdCounter++}`;
  }
}

export default GpuKernelDetector;
