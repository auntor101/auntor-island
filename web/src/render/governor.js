// Pure: next pixel ratio from the moving-average frame time and how long it has stayed above/below thresholds.
export function nextPixelRatio(current, avgMs, msAbove, msBelow, ceiling) {
  if (avgMs > 20 && msAbove >= 2000) return Math.max(1, current - 0.25);
  if (avgMs < 12 && msBelow >= 5000) return Math.min(ceiling, current + 0.25);
  return current;
}
