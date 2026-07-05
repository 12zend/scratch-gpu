const manifest = {
  "enabledByDefault": true,
  "dynamicDisable": true,
  "name": "GPU Shader",
  "description": "Detects GPU-processable custom blocks (e.g. pixel(x,y) screen kernels, gpu_<list> compute kernels, pen render patterns) in the loaded project, compiles them to WebGL fragment shaders, and runs them on a separate overlay canvas above the stage. CPU-side execution of the replaced procedures is suppressed automatically.",
  "credits": [
    {
      "name": "scratch-gpu"
    }
  ],
  "userscripts": [
    {
      "url": "userscript.js"
    }
  ],
  "settings": [
    {
      "name": "Shader scale",
      "id": "shader_scale",
      "type": "select",
      "default": "1",
      "potentialValues": [
        {
          "name": "1x",
          "id": "1"
        },
        {
          "name": "0.5x",
          "id": "0.5"
        },
        {
          "name": "2x",
          "id": "2"
        }
      ]
    },
    {
      "name": "Shader on top",
      "id": "shader_on_top",
      "type": "boolean",
      "default": true
    }
  ],
  "tags": ["editor", "stage"],
  "info": [
    {
      "text": "Experimental GPU acceleration pipeline.",
      "id": "experimental"
    }
  ]
};
export default manifest;
