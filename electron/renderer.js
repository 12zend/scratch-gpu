(function () {
  const dropZone = document.getElementById('drop');
  const loadBtn = document.getElementById('load-btn');
  const loading = document.getElementById('loading');
  const stage = document.getElementById('stage');
  const stageInner = document.getElementById('stage-inner');
  let scaffolding = null;
  let dragCounter = 0;

  function showLoading () {
    loading.classList.add('visible');
    stage.classList.remove('visible');
  }

  function showStage () {
    loading.classList.remove('visible');
    stage.classList.add('visible');
  }

  function showError (err) {
    console.error('[shader] Failed to load project:', err);
    loading.classList.remove('visible');
    stage.classList.remove('visible');
  }

  async function loadProjectData (arrayBuffer) {
    showLoading();
    try {
      if (scaffolding) {
        scaffolding.disableShader();
        stageInner.innerHTML = '';
      }
      scaffolding = new Scaffolding.Scaffolding();
      scaffolding.shaderOnTop = true;
      scaffolding.shaderScale = 1;
      scaffolding.setup();
      scaffolding.appendTo(stageInner);

      const storage = scaffolding.storage;
      storage.addWebStore(
        [storage.AssetType.ImageVector, storage.AssetType.ImageBitmap, storage.AssetType.Sound],
        (asset) => `https://assets.scratch.mit.edu/internalapi/asset/${asset.assetId}.${asset.dataFormat}/get/`
      );

      await scaffolding.loadProject(arrayBuffer);
      scaffolding.greenFlag();

      if (scaffolding.shaderEnabled) {
        console.log('[shader] GPU shader active. Diagnostics:', scaffolding.shaderDiagnostics);
      } else {
        console.log('[shader] No pixel block found or shader disabled. Running in normal Scratch mode.');
      }
      showStage();
    } catch (e) {
      showError(e);
    }
  }

  function handleFile (file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadProjectData(reader.result);
    reader.onerror = () => {
      console.error('[shader] File read error');
      showError(new Error('File read error'));
    };
    reader.readAsArrayBuffer(file);
  }

  async function openFile () {
    if (window.electronAPI && window.electronAPI.openFile) {
      const result = await window.electronAPI.openFile();
      if (result && result.data) {
        loadProjectData(result.data);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sb3,.sb2,.sb';
      input.onchange = () => {
        if (input.files && input.files[0]) handleFile(input.files[0]);
      };
      input.click();
    }
  }

  loadBtn.addEventListener('click', openFile);

  // Drop overlay is normally invisible and pointer-event-transparent. It only
  // shows a hint when the user is actively dragging a file into the window.
  // This way the rendered output stays fully visible at all times.
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    dragCounter++;
    dropZone.classList.add('over');
  });
  window.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) dropZone.classList.remove('over');
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    dropZone.classList.remove('over');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });
})();
