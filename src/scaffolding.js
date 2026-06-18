import Packages from './packages.js';
import VideoProvider from './video-provider.js';
import {CloudManager} from './cloud-variables.js';
import ControlBar from './control-bar.js';
import {ListMonitor, VariableMonitor} from './monitor.js';
import Question from './question.js';
import defaultMessages from './messages.json';
import ScratchShaderCompiler from './shader-compiler.js';
import ShaderRenderer from './shader-renderer.js';

/**
 * @param {MouseEvent|TouchEvent} event
 * @returns {{x: number; y: number;}}
 */
const getEventXY = (event) => {
  if (event.touches && event.touches[0]) {
    return {x: event.touches[0].clientX, y: event.touches[0].clientY};
  } else if (event.changedTouches && event.changedTouches[0]) {
    return {x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY};
  }
  return {x: event.clientX, y: event.clientY};
};

/**
 * @template T
 * @param {T | () => T} value 
 * @returns {() => T}
 */
const wrapAsFunctionIfNotFunction = (value) => {
  if (typeof value === 'function') {
    return value;
  }
  return () => value;
};

/**
 * @param {unknown} value
 * @returns {value is (number|string|boolean)}
 */
const isValidVariableValue = (value) => (
  typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean'
);

/**
 * @param {unknown} value
 * @returns {value is Array<number|string|boolean>}
 */
const isValidListValue = (value) => {
  if (!Array.isArray(value)) return false;
  // Array.prototype.every does not work here because we want to reject arrays with holes eg. new Array(1)
  for (let i = 0; i < value.length; i++) {
    if (!isValidVariableValue(value[i])) return false;
  }
  return true;
};

class Scaffolding extends EventTarget {
  constructor () {
    super();

    this.width = 480;
    this.height = 360;
    this.resizeMode = 'preserve-ratio';
    this.editableLists = false;
    this.shouldConnectPeripherals = true;
    this.usePackagedRuntime = false;

    this.messages = defaultMessages;

    this.shaderScale = 1;
    this.shaderOnTop = true;
    this.shaderEnabled = false;
    this.shaderDiagnostics = null;

    this._monitors = new Map();
    this._mousedownPosition = null;
    this._draggingId = null;
    this._draggingStartMousePosition = null;
    this._draggingStartSpritePosition = null;

    this._offsetFromTop = 0;
    this._offsetFromBottom = 0;
    this._offsetFromLeft = 0;
    this._offsetFromRight = 0;

    this._root = document.createElement('div');
    this._root.className = 'sc-root';

    this._layers = document.createElement('div');
    this._layers.className = 'sc-layers';
    this._root.appendChild(this._layers);

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'sc-canvas';
    this._addLayer(this._canvas);

    this._shaderCanvas = document.createElement('canvas');
    this._shaderCanvas.className = 'sc-shader-canvas';
    this._shaderCanvas.style.display = 'none';

    this._shaderStatusOverlay = document.createElement('div');
    this._shaderStatusOverlay.className = 'sc-shader-status';
    this._shaderStatusOverlay.style.display = 'none';
    this._shaderStatusHeader = document.createElement('div');
    this._shaderStatusHeader.className = 'sc-shader-status-header';
    this._shaderStatusBody = document.createElement('div');
    this._shaderStatusBody.className = 'sc-shader-status-body';
    this._shaderStatusOverlay.appendChild(this._shaderStatusHeader);
    this._shaderStatusOverlay.appendChild(this._shaderStatusBody);
    this._shaderStatusHeader.addEventListener('click', () => {
      this._shaderStatusOverlay.classList.toggle('sc-shader-status-expanded');
    });

    this._overlays = document.createElement('div');
    this._overlays.className = 'sc-scaled-overlays-inner';

    this._overlaysOuter = document.createElement('div');
    this._overlaysOuter.className = 'sc-scaled-overlays-outer';

    this._overlaysOuter.appendChild(this._overlays);
    this._addLayer(this._overlaysOuter);

    this._monitorOverlay = document.createElement('div');
    this._monitorOverlay.className = 'sc-monitor-overlay';
    this._overlays.appendChild(this._monitorOverlay);

    this._topControls = new ControlBar();
    this._layers.appendChild(this._topControls.root);
  }

  _addLayer (el) {
    this._layers.appendChild(el);
  }

  _placeShaderCanvas () {
    if (!this._shaderCanvas || !this._overlaysOuter) return;
    if (this._shaderCanvas.parentNode) {
      this._shaderCanvas.parentNode.removeChild(this._shaderCanvas);
    }
    if (this._shaderStatusOverlay && this._shaderStatusOverlay.parentNode) {
      this._shaderStatusOverlay.parentNode.removeChild(this._shaderStatusOverlay);
    }
    if (this.shaderOnTop) {
      this._layers.insertBefore(this._shaderCanvas, this._overlaysOuter);
      this._layers.insertBefore(this._shaderStatusOverlay, this._overlaysOuter);
    } else {
      this._layers.insertBefore(this._shaderCanvas, this._canvas);
      this._layers.insertBefore(this._shaderStatusOverlay, this._canvas);
    }
  }

  _updateShaderStatus () {
    const overlay = this._shaderStatusOverlay;
    const header = this._shaderStatusHeader;
    const body = this._shaderStatusBody;
    if (!overlay || !header || !body) return;
    const enabled = !!this.shaderEnabled;
    const diag = this.shaderDiagnostics || { found: false, warnings: [], errors: [] };
    const warnings = (diag.warnings || []).length;
    const errors = (diag.errors || []).length;
    const glErrors = (this._shaderRenderer && this._shaderRenderer.getGlErrors) ? this._shaderRenderer.getGlErrors() : [];

    const stateLabel = enabled ? 'GPU shader: ON' : 'GPU shader: OFF';
    overlay.classList.toggle('sc-shader-status-ok', enabled && errors === 0 && glErrors.length === 0);
    overlay.classList.toggle('sc-shader-status-warn', !enabled || errors > 0 || glErrors.length > 0);
    header.textContent = `${stateLabel} • ${errors} err / ${warnings} warn / ${glErrors.length} GL`;

    if (enabled && errors === 0 && warnings === 0 && glErrors.length === 0) {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';

    const lines = [];
    if (!diag.found) {
      lines.push('No "pixel" custom block found in this project.');
    }
    if (errors) {
      lines.push('Errors:');
      for (const e of diag.errors) lines.push('  • ' + e);
    }
    if (warnings) {
      lines.push('Warnings:');
      const shown = diag.warnings.slice(0, 10);
      for (const w of shown) lines.push('  • ' + w);
      if (diag.warnings.length > shown.length) {
        lines.push(`  …and ${diag.warnings.length - shown.length} more`);
      }
    }
    if (glErrors.length) {
      lines.push('GL errors:');
      for (const e of glErrors.slice(-8)) {
        lines.push(`  • 0x${(e.code || 0).toString(16)} at ${e.where} (×${e.count})`);
      }
    }
    body.textContent = lines.join('\n');
  }

  _readShaderVariable (name) {
    const targets = this.vm && this.vm.runtime && this.vm.runtime.targets || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (v.name === name && v.type !== 'list') {
          const val = v.value;
          if (typeof val === 'number') return val;
          if (typeof val === 'boolean') return val ? 1 : 0;
          const n = parseFloat(val);
          return isFinite(n) ? n : 0;
        }
      }
    }
    return 0;
  }

  _tryEnableShader () {
    if (!this._shaderRenderer) return;
    this._shaderRenderer.stop();
    if (this._shaderRenderer.clearGlErrors) this._shaderRenderer.clearGlErrors();
    const compiler = new ScratchShaderCompiler(this.vm.runtime);
    let result;
    try {
      result = compiler.compile();
    } catch (e) {
      console.error('[scaffolding-shader] Compiler crashed:', e);
      this.shaderDiagnostics = { found: false, warnings: [], errors: [String(e && e.message || e)] };
      this._shaderCanvas.style.display = 'none';
      this.shaderEnabled = false;
      this._updateShaderStatus();
      return;
    }
    this.shaderDiagnostics = {
      found: result.found,
      warnings: result.warnings,
      errors: result.errors
    };
    if (result.warnings.length) {
      console.warn('[scaffolding-shader] Warnings:\n  ' + result.warnings.join('\n  '));
    }
    if (!result.found || result.errors.length) {
      this._shaderCanvas.style.display = 'none';
      this.shaderEnabled = false;
      if (result.errors.length) {
        console.error('[scaffolding-shader] Errors:\n  ' + result.errors.join('\n  '));
      }
      this._updateShaderStatus();
      return;
    }
    const ok = this._shaderRenderer.setProgram(result, (name) => this._readShaderVariable(name));
    if (!ok) {
      this._shaderCanvas.style.display = 'none';
      this.shaderEnabled = false;
      this.shaderDiagnostics.errors = (this.shaderDiagnostics.errors || []).concat(['WebGL program failed to compile (see console for the GLSL log).']);
      this._updateShaderStatus();
      return;
    }
    this._shaderRenderer.setListReader((name) => this._readShaderList(name));
    this._shaderRenderer.uploadListData();
    this._shaderRenderer.resize(this.width * this.shaderScale, this.height * this.shaderScale);
    this._shaderCanvas.style.display = 'block';
    this._shaderRenderer.resetTime();
    this._shaderRenderer.start();
    this.shaderEnabled = true;
    this._updateShaderStatus();
  }

  _readShaderList (name) {
    const targets = this.vm && this.vm.runtime && this.vm.runtime.targets || [];
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (v.name === name && v.type === 'list') {
          const arr = v.value;
          if (!Array.isArray(arr)) return null;
          const out = new Float32Array(arr.length);
          for (let i = 0; i < arr.length; i++) {
            const item = arr[i];
            if (typeof item === 'number') out[i] = item;
            else if (typeof item === 'boolean') out[i] = item ? 1 : 0;
            else { const n = parseFloat(item); out[i] = isFinite(n) ? n : 0; }
          }
          return out;
        }
      }
    }
    return null;
  }

  refreshShaderLists () {
    if (this._shaderRenderer && this.shaderEnabled) {
      this._shaderRenderer.uploadListData();
    }
  }

  disableShader () {
    if (this._shaderRenderer) this._shaderRenderer.stop();
    if (this._shaderCanvas) this._shaderCanvas.style.display = 'none';
    this.shaderEnabled = false;
    this._updateShaderStatus();
  }

  recompileShader () {
    if (this.vm && this.vm.runtime) this._tryEnableShader();
  }

  _startShaderErrorPolling () {
    if (this._shaderErrorPolling) return;
    this._shaderErrorPolling = setInterval(() => {
      if (this._shaderRenderer) this._updateShaderStatus();
    }, 500);
  }

  _scratchCoordinates (x, y) {
    return {
      x: (this.width / this.layersRect.width) * (x - (this.layersRect.width / 2)),
      y: -(this.height / this.layersRect.height) * (y - (this.layersRect.height / 2))
    };
  }

  _onmousemove (e) {
    const {x, y} = getEventXY(e);
    const data = {
      x: x - this.layersRect.left,
      y: y - this.layersRect.top,
      canvasWidth: this.layersRect.width,
      canvasHeight: this.layersRect.height
    };
    if (this._mousedownPosition && !this._draggingId) {
      const distance = Math.sqrt(
        Math.pow(data.x - this._mousedownPosition.x, 2) +
        Math.pow(data.y - this._mousedownPosition.y, 2)
      );
      if (distance > 3) {
        this._startDragging(data.x, data.y);
        this._cancelDragTimeout();
      }
    } else if (this._draggingId) {
      const position = this._scratchCoordinates(data.x, data.y);
      this.vm.postSpriteInfo({
        x: position.x - this._draggingStartMousePosition.x + this._draggingStartSpritePosition.x,
        y: position.y - this._draggingStartMousePosition.y + this._draggingStartSpritePosition.y,
        force: true
      });
    }
    this.vm.postIOData('mouse', data);
  }

  _startDragging (x, y) {
    if (this._draggingId) return;
    const drawableId = this.renderer.pick(x, y);
    if (drawableId === -1 || drawableId === false) return;
    const targetId = this.vm.getTargetIdForDrawableId(drawableId);
    if (targetId === null) return;
    const target = this.vm.runtime.getTargetById(targetId);
    if (!target.draggable) return;
    target.goToFront();
    this._draggingId = targetId;
    this._draggingStartMousePosition = this._scratchCoordinates(x, y);
    this._draggingStartSpritePosition = {
      x: target.x,
      y: target.y
    };
    this.vm.startDrag(targetId);
  }

  _cancelDragTimeout () {
    clearTimeout(this._dragTimeout);
    this._dragTimeout = null;
  }

  _onmousedown (e) {
    const {x, y} = getEventXY(e);
    const data = {
      x: x - this.layersRect.left,
      y: y - this.layersRect.top,
      button: e.button,
      canvasWidth: this.layersRect.width,
      canvasHeight: this.layersRect.height,
      isDown: true
    };
    const isTouchEvent = typeof TouchEvent !== 'undefined' && e instanceof TouchEvent;
    if (e.button === 0 || isTouchEvent) {
      this._dragTimeout = setTimeout(this._startDragging.bind(this, data.x, data.y), 400);
    }
    if (isTouchEvent) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    }
    this._mousedownPosition = {
      x: data.x,
      y: data.y
    };
    this.vm.postIOData('mouse', data);
  }

  _onmouseup (e) {
    this._cancelDragTimeout();
    const {x, y} = getEventXY(e);
    const data = {
      x: x - this.layersRect.left,
      y: y - this.layersRect.top,
      button: e.button,
      canvasWidth: this.layersRect.width,
      canvasHeight: this.layersRect.height,
      isDown: false,
      wasDragged: this._draggingId !== null
    };
    this._mousedownPosition = null;
    this.vm.postIOData('mouse', data);
    if (this._draggingId) {
      this.vm.stopDrag(this._draggingId);
      this._draggingStartMousePosition = null;
      this._draggingStartSpritePosition = null;
      this._draggingId = null;
    }
  }

  _ontouchstart (e) {
    this._onmousedown(e);
  }

  _ontouchmove (e) {
    this._onmousemove(e);
  }

  _ontouchend (e) {
    this._onmouseup(e);
  }

  _oncontextmenu (e) {
    e.preventDefault();
  }

  _onwheel (e) {
    const data = {
      deltaX: e.deltaX,
      deltaY: e.deltaY
    };
    this.vm.postIOData('mouseWheel', data);
  }

  _onkeydown (e) {
    if (e.target !== document && e.target !== document.body) {
      return;
    }
    const data = {
      key: e.key,
      keyCode: e.keyCode,
      isDown: true
    };
    this.vm.postIOData('keyboard', data);
    if (e.keyCode === 32 || (e.keyCode >= 37 && e.keyCode <= 40) || e.keyCode === 8 || e.keyCode === 222 || e.keyCode === 191) {
      e.preventDefault();
    }
  }

  _onkeyup (e) {
    const data = {
      key: e.key,
      keyCode: e.keyCode,
      isDown: false
    };
    this.vm.postIOData('keyboard', data);
    if (e.target !== document && e.target !== document.body) {
      e.preventDefault();
    }
  }

  _onresize () {
    this.relayout();
  }

  relayout () {
    let totalWidth = Math.max(1, this._root.offsetWidth);
    let totalHeight = Math.max(1, this._root.offsetHeight);
    // The browser may not have laid out _root yet on the first call (offsetWidth
    // is 0/1). Fall back to the project size so the stage is not collapsed to
    // a 1px dot. The real layout pass will run on the next frame.
    if (totalWidth < 32 || totalHeight < 32) {
      totalWidth = this.width;
      totalHeight = this.height;
    }

    const offsetFromTop = this._offsetFromTop + this._topControls.computeHeight();
    const offsetFromBottom = this._offsetFromBottom;
    const offsetFromLeft = this._offsetFromLeft;
    const offsetFromRight = this._offsetFromRight;

    const projectAreaWidth = Math.max(1, totalWidth - offsetFromLeft - offsetFromRight);
    const projectAreaHeight = Math.max(1, totalHeight - offsetFromTop - offsetFromBottom);

    if (this.resizeMode === 'dynamic-resize') {
      // setStageSize is a TurboWarp-specific method
      if (this.vm.setStageSize) {
        this.width = projectAreaWidth;
        this.height = projectAreaHeight;
        this.vm.setStageSize(this.width, this.height);
      } else {
        console.warn('dynamic-resize not supported: vm does not implement setStageSize');
      }
    }

    let width = projectAreaWidth;
    let height = projectAreaHeight;
    if (this.resizeMode !== 'stretch') {
      width = height / this.height * this.width;
      if (width > projectAreaWidth) {
        height = projectAreaWidth / this.width * this.height;
        width = projectAreaWidth;
      }
    }

    const distanceFromTop = totalHeight - height;
    const distanceFromLeft = totalWidth - width;
    const translateY = (distanceFromLeft - offsetFromLeft - offsetFromRight) / 2 + offsetFromLeft - (distanceFromLeft / 2);
    const translateX = (distanceFromTop - offsetFromTop - offsetFromBottom) / 2 + offsetFromTop - (distanceFromTop / 2);

    this._layers.style.transform = `translate(${translateY}px, ${translateX}px)`;
    this._layers.style.width = `${width}px`;
    this._layers.style.height = `${height}px`;
    this._overlays.style.transform = `scale(${width / this.width}, ${height / this.height})`;
    this.renderer.resize(width, height);

    if (this._shaderRenderer) {
      this._shaderRenderer.resize(this.width * this.shaderScale, this.height * this.shaderScale);
    }

    this.layersRect = this._layers.getBoundingClientRect();
  }

  appendTo (element) {
    element.appendChild(this._root);
    // The browser may not have laid out the page yet at this point, so
    // _root.offsetWidth can be 0/1 even though the parent element has a real
    // size. Use the parent's actual size to set _root explicitly so the first
    // relayout() computes a correct stage size.
    const parentRect = element.getBoundingClientRect();
    if (parentRect.width > 0 && parentRect.height > 0) {
      this._root.style.width = parentRect.width + 'px';
      this._root.style.height = parentRect.height + 'px';
    }
    void this._root.offsetWidth;
    this.relayout();
    // Re-run on the next frame in case the project load fires STAGE_SIZE_CHANGED
    // before the initial rAF and resets the size back to the collapsed value.
    requestAnimationFrame(() => this.relayout());
  }

  setup () {
    this.vm = new Packages.VM();
    this.vm.setCompatibilityMode(true);
    this.vm.setLocale(navigator.language);
    this.vm.on('MONITORS_UPDATE', this._onmonitorsupdate.bind(this));
    this.vm.runtime.on('QUESTION', this._onquestion.bind(this));
    this.vm.on('PROJECT_RUN_START', () => this.dispatchEvent(new Event('PROJECT_RUN_START')));
    this.vm.on('PROJECT_RUN_STOP', () => this.dispatchEvent(new Event('PROJECT_RUN_STOP')));

    this._placeShaderCanvas();
    try {
      this._shaderRenderer = new ShaderRenderer(this._shaderCanvas);
      this._startShaderErrorPolling();
    } catch (e) {
      console.warn('Shader renderer disabled:', e.message);
      this._shaderRenderer = null;
    }

    // TurboWarp-specific VM extensions
    if (this.usePackagedRuntime && this.vm.convertToPackagedRuntime) {
      this.vm.convertToPackagedRuntime();
    }
    if (this.vm.setStageSize) {
      this.vm.setStageSize(this.width, this.height);
    }
    if (this.vm.runtime.cloudOptions) {
      this.vm.runtime.cloudOptions.limit = Infinity;
    }
    // TODO: remove when https://github.com/TurboWarp/packager/issues/213 is fixed
    this.vm.on('STAGE_SIZE_CHANGED', (width, height) => {
      if (this.width !== width || this.height !== height) {
        this.width = width;
        this.height = height;
        this.relayout();
      }
    });

    this.cloudManager = new CloudManager(this);

    this.renderer = new Packages.Renderer(
      this._canvas,
      -this.width / 2,
      this.width / 2,
      -this.height / 2,
      this.height / 2
    );
    this.vm.attachRenderer(this.renderer);
    // TurboWarp-specific renderer extensions
    if (this.renderer.overlayContainer) {
      this._layers.insertBefore(this.renderer.overlayContainer, this._overlaysOuter);
    }

    this.storage = new Packages.Storage();
    this.vm.attachStorage(this.storage);

    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      this.audioEngine = new Packages.AudioEngine();
      this.vm.attachAudioEngine(this.audioEngine);
    } else {
      console.warn('AudioContext not supported. Sound will not work.');
    }

    this.bitmapAdapter = new Packages.SVGRenderer.BitmapAdapter();
    this.vm.attachV2BitmapAdapter(this.bitmapAdapter);

    this.videoProvider = new VideoProvider();
    this.vm.setVideoProvider(this.videoProvider);

    document.addEventListener('mousemove', this._onmousemove.bind(this));
    this._canvas.addEventListener('mousedown', this._onmousedown.bind(this));
    document.addEventListener('mouseup', this._onmouseup.bind(this));
    this._canvas.addEventListener('touchstart', this._ontouchstart.bind(this));
    document.addEventListener('touchmove', this._ontouchmove.bind(this));
    document.addEventListener('touchend', this._ontouchend.bind(this));
    this._canvas.addEventListener('contextmenu', this._oncontextmenu.bind(this));
    this._canvas.addEventListener('wheel', this._onwheel.bind(this));
    document.addEventListener('keydown', this._onkeydown.bind(this));
    document.addEventListener('keyup', this._onkeyup.bind(this));
    window.addEventListener('resize', this._onresize.bind(this));
  }

  async _connectPeripherals () {
    const scanExtension = (extensionId) => new Promise((resolve) => {
      const onListUpdate = (peripherals) => {
        const peripheralArray = Object.keys(peripherals).map((id) => peripherals[id]);
        if (peripheralArray.length > 0) {
          const peripheral = peripheralArray[0];
          console.log('Connecting to peripheral', peripheral);
          this.vm.connectPeripheral(extensionId, peripheral.peripheralId);
        } else {
          console.error('No peripherals found for', extensionId);
        }
        done();
      };

      const onScanTimeout = () => {
        console.error('Peripheral scan timed out for', extensionId);
        done();
      };

      const done = () => {
        this.vm.removeListener('PERIPHERAL_LIST_UPDATE', onListUpdate);
        this.vm.removeListener('PERIPHERAL_SCAN_TIMEOUT', onScanTimeout);
        resolve();
      };

      this.vm.on('PERIPHERAL_LIST_UPDATE', onListUpdate);
      this.vm.on('PERIPHERAL_SCAN_TIMEOUT', onScanTimeout);
      this.vm.scanForPeripheral(extensionId);
    });

    for (const extensionId of Object.keys(this.vm.runtime.peripheralExtensions)) {
      await scanExtension(extensionId);
    }
  }

  _onmonitorsupdate (monitors) {
    for (const monitorData of monitors.valueSeq()) {
      const id = monitorData.get('id');
      if (!this._monitors.has(id)) {
        const visible = monitorData.get('visible');
        if (!visible) {
          // Would be a waste to make it now
          continue;
        }
        // TODO: add to DOM in same order as appears in list
        const mode = monitorData.get('mode');
        if (mode === 'list') {
          this._monitors.set(id, new ListMonitor(this, monitorData));
        } else {
          this._monitors.set(id, new VariableMonitor(this, monitorData));
        }
      }
      const monitorObject = this._monitors.get(id);
      monitorObject.update(monitorData);
    }
  }

  ask (text) {
    this._question = new Question(this, text);
    return this._question.answer();
  }

  _onquestion (question) {
    if (this._question) {
      this._question.destroy()
    }
    if (question !== null) {
      this.ask(question)
        .then((answer) => {
          this.vm.runtime.emit('ANSWER', answer);
        });
    }
  }

  loadProject (data) {
    return this.vm.loadProject(data)
      .then(() => {
        this.vm.setCloudProvider(this.cloudManager);
        this.cloudManager.projectReady();
        this.renderer.draw();
        // Render again after a short delay because some costumes are loaded async
        setTimeout(() => {
          this.renderer.draw();
        });

        this._tryEnableShader();

        if (this.shouldConnectPeripherals) {
          this._connectPeripherals();
        }
      });
  }

  setUsername (username) {
    this._username = username;
    this.vm.postIOData('userData', {
      username
    });
  }

  addCloudProvider (provider) {
    this.cloudManager.addProvider(provider);
  }

  addCloudProviderOverride (name, provider) {
    this.cloudManager.addProviderOverride(name, provider);
  }

  addControlButton({element, where}) {
    if (where === 'top-left') {
      this._topControls.addToStart(element);
    } else if (where === 'top-right') {
      this._topControls.addToEnd(element);
    } else {
      throw new Error(`Unknown 'where': ${where}`);
    }
    this.relayout();
  }

  getMessage (id) {
    return this.messages[id] || id;
  }

  /**
   * Change primary accent color.
   * @param {string} color Color in the format #abcdef
   */
  setAccentColor (color) {
    this._root.style.setProperty('--sc-accent-color', color);
    this._root.style.setProperty('--sc-accent-color-transparent', `${color}59`);
  }

  start () {
    this.vm.start();
    this.vm.greenFlag();
    if (this._shaderRenderer) {
      this._shaderRenderer.resetTime();
      // CPU-side init scripts (e.g. BVH construction that fills lists via
      // "replace item of list") run asynchronously after green flag. The shader's
      // list textures were uploaded once at load time, before those scripts ran, so
      // they contain stale (empty) data. Re-upload periodically until the lists stop
      // changing, so the pixel shader eventually sees the populated data.
      this._startShaderListRefresh();
    }
  }

  _startShaderListRefresh () {
    if (this._shaderListRefreshTimer) return;
    let lastSignature = null;
    let stableCount = 0;
    const tick = () => {
      const sig = this._computeListSignature();
      if (sig === lastSignature) {
        stableCount++;
      } else {
        stableCount = 0;
        lastSignature = sig;
      }
      this.refreshShaderLists();
      // Keep refreshing while the list data is still changing; once it has been
      // stable for a few ticks we can back off to a slow poll (lists may still be
      // mutated at runtime by some projects).
      const stable = stableCount >= 5;
      this._shaderListRefreshTimer = setTimeout(tick, stable ? 1000 : 250);
    };
    this._shaderListRefreshTimer = setTimeout(tick, 250);
  }

  _computeListSignature () {
    const targets = this.vm && this.vm.runtime && this.vm.runtime.targets || [];
    let sig = 0;
    for (const target of targets) {
      if (!target || !target.variables) continue;
      for (const id in target.variables) {
        const v = target.variables[id];
        if (!v || v.type !== 'list') continue;
        const arr = v.value;
        const len = Array.isArray(arr) ? arr.length : 0;
        // Mix length and a cheap hash of a few sampled elements.
        sig = (sig * 31 + len) | 0;
        if (Array.isArray(arr)) {
          for (let i = 0; i < arr.length; i += Math.max(1, Math.floor(arr.length / 16))) {
            const x = arr[i];
            const n = typeof x === 'number' ? x : parseFloat(x);
            sig = (sig * 31 + (isFinite(n) ? Math.floor(n * 1000) : 0)) | 0;
          }
        }
      }
    }
    return sig;
  }

  greenFlag () {
    this.start();
  }

  stopAll () {
    this.vm.stopAll();
  }

  _lookupVariable(name, type) {
    const variable = this.vm.runtime.getTargetForStage().lookupVariableByNameAndType(name, type);
    if (!variable) throw new Error(`Global ${type || 'variable'} does not exist: ${name}`);
    return variable;
  }

  setExtensionSecurityManager (newManager) {
    const securityManager = this.vm.extensionManager.securityManager;
    if (!securityManager) {
      console.warn('setExtensionSecurityManager not supported: there is no security manager');
      return;
    }
    for (const [methodName, fn] of Object.entries(newManager)) {
      securityManager[methodName] = wrapAsFunctionIfNotFunction(fn);
    }
  }

  getVariable (name) {
    return this._lookupVariable(name, '').value;
  }

  setVariable(name, value) {
    if (!isValidVariableValue(value)) {
      throw new Error('Invalid variable value');
    }
    this._lookupVariable(name, '').value = value;
  }

  getList(name) {
    return this._lookupVariable(name, 'list').value;
  }

  setList(name, value) {
    if (!isValidListValue(value)) {
      throw new Error('Invalid list value');
    }
    this._lookupVariable(name, 'list').value = value;
  }
}

export default Scaffolding;
