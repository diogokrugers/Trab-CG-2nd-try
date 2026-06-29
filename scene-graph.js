"use strict";

// Node baseado no https://webgl2fundamentals.org/webgl/lessons/webgl-scene-graph.html
let nextNodeId = 1;

function Node(name) {
  this.id = nextNodeId++;
  this.name = name || ('node' + this.id);
  this.children = [];
  this.parent = null;

  this.translation = [0, 0, 0];
  this.rotation = [0, 0, 0]; // graus
  this.scale = [1, 1, 1];

  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();

  // se este node desenha um modelo, drawInfo é preenchido em renderer.js
  this.modelName = null;
  this.drawInfo = null; // { parts: [...], uniforms: {u_colorMult} }

  this.animAxis = '';   // '', 'x', 'y' ou 'z'
  this.animSpeed = 1;
}

Node.prototype.setParent = function(parent) {
  if (this.parent) {
    const ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) {
      this.parent.children.splice(ndx, 1);
    }
  }
  if (parent) {
    parent.children.push(this);
  }
  this.parent = parent;
};

// recalcula localMatrix a partir de translation/rotation/scale
Node.prototype.updateLocalMatrix = function() {
  const degToRad = Math.PI / 180;
  let m = m4.translation(this.translation[0], this.translation[1], this.translation[2]);
  m = m4.xRotate(m, this.rotation[0] * degToRad);
  m = m4.yRotate(m, this.rotation[1] * degToRad);
  m = m4.zRotate(m, this.rotation[2] * degToRad);
  m = m4.scale(m, this.scale[0], this.scale[1], this.scale[2]);
  this.localMatrix = m;
};

Node.prototype.updateWorldMatrix = function(parentWorldMatrix) {
  this.updateLocalMatrix();
  if (parentWorldMatrix) {
    m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
  } else {
    m4.copy(this.localMatrix, this.worldMatrix);
  }
  const worldMatrix = this.worldMatrix;
  this.children.forEach(child => child.updateWorldMatrix(worldMatrix));
};

// retorna true se `maybeAncestor` é este node ou algum ancestral dele
Node.prototype.isDescendantOf = function(maybeAncestor) {
  let n = this;
  while (n) {
    if (n === maybeAncestor) return true;
    n = n.parent;
  }
  return false;
};
