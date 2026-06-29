"use strict";

const meshVS = `#version 300 es
in vec4 a_position;
in vec3 a_normal;
in vec2 a_texcoord;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;

out vec3 v_normal;
out vec2 v_texcoord;

void main() {
  gl_Position = u_projection * u_view * u_world * a_position;
  v_normal = mat3(u_world) * a_normal;
  v_texcoord = a_texcoord;
}
`;

const meshFS = `#version 300 es
precision highp float;

in vec3 v_normal;
in vec2 v_texcoord;

uniform sampler2D diffuseMap;
uniform vec4 u_colorMult;
uniform vec3 u_lightDirection;

out vec4 outColor;

void main() {
  vec3 normal = normalize(v_normal);
  float light = dot(normal, u_lightDirection) * 0.5 + 0.5;
  vec4 texColor = texture(diffuseMap, v_texcoord);
  outColor = vec4(texColor.rgb * light * u_colorMult.rgb, texColor.a * u_colorMult.a);
}
`;

// shader de picking: desenha cada objeto com uma cor sólida = seu id
const pickingVS = `#version 300 es
in vec4 a_position;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
void main() {
  gl_Position = u_projection * u_view * u_world * a_position;
}
`;

const pickingFS = `#version 300 es
precision highp float;
uniform vec4 u_id;
out vec4 outColor;
void main() {
  outColor = u_id;
}
`;
