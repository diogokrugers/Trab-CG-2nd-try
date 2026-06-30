"use strict";

const MODEL_NAMES = [
  "bread", "burger", "cheese", "chicken", "chips", "chocolate", "coffee",
  "cookie", "cupcake", "donut", "drink", "egg", "french_fries", "fried_egg",
  "ham", "ice_cream", "jelly", "ketchup", "milkshake", "mustard",
  "nachos", "nugget", "onion_rings", "pizza", "pizza_slide", "popcorn",
  "pretzel", "ramen", "ribs", "sauce_ketchup", "sauce_mustard", "small_cheese",
  "soda", "soup", "spring_roll", "sushi", "taco", "toast", "waffle",
];

const modelCache = {};   // nome -> { parts: [{bufferInfo, vao, material}], extents }
const textureCache = {}; // filename -> Promise<WebGLTexture>

function loadTexture(filename, baseHref) {
  if (textureCache[filename]) {
    return textureCache[filename];
  }
  const href = new URL(filename, baseHref).href;
  const promise = new Promise(resolve => {
    twgl.createTexture(gl, { src: href, flipY: true }, (err, texture) => {
      resolve(texture);
    });
  });
  textureCache[filename] = promise;
  
  return promise;
}

async function loadModel(name) {
  if (modelCache[name]) {
    return modelCache[name];
  }

  const objHref = `models/${name}.obj`;
  const baseHref = new URL(objHref, window.location.href);

  const objText = await (await fetch(objHref)).text();
  const obj = parseOBJ(objText);

  const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
    const matHref = new URL(filename, baseHref).href;
    return await (await fetch(matHref)).text();
  }));
  const materials = parseMTL(matTexts.join('\n'));

  const defaultMaterial = { diffuse: [1, 1, 1], diffuseMap: null, opacity: 1 };
  for (const mat of Object.values(materials)) {
    if (mat.diffuseMap) {
      mat.diffuseMap = await loadTexture(mat.diffuseMap, baseHref);
    }
  }
  const whiteTexture = twgl.createTexture(gl, { src: [255, 255, 255, 255] });

  const parts = obj.geometries.map(({ material, data }) => {
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
    const matInfo = { ...defaultMaterial, ...materials[material] };
    return {
      bufferInfo,
      vao,
      diffuseMap: matInfo.diffuseMap || whiteTexture,
      opacity: matInfo.opacity,
    };
  });

  const extents = getGeometriesExtents(obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  const center = m4.addVectors(extents.min, m4.scaleVector(range, 0.5));
  const radius = m4.length(range) || 0.1;

  const model = { parts, center, radius };
  modelCache[name] = model;
  
  return model;
}

function getExtents(positions) {
  const min = positions.slice(0, 3);
  const max = positions.slice(0, 3);
  for (let i = 3; i < positions.length; i += 3) {
    for (let j = 0; j < 3; ++j) {
      const v = positions[i + j];
      min[j] = Math.min(v, min[j]);
      max[j] = Math.max(v, max[j]);
    }
  }
  return { min, max };
}

function getGeometriesExtents(geometries) {
  return geometries.reduce(({ min, max }, { data }) => {
    const minMax = getExtents(data.position);
    return {
      min: min.map((m, ndx) => Math.min(minMax.min[ndx], m)),
      max: max.map((m, ndx) => Math.max(minMax.max[ndx], m)),
    };
  }, {
    min: Array(3).fill(Number.POSITIVE_INFINITY),
    max: Array(3).fill(Number.NEGATIVE_INFINITY),
  });
}
