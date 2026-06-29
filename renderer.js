"use strict";

let gl, meshProgramInfo, pickingProgramInfo;
let root;            // Node raiz invisível da cena
let allNodes = [];   // todos os nodes (exceto root), na ordem de criação
let selectedNode = null;

const cameraTarget = [0, 0, 0];
let cameraDistance = 2;
let cameraAngleX = -0.4; // pitch
let cameraAngleY = 0.5;  // yaw

function setupRenderer(canvas) {
  gl = canvas.getContext('webgl2');
  if (!gl) {
    alert('WebGL2 não disponível neste navegador.');
    return false;
  }

  twgl.setAttributePrefix('a_');
  const options = {
    attribLocations: { a_position: 0, a_normal: 1, a_texcoord: 2 },
  };
  meshProgramInfo = twgl.createProgramInfo(gl, [meshVS, meshFS], options);
  pickingProgramInfo = twgl.createProgramInfo(gl, [pickingVS, pickingFS], options);

  root = new Node('root');
  return true;
}

// thumbnails da lista de modelos (coluna da direita), desenhadas num
// framebuffer offscreen e copiadas pro canvas 2d de cada item
const THUMB_SIZE = 96;
let thumbFramebuffer, thumbTexture, thumbDepthBuffer;

function setupThumbFramebuffer() {
  thumbTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, thumbTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, THUMB_SIZE, THUMB_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  thumbDepthBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, thumbDepthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, THUMB_SIZE, THUMB_SIZE);

  thumbFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, thumbFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, thumbTexture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, thumbDepthBuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function setupModelList() {
  if (!thumbFramebuffer) setupThumbFramebuffer();

  const container = document.querySelector('#model-list');
  for (const name of MODEL_NAMES) {
    const item = document.createElement('div');
    item.className = 'model-item';

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = THUMB_SIZE;
    thumbCanvas.height = THUMB_SIZE;
    item.appendChild(thumbCanvas);

    const label = document.createElement('span');
    label.textContent = name;
    item.appendChild(label);

    container.appendChild(item);

    item.addEventListener('click', () => addInstanceToScene(name));

    renderThumbnail(thumbCanvas, name);
  }
}

async function renderThumbnail(canvas2d, name) {
  const model = await loadModel(name);

  gl.bindFramebuffer(gl.FRAMEBUFFER, thumbFramebuffer);
  gl.viewport(0, 0, THUMB_SIZE, THUMB_SIZE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0.92, 0.92, 0.92, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const projection = m4.perspective(Math.PI / 4, 1, 0.01, 100);
  const camDist = (model.radius || 0.1) * 1.6;
  const camera = m4.lookAt(
      [camDist, camDist * 0.7, camDist],
      model.center,
      [0, 1, 0]);
  const view = m4.inverse(camera);
  const world = m4.translation(-model.center[0], -model.center[1], -model.center[2]);

  gl.useProgram(meshProgramInfo.program);
  twgl.setUniforms(meshProgramInfo, {
    u_projection: projection,
    u_view: view,
    u_world: world,
    u_lightDirection: m4.normalize([1, 1, 1]),
    u_colorMult: [1, 1, 1, 1],
  });
  for (const part of model.parts) {
    gl.bindVertexArray(part.vao);
    twgl.setUniforms(meshProgramInfo, { diffuseMap: part.diffuseMap });
    twgl.drawBufferInfo(gl, part.bufferInfo);
  }

  const pixels = new Uint8Array(THUMB_SIZE * THUMB_SIZE * 4);
  gl.readPixels(0, 0, THUMB_SIZE, THUMB_SIZE, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const ctx2d = canvas2d.getContext('2d');
  const imageData = ctx2d.createImageData(THUMB_SIZE, THUMB_SIZE);
  // framebuffer fica de baixo pra cima; inverte ao copiar
  const rowBytes = THUMB_SIZE * 4;
  for (let y = 0; y < THUMB_SIZE; ++y) {
    const srcStart = (THUMB_SIZE - 1 - y) * rowBytes;
    imageData.data.set(pixels.subarray(srcStart, srcStart + rowBytes), y * rowBytes);
  }
  ctx2d.putImageData(imageData, 0, 0);
}

async function addInstanceToScene(name) {
  const model = await loadModel(name);
  const node = new Node(name + '_' + (allNodes.length + 1));
  node.modelName = name;
  node.drawInfo = { model, uniforms: { u_colorMult: [1, 1, 1, 1] } };
  node.translation = [0, 0, 0];
  node.setParent(root);
  allNodes.push(node);

  refreshHierarchyUI();
  selectNode(node);
}

// ---- câmera orbital + picking ----
let mouseX = -1, mouseY = -1;
let isDragging = false;
let dragButton = -1;
let lastDragX = 0, lastDragY = 0;
let dragStartX = 0, dragStartY = 0;

function setupOrbitCamera(canvas) {
  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    dragButton = e.button;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;

    if (isDragging && dragButton === 0) {
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      cameraAngleY += dx * 0.01;
      cameraAngleX += dy * 0.01;
      cameraAngleX = Math.max(-1.5, Math.min(1.5, cameraAngleX));
      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    cameraDistance *= e.deltaY > 0 ? 1.1 : 0.9;
    cameraDistance = Math.max(0.2, Math.min(50, cameraDistance));
  }, { passive: false });

  canvas.addEventListener('click', e => {
    const movedDist = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
    if (movedDist > 3) return; // foi drag pra orbitar, não clique de seleção
    pickAtMouse();
  });
}

function pickAtMouse() {
  if (!lastPickFramebuffer) return;
  gl.bindFramebuffer(gl.FRAMEBUFFER, lastPickFramebuffer);
  const pixelX = mouseX * gl.canvas.width / gl.canvas.clientWidth;
  const pixelY = gl.canvas.height - mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;
  const data = new Uint8Array(4);
  gl.readPixels(pixelX, pixelY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
  if (id > 0) {
    const node = allNodes[id - 1];
    if (node) selectNode(node);
  } else {
    selectNode(null);
  }
}

let pickTexture, pickDepthBuffer, lastPickFramebuffer;

function setupPickingFramebuffer() {
  pickTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, pickTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  pickDepthBuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, pickDepthBuffer);

  lastPickFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, lastPickFramebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickTexture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, pickDepthBuffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function resizePickingFramebuffer(width, height) {
  gl.bindTexture(gl.TEXTURE_2D, pickTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, pickDepthBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
}

function idToColor(id) {
  return [
    ((id >> 0) & 0xFF) / 0xFF,
    ((id >> 8) & 0xFF) / 0xFF,
    ((id >> 16) & 0xFF) / 0xFF,
    ((id >> 24) & 0xFF) / 0xFF,
  ];
}

// ---- render loop ----
let lastTime = 0;

function drawScene(time) {
  time *= 0.001;
  const dt = time - lastTime;
  lastTime = time;

  if (!lastPickFramebuffer) {
    setupPickingFramebuffer();
  }

  const resized = twgl.resizeCanvasToDisplaySize(gl.canvas);
  if (resized) {
    resizePickingFramebuffer(gl.canvas.width, gl.canvas.height);
  }

  for (const node of allNodes) {
    if (node.animAxis) {
      const axisIndex = { x: 0, y: 1, z: 2 }[node.animAxis];
      node.rotation[axisIndex] += node.animSpeed * dt * (180 / Math.PI);
      if (node === selectedNode) updatePropsFromNode(node);
    }
  }

  root.updateWorldMatrix();

  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const projection = m4.perspective(Math.PI / 4, aspect, 0.01, 100);

  const cx = cameraTarget[0] + cameraDistance * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
  const cy = cameraTarget[1] + cameraDistance * Math.sin(cameraAngleX);
  const cz = cameraTarget[2] + cameraDistance * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
  const camera = m4.lookAt([cx, cy, cz], cameraTarget, [0, 1, 0]);
  const view = m4.inverse(camera);

  // passo 1: desenha ids num framebuffer pra picking
  gl.bindFramebuffer(gl.FRAMEBUFFER, lastPickFramebuffer);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(pickingProgramInfo.program);
  for (let i = 0; i < allNodes.length; ++i) {
    const node = allNodes[i];
    if (!node.drawInfo) continue;
    twgl.setUniforms(pickingProgramInfo, {
      u_projection: projection,
      u_view: view,
      u_world: node.worldMatrix,
      u_id: idToColor(i + 1), // pickId = índice em allNodes + 1 (0 = nada)
    });
    for (const part of node.drawInfo.model.parts) {
      gl.bindVertexArray(part.vao);
      twgl.drawBufferInfo(gl, part.bufferInfo);
    }
  }

  // passo 2: desenha a cena normal no canvas
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.85, 0.85, 0.85, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(meshProgramInfo.program);
  twgl.setUniforms(meshProgramInfo, {
    u_projection: projection,
    u_view: view,
    u_lightDirection: m4.normalize([0.5, 1, 0.7]),
  });
  for (const node of allNodes) {
    if (!node.drawInfo) continue;
    const isSelected = node === selectedNode;
    const baseColor = node.drawInfo.uniforms.u_colorMult;
    const colorMult = isSelected
        ? [baseColor[0] * 1.0, baseColor[1] * 0.6, baseColor[2] * 0.6, baseColor[3]]
        : baseColor;
    twgl.setUniforms(meshProgramInfo, {
      u_world: node.worldMatrix,
      u_colorMult: colorMult,
    });
    for (const part of node.drawInfo.model.parts) {
      gl.bindVertexArray(part.vao);
      twgl.setUniforms(meshProgramInfo, { diffuseMap: part.diffuseMap });
      twgl.drawBufferInfo(gl, part.bufferInfo);
    }
  }

  requestAnimationFrame(drawScene);
}
