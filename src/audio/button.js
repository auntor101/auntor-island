// Speaker / mute button in the paper style. The first tap also unlocks audio (iOS needs a gesture).
const ICON = (muted) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#2a1f3d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="#ff7a59"/>${muted ? '<path d="M16 9.5l5 5M21 9.5l-5 5"/>' : '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'}</svg>`;

export function createAudioButton(host, audio) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', 'Sound');
  b.style.cssText = 'width:44px;height:44px;min-width:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;border:2px solid #2a1f3d;border-radius:14px;background:#fff7ea;box-shadow:0 3px 0 #2a1f3d;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;pointer-events:auto';
  const paint = () => { const m = audio.isMuted(); b.setAttribute('aria-pressed', String(!m)); b.title = m ? 'Sound off' : 'Sound on'; b.innerHTML = ICON(m); };
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const was = audio.isUnlocked();
    audio.unlock();
    if (was || audio.isMuted()) audio.setMuted(!audio.isMuted()); // first tap only unlocks, unless sound was saved as off
    paint();
  });
  paint();
  host.appendChild(b);
  return { el: b, dispose: () => b.remove() };
}
