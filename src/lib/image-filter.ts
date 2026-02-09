import type { PendingStyle } from '@/shared/types';

/** Start pending animation during inference */
export function startPending(img: HTMLImageElement, style: PendingStyle): void {
  if (style === 'hidden') {
    img.style.filter = 'brightness(0)';
    img.style.opacity = '0.05';
    img.animate(
      [{ opacity: 0.05 }, { opacity: 0.15 }],
      { duration: 800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    );
  } else {
    img.style.opacity = '0.15';
    img.animate(
      [{ opacity: 0.15 }, { opacity: 0.35 }],
      { duration: 800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
    );
  }
}

/** Stop pending animation and clean up */
function stopPending(img: HTMLImageElement): void {
  for (const anim of img.getAnimations()) {
    anim.cancel();
  }
  img.style.filter = '';
}

/** score を計算: clamp(Σ(probability × weight), 0, 1) */
export function calculateScore(
  probabilities: Record<string, number>,
  weights: Record<string, number>,
): number {
  let sum = 0;
  for (const [label, prob] of Object.entries(probabilities)) {
    const weight = weights[label] ?? 0;
    sum -= prob * weight;
  }

  return Math.max(0, Math.min(1, sum));
}

let stylesInjected = false;

/** Inject block overlay styles once into the document head */
export function injectBlockStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.textContent = `
.clf-block-wrapper {
  display: inline-block;
  position: relative;
  line-height: 0;
}
.clf-block-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-family: sans-serif;
  user-select: none;
}
`;
  document.head.appendChild(style);
}

/** Wrap the image in a block overlay and hide it; clicking reveals it */
function blockImage(img: HTMLImageElement): void {
  // Avoid double-wrapping if already blocked
  if (img.parentElement?.classList.contains('clf-block-wrapper')) return;

  img.style.opacity = '0';

  const wrapper = document.createElement('span');
  wrapper.className = 'clf-block-wrapper';

  const overlay = document.createElement('span');
  overlay.className = 'clf-block-overlay';
  overlay.textContent = 'クリックで表示';
  overlay.addEventListener('click', () => {
    overlay.remove();
    img.style.opacity = '1';
  }, { once: true });

  img.parentNode!.insertBefore(wrapper, img);
  wrapper.appendChild(img);
  wrapper.appendChild(overlay);
}

export function applyFilter(
  img: HTMLImageElement,
  score: number,
  blockThreshold: number,
  blockEnabled: boolean,
): void {
  stopPending(img);
  if (blockEnabled && score >= blockThreshold) {
    blockImage(img);
  } else {
    img.style.opacity = String(1 - score);
  }
}

export function showImage(img: HTMLImageElement): void {
  stopPending(img);
  img.style.opacity = '1';
}
