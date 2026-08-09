/* Ambient gold-dot background: plain DOM elements animated by CSS
   @keyframes (see .ambient-dot / @keyframes ambientDrift* in style.css),
   not canvas/requestAnimationFrame - so the dots are visibly positioned
   and moving as soon as CSS loads, with no JS animation loop that can
   silently stop drawing (e.g. when a tab is backgrounded). */
function startAmbientBackground(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const drifts = ['ambientDriftA', 'ambientDriftB', 'ambientDriftC'];
  const count = 15 + Math.floor(Math.random() * 11); // 15-25 dots
  let html = '';
  for (let i = 0; i < count; i++) {
    const size = (2 + Math.random() * 4).toFixed(1); // 2-6px
    const opacity = (0.3 + Math.random() * 0.4).toFixed(2); // 0.3-0.7
    const left = (Math.random() * 100).toFixed(1);
    const top = (Math.random() * 100).toFixed(1);
    const duration = (15 + Math.random() * 15).toFixed(1); // 15-30s
    const delay = (-Math.random() * duration).toFixed(1); // negative: starts mid-cycle, not all in sync
    const drift = drifts[i % drifts.length];
    html += `<span class="ambient-dot" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;opacity:${opacity};animation-name:${drift};animation-duration:${duration}s;animation-delay:${delay}s;"></span>`;
  }
  container.innerHTML = html;
}
