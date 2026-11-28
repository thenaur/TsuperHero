
export const STAGE_W = 1280;
export const STAGE_H = 720;
let scaleX = 1;
let scaleY = 1;

export function fitStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  scaleX = window.innerWidth / STAGE_W;
  scaleY = window.innerHeight / STAGE_H;
  stage.style.transform = `scale(${scaleX}, ${scaleY})`;
}

/** Element position in stage coordinates (unscaled). */
export function stageRect(el) {
  const s = document.getElementById('stage').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return {
    left: (r.left - s.left) / scaleX,
    top: (r.top - s.top) / scaleY,
    width: r.width / scaleX,
    height: r.height / scaleY,
  };
}
