import { WebGLRenderer, NoToneMapping, SRGBColorSpace, HalfFloatType } from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { nextPixelRatio, clampPixelRatio, smoothMs } from './governor.js';

export function createRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping; // tone mapping happens in the composer (ToneMappingEffect)
  renderer.info.autoReset = false;

  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType });
  let renderPass = null;
  let ceiling = Math.min(window.devicePixelRatio || 1, 2);
  let pixelRatio = ceiling;
  let avg = 16, above = 0, below = 0, calls = 0, triangles = 0;

  const setPixelRatio = (n) => { pixelRatio = clampPixelRatio(n, ceiling); resize(); };
  const resize = () => {
    renderer.setPixelRatio(pixelRatio);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resize);

  // dtMs is the RAW frame delta. calls/triangles count every post-processing pass, not just the scene.
  function render(scene, camera, dtMs = 16) {
    if (!renderPass) {
      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      composer.addPass(new EffectPass(camera, new BloomEffect({ luminanceThreshold: 0.85, intensity: 0.5, mipmapBlur: true }), new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), new SMAAEffect()));
      resize();
    }
    renderPass.scene = scene;
    renderPass.camera = camera;
    renderer.info.reset();
    composer.render();
    calls = renderer.info.render.calls;
    triangles = renderer.info.render.triangles;

    avg = smoothMs(avg, dtMs);
    above = avg > 20 ? above + dtMs : 0;
    below = avg < 12 ? below + dtMs : 0;
    const next = nextPixelRatio(pixelRatio, avg, above, below, ceiling);
    if (next !== pixelRatio) { above = below = 0; setPixelRatio(next); }
  }

  const stats = () => ({ calls, triangles, fps: Math.round(1000 / avg), pixelRatio });
  return { renderer, composer, render, setPixelRatio, resize, stats };
}

export function startLoop(update) {
  let id, last = performance.now();
  const tick = (now) => {
    id = requestAnimationFrame(tick);
    const raw = now - last;
    last = now;
    update(Math.min(raw / 1000, 0.05), now, raw);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
