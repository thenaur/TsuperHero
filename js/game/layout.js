// Scales the fixed 1280x720 stage (pixel art 320x180 x4) to fit any screen.
export const STAGE_W = 1280;
export const STAGE_H = 720;
let scale = 1;

export function fitStage() {
  const stage = document.getElementById('stage');
  scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const x = (window.innerWidth - STAGE_W * scale) / 2;
  const y = (window.innerHeight - STAGE_H * scale) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

/** Element position in stage coordinates (unscaled). */
export function stageRect(el) {
  const s = document.getElementById('stage').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { left: (r.left - s.left) / scale, top: (r.top - s.top) / scale, width: r.width / scale, height: r.height / scale };
}
