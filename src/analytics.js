// Anonymous event counter (see worker/index.js). Production only, honours Do Not Track, never throws, sends nothing but the event name.
const OK = ['visit', 'play', 'death', 'fly', 'drive', 'eat', 'festival'];
export function track(e) {
  try {
    if (!import.meta.env?.PROD || navigator.doNotTrack === '1' || !OK.includes(e)) return;
    navigator.sendBeacon('/api/event', new Blob([JSON.stringify({ e })], { type: 'application/json' }));
  } catch { /* analytics must never break the game */ }
}
