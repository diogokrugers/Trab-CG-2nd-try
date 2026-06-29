"use strict";

function setupSliders() {
  document.querySelectorAll('#menu input[type=range]').forEach(slider => {
    const number = document.querySelector('#' + slider.dataset.for);
    slider.addEventListener('input', () => {
      number.value = slider.value;
      number.dispatchEvent(new Event('input'));
    });
    number.addEventListener('input', () => {
      slider.value = number.value;
    });
  });
}

function setupUI() {
  setupSliders();

  document.querySelector('#hierarchy-select').addEventListener('change', e => {
    const id = parseInt(e.target.value);
    selectNode(allNodes.find(n => n.id === id) || null);
  });

  document.querySelector('#btn-delete').addEventListener('click', () => {
    if (!selectedNode) return;
    deleteNode(selectedNode);
  });

  document.querySelector('#parent-select').addEventListener('change', e => {
    if (!selectedNode) return;
    const val = e.target.value;
    const newParent = val === 'root' ? root : allNodes.find(n => n.id === parseInt(val));
    if (newParent && (newParent === selectedNode || newParent.isDescendantOf(selectedNode))) {
      alert('Não é possível tornar um objeto filho de si mesmo ou de um descendente dele.');
      refreshPropsUI();
      return;
    }
    selectedNode.setParent(newParent);
    refreshHierarchyUI();
  });

  const bindNumber = (id, targetArray, index) => {
    document.querySelector(id).addEventListener('input', e => {
      if (!selectedNode) return;
      targetArray(selectedNode)[index] = parseFloat(e.target.value) || 0;
    });
  };
  bindNumber('#t-x', n => n.translation, 0);
  bindNumber('#t-y', n => n.translation, 1);
  bindNumber('#t-z', n => n.translation, 2);
  bindNumber('#r-x', n => n.rotation, 0);
  bindNumber('#r-y', n => n.rotation, 1);
  bindNumber('#r-z', n => n.rotation, 2);
  bindNumber('#s-x', n => n.scale, 0);
  bindNumber('#s-y', n => n.scale, 1);
  bindNumber('#s-z', n => n.scale, 2);

  document.querySelector('#color-rgb').addEventListener('input', e => {
    if (!selectedNode) return;
    const c = hexToRgb(e.target.value);
    const u = selectedNode.drawInfo.uniforms.u_colorMult;
    u[0] = c[0]; u[1] = c[1]; u[2] = c[2];
  });
  document.querySelector('#color-a').addEventListener('input', e => {
    if (!selectedNode) return;
    selectedNode.drawInfo.uniforms.u_colorMult[3] = parseFloat(e.target.value);
  });

  document.querySelector('#anim-axis').addEventListener('change', e => {
    if (!selectedNode) return;
    selectedNode.animAxis = e.target.value;
  });
  document.querySelector('#anim-speed').addEventListener('input', e => {
    if (!selectedNode) return;
    selectedNode.animSpeed = parseFloat(e.target.value) || 0;
  });

  document.querySelector('#btn-save').addEventListener('click', saveScene);
  document.querySelector('#btn-load').addEventListener('click', () => {
    document.querySelector('#file-load').click();
  });
  document.querySelector('#file-load').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) loadScene(file);
  });

  refreshHierarchyUI();
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function rgbToHex(r, g, b) {
  const to255 = x => Math.round(Math.max(0, Math.min(1, x)) * 255);
  return '#' + [to255(r), to255(g), to255(b)]
      .map(x => x.toString(16).padStart(2, '0')).join('');
}

function selectNode(node) {
  selectedNode = node;
  refreshPropsUI();
  const sel = document.querySelector('#hierarchy-select');
  sel.value = node ? String(node.id) : '';
}

function deleteNode(node) {
  // filhos sobem pro pai do node removido
  for (const child of [...node.children]) {
    child.setParent(node.parent);
  }
  node.setParent(null);
  allNodes = allNodes.filter(n => n !== node);
  if (selectedNode === node) selectedNode = null;
  refreshHierarchyUI();
  refreshPropsUI();
}

function refreshHierarchyUI() {
  const sel = document.querySelector('#hierarchy-select');
  sel.innerHTML = '';
  for (const node of allNodes) {
    const opt = document.createElement('option');
    opt.value = node.id;
    const depth = parentDepth(node);
    opt.textContent = '—'.repeat(depth) + ' ' + node.name;
    sel.appendChild(opt);
  }
  sel.value = selectedNode ? String(selectedNode.id) : '';

  const parentSel = document.querySelector('#parent-select');
  parentSel.innerHTML = '<option value="root">(raiz da cena)</option>';
  for (const node of allNodes) {
    const opt = document.createElement('option');
    opt.value = node.id;
    opt.textContent = node.name;
    parentSel.appendChild(opt);
  }
}

function parentDepth(node) {
  let depth = 0;
  let n = node.parent;
  while (n && n !== root) { depth++; n = n.parent; }
  return depth;
}

function refreshPropsUI() {
  const has = !!selectedNode;
  document.querySelector('#props-fieldset').style.display = has ? '' : 'none';
  if (!has) {
    document.querySelector('#selected-name').textContent = '(nenhum)';
    return;
  }
  updatePropsFromNode(selectedNode);

  const parentSel = document.querySelector('#parent-select');
  parentSel.value = (selectedNode.parent === root || !selectedNode.parent)
      ? 'root' : String(selectedNode.parent.id);
}

function updatePropsFromNode(node) {
  document.querySelector('#selected-name').textContent = node.name;
  document.querySelector('#t-x').value = node.translation[0];
  document.querySelector('#t-y').value = node.translation[1];
  document.querySelector('#t-z').value = node.translation[2];
  document.querySelector('#r-x').value = round2(node.rotation[0]);
  document.querySelector('#r-y').value = round2(node.rotation[1]);
  document.querySelector('#r-z').value = round2(node.rotation[2]);
  document.querySelector('#s-x').value = node.scale[0];
  document.querySelector('#s-y').value = node.scale[1];
  document.querySelector('#s-z').value = node.scale[2];

  const u = node.drawInfo.uniforms.u_colorMult;
  document.querySelector('#color-rgb').value = rgbToHex(u[0], u[1], u[2]);
  document.querySelector('#color-a').value = u[3];

  document.querySelector('#anim-axis').value = node.animAxis;
  document.querySelector('#anim-speed').value = node.animSpeed;

  document.querySelectorAll('#menu input[type=range]').forEach(slider => {
    slider.value = document.querySelector('#' + slider.dataset.for).value;
  });
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function saveScene() {
  const data = {
    nodes: allNodes.map(node => ({
      id: node.id,
      name: node.name,
      parentId: (node.parent && node.parent !== root) ? node.parent.id : null,
      modelName: node.modelName,
      translation: node.translation,
      rotation: node.rotation,
      scale: node.scale,
      colorMult: node.drawInfo.uniforms.u_colorMult,
      animAxis: node.animAxis,
      animSpeed: node.animSpeed,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cena.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function loadScene(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  for (const node of [...allNodes]) {
    node.setParent(null);
  }
  allNodes = [];
  selectedNode = null;

  // cria todos os nodes primeiro, depois liga os pais, pra não depender de ordem no arquivo
  const idMap = {};
  for (const nd of data.nodes) {
    const model = await loadModel(nd.modelName);
    const node = new Node(nd.name);
    node.modelName = nd.modelName;
    node.drawInfo = { model, uniforms: { u_colorMult: nd.colorMult || [1, 1, 1, 1] } };
    node.translation = nd.translation || [0, 0, 0];
    node.rotation = nd.rotation || [0, 0, 0];
    node.scale = nd.scale || [1, 1, 1];
    node.animAxis = nd.animAxis || '';
    node.animSpeed = nd.animSpeed != null ? nd.animSpeed : 1;
    idMap[nd.id] = node;
    allNodes.push(node);
  }
  for (const nd of data.nodes) {
    const node = idMap[nd.id];
    const parent = nd.parentId != null ? idMap[nd.parentId] : root;
    node.setParent(parent || root);
  }

  refreshHierarchyUI();
  refreshPropsUI();
}
