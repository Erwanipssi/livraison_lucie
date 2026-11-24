export const backdropVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // collé au plan lointain
}
`;

export const backdropFragment = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uGlow;
uniform vec3 uGlowDir;
uniform float uGlowStrength;
uniform float uTime;
varying vec3 vDir;

float rand(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uTop, smoothstep(0.02, 0.55, y));
  col = mix(col, uBottom, smoothstep(0.0, -0.35, y));
  float g = max(dot(d, normalize(uGlowDir)), 0.0);
  col += uGlow * (pow(g, 5.0) * 0.6 + pow(g, 24.0) * 0.5) * uGlowStrength;
  // grain fin anti-banding
  col += (rand(gl_FragCoord.xy + fract(uTime)) - 0.5) * (1.6 / 255.0);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
