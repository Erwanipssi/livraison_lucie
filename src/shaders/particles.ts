/**
 * Particules lumineuses : trajectoires calculées dans le shader, taille et
 * transparence modulées par la distance au plan de mise au point
 * (profondeur de champ « bokeh » sans passe de post-traitement).
 */
export const sparkVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uSpread;
uniform float uIntensity;
uniform float uPixelRatio;
uniform float uSize;
uniform float uFocus;
uniform float uHeight;
uniform float uRadius;
uniform vec3 uCenter;
varying float vAlpha;
varying float vMix;
void main() {
  float speed = 0.12 + aSeed.y * 0.22;
  float t = uTime * speed + aSeed.x * 6.2831;
  float h = fract(aSeed.w + uTime * 0.025 * (0.4 + aSeed.y));
  float radius = mix(0.12, uRadius, pow(aSeed.z, 0.7)) * uSpread * (0.75 + 0.25 * sin(t * 0.7));
  vec3 p = uCenter + vec3(cos(t) * radius, h * uHeight * (0.35 + 0.65 * uSpread) + sin(t * 1.7) * 0.08, sin(t) * radius);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float blur = clamp(abs(depth - uFocus) * 0.45, 0.0, 1.6);
  gl_PointSize = uSize * (0.5 + aSeed.y) * (1.0 + blur * 2.4) * uPixelRatio / max(depth, 0.1);
  float fade = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.7, 1.0, h));
  float twinkle = 0.55 + 0.45 * sin(uTime * (2.0 + aSeed.z * 3.0) + aSeed.x * 40.0);
  vAlpha = uIntensity * fade * twinkle / (1.0 + blur * 2.6);
  vMix = aSeed.y;
}
`;

export const sparkFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
varying float vAlpha;
varying float vMix;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = pow(a, 1.6);
  float core = smoothstep(0.18, 0.0, d);
  vec3 col = mix(uColorA, uColorB, vMix) * (a + core * 1.5);
  gl_FragColor = vec4(col * vAlpha, 1.0);
}
`;

export const dustVertex = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uFocus;
uniform float uIntensity;
varying float vAlpha;
void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.11 + aSeed.x * 6.28) * 0.35;
  p.y += mod(uTime * 0.03 * (0.4 + aSeed.y), 3.2) - 1.0;
  p.z += cos(uTime * 0.09 + aSeed.z * 6.28) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float blur = clamp(abs(depth - uFocus) * 0.35, 0.0, 2.0);
  gl_PointSize = uSize * (0.4 + aSeed.w) * (1.0 + blur * 3.0) * uPixelRatio / max(depth, 0.1);
  vAlpha = uIntensity * (0.25 + 0.75 * aSeed.w) / (1.0 + blur * 2.2);
}
`;

export const dustFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = pow(smoothstep(0.5, 0.05, d), 1.4);
  gl_FragColor = vec4(uColor * a * vAlpha, 1.0);
}
`;

export const shaftVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const shaftFragment = /* glsl */ `
uniform float uIntensity;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  float fall = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.06, vUv.y);
  float edge = pow(abs(dot(normalize(vNormalV), normalize(vViewDir))), 1.5);
  float streak = 0.65 + 0.35 * sin(vUv.x * 50.0 + uTime * 0.6) * sin(vUv.x * 23.0 - uTime * 0.4);
  float a = fall * edge * streak * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}
`;
