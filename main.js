"use strict";

function main() {
  const canvas = document.querySelector('#glcanvas');
  if (!setupRenderer(canvas)) return;

  setupOrbitCamera(canvas);
  setupModelList();
  setupUI();

  requestAnimationFrame(drawScene);
}

main();
