// arteries.jsx — ASCII artery hero with cursor-reactive interactions
// Exposes: <ArteryHero /> on window
//
// Model: arteries are poly-bezier curves generated via a simple branching
// procedure. Each vessel samples a dense set of (x,y,t,radius,parent,tangent)
// points. At render, we rasterize vessels onto a character grid, keeping the
// nearest-vessel distance per cell. Cells within a vessel's radius are "vessel"
// cells; the rest are background.
//
// On each frame we update a displacement field (per cell) driven by the
// currently-selected interaction mode, and render characters accordingly.

const ASCII_CHARS_DEFAULT = "0";
const SWAP_CHAR_DEFAULT = "1";

// ---------- Artery tree generation ------------------------------------------
function hashRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function generateVessels({ seed = 7, density = "medium", w, h, aspectRatio = 1 }) {
  const rand = hashRand(seed);
  const vessels = [];
  const nodes = []; // branching points for paper-card hover anchors

  // aspectRatio = height/width. If the page is tall (aspectRatio > 1.5),
  // spawn multiple trunk "generations" stacked vertically so vessels cover
  // the whole column instead of bunching at the top.
  const cfg = {
    sparse:   { trunks: 2, depth: 3, branchP: 0.45, step: 0.08 },
    medium:   { trunks: 3, depth: 4, branchP: 0.55, step: 0.06 },
    dense:    { trunks: 4, depth: 5, branchP: 0.7,  step: 0.045 },
  }[density] || { trunks: 3, depth: 4, branchP: 0.55, step: 0.06 };

  // aspectRatio is computed by the caller; kept for future density tuning
  // but no longer used for band-stacking (caused visible seams).
  // eslint-disable-next-line no-unused-vars
  const _aspect = aspectRatio;

  const addVessel = (x0, y0, angle, length, radius, depth, parentId = -1, parentT = -1) => {
    const samples = [];
    // Sample density: each segment should be much smaller than the vessel's
    // radius so adjacent samples' disks overlap and we get a continuous tube
    // after rasterization. Normalize by document height — length is in
    // "normalized doc-height" units so cellSize-space gap ≈ length/segs * rows.
    // Use a small fixed step in normalized units, plenty for the grids we use.
    const segs = Math.max(80, Math.floor(length / 0.01));
    let x = x0, y = y0, a = angle;
    // meander amplitude — trunks (depth 0) should be smoother, branches wavier
    const wobble = depth === 0 ? 0.035 : depth === 1 ? 0.055 : 0.08;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      a += (rand() - 0.5) * wobble;
      const step = length / segs;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      const mx = 0.04;
      if (x < mx) a += 0.35;
      if (x > 1 - mx) a -= 0.35;
      samples.push({
        x, y,
        t,
        a,
        r: radius * (1 - 0.35 * t),
      });
    }
    const id = vessels.length;
    vessels.push({ id, samples, depth, isLeaf: true, parentId, parentT, children: [] });
    if (parentId >= 0) vessels[parentId].children.push({ vId: id, t: parentT });
    return { samples, id };
  };

  const branch = (parent, depth, maxDepth) => {
    if (depth >= maxDepth) return;
    const parentSamples = parent.samples;
    const N = parentSamples.length;
    // More branch attempts on trunks (depth 0-1) so we get rich intertwining
    const attempts = depth === 0 ? 5 + Math.floor(rand() * 4)
                   : depth === 1 ? 3 + Math.floor(rand() * 2)
                   : 2 + Math.floor(rand() * 2);
    let hadChild = false;
    for (let k = 0; k < attempts; k++) {
      if (rand() > cfg.branchP) continue;
      const idx = Math.floor(0.1 * N + rand() * 0.8 * N);
      const p = parentSamples[idx];
      const side = rand() > 0.5 ? 1 : -1;
      const a = p.a + side * (0.4 + rand() * 0.6);
      // Length scales with depth: early branches go far, late branches are short
      const baseLen = depth === 0 ? 0.32 : depth === 1 ? 0.22 : depth === 2 ? 0.14 : 0.08;
      const len = baseLen * (0.7 + rand() * 0.6);
      const r = Math.max(0.7, p.r * 0.72);
      const child = addVessel(p.x, p.y, a, len, r, depth + 1, parent.id, p.t);
      hadChild = true;
      branch(child, depth + 1, maxDepth);
    }
    if (hadChild) vessels[parent.id].isLeaf = false;
  };

  // For each generation, spawn trunks starting near its top, flowing down.
  // Handoff: later generations' trunks start where earlier ones left off,
  // so it looks like one continuous vessel network.
  // ---- Single-pass generation: long trunks + rich branching -------------
  // Instead of stacking bands (which creates visible seams), create N trunks
  // that each run from y=0 to y=1 with smooth lateral meander, then branch
  // aggressively along their length with branches that themselves sub-branch.
  const numTrunks = cfg.trunks + 1;
  for (let i = 0; i < numTrunks; i++) {
    const x0 = 0.12 + (i + 0.5) * (0.76 / numTrunks) + (rand() - 0.5) * 0.06;
    // Start slightly above the top so trunks enter the frame cleanly
    const y0 = -0.02;
    const angle = Math.PI / 2 + (rand() - 0.5) * 0.25;
    const length = 1.15 + rand() * 0.1; // full height + small over-run
    const r0 = 2.4 + rand() * 0.6;
    const trunk = addVessel(x0, y0, angle, length, r0, 0);
    branch(trunk, 1, cfg.depth);

    // Second-level longitudinal branches — secondary vessels that also span
    // a big vertical range, making the network feel woven rather than
    // spider-legs off a central spine.
    const N = trunk.samples.length;
    const secondaries = 1 + Math.floor(rand() * 2);
    for (let k = 0; k < secondaries; k++) {
      const startIdx = Math.floor(0.1 * N + rand() * 0.3 * N);
      const p = trunk.samples[startIdx];
      const side = rand() > 0.5 ? 1 : -1;
      const a = p.a + side * (0.35 + rand() * 0.25); // gentler divergence
      const len = 0.55 + rand() * 0.35; // goes deep
      const r = p.r * 0.78;
      const sec = addVessel(p.x, p.y, a, len, r, 1, trunk.id, p.t);
      branch(sec, 2, cfg.depth + 1);
    }
  }

  // Extract termini of LEAF vessels
  for (const v of vessels) {
    if (!v.isLeaf) continue;
    const term = v.samples[v.samples.length - 1];
    const mid = v.samples[Math.floor(v.samples.length * 0.6)];
    const p0 = v.samples[v.samples.length - 2] || term;
    const dx = term.x - p0.x, dy = term.y - p0.y;
    const ang = Math.atan2(dy, dx);
    nodes.push({
      x: term.x, y: term.y,
      midX: mid.x, midY: mid.y,
      vesselId: v.id,
      angle: ang,
      depth: v.depth,
    });
  }

  return { vessels, nodes };
}

// ---------- Rasterize to character grid -------------------------------------
function rasterize({ vessels, cols, rows, thickness }) {
  // Per-cell: { dist, vId, vx, vy, tx, ty } — nearest vessel info
  const N = cols * rows;
  const dist = new Float32Array(N).fill(Infinity);
  const vid = new Int32Array(N).fill(-1);
  const vx = new Float32Array(N); // vessel-local coord along tangent
  const nx = new Float32Array(N); // tangent x
  const ny = new Float32Array(N); // tangent y
  const tAlong = new Float32Array(N); // 0..1 position along vessel
  const rAt = new Float32Array(N); // radius at that point

  // aspect ratio correction: character cells are ~1:2 (w:h), so multiply y by 0.5
  const ASPECT = 0.5;

  for (const v of vessels) {
    const s = v.samples;
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      const pr = p.r * thickness;
      const cx = p.x * cols;
      const cy = p.y * rows;
      const rad = Math.max(2, pr + 3);
      const x0 = Math.max(0, Math.floor(cx - rad));
      const x1 = Math.min(cols - 1, Math.ceil(cx + rad));
      const y0 = Math.max(0, Math.floor(cy - rad * ASPECT * 2));
      const y1 = Math.min(rows - 1, Math.ceil(cy + rad * ASPECT * 2));
      const tax = Math.cos(p.a);
      const tay = Math.sin(p.a) * ASPECT;
      const tLen = Math.hypot(tax, tay) || 1;
      const tnx = tax / tLen, tny = tay / tLen;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const dy = (y - cy) / ASPECT;
          const d = Math.hypot(dx, dy);
          const idx = y * cols + x;
          if (d < dist[idx]) {
            dist[idx] = d;
            vid[idx] = v.id;
            nx[idx] = tnx;
            ny[idx] = tny;
            tAlong[idx] = p.t;
            rAt[idx] = pr;
          }
        }
      }
    }
  }

  return { dist, vid, nx, ny, tAlong, rAt };
}

// ---------- The component ---------------------------------------------------
function ArteryHero({
  density = "medium",
  seed = 7,
  thickness = 1,
  cellSize = 9, // approx cell width in px
  charSet = ASCII_CHARS_DEFAULT,
  swapChar = SWAP_CHAR_DEFAULT,
  radius = 9,
  mode = "swap",         // swap | bloom | deflect | pulse | flow
  autoFlow = true,       // baseline pulse animation regardless of mode
  showNodes = false,
  onNodeHover = () => {},
  onNodes = () => {},
  onPulseArrive = null,
  paperNodes = [],
  accent = "#7c2d12",
  ink = "#111111",
  bg = "#f5f2ea",
}) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const stateRef = React.useRef({
    cols: 0, rows: 0,
    grid: null, vessels: [], nodes: [],
    mouse: { x: -1e9, y: -1e9, active: false },
    pulses: [], // {vId, t, life, strength}
    time: 0,
    displacement: null, // per-cell deflect offset (tx, ty)
    bloom: null, // per-cell bloom intensity
  });

  // rebuild vessels when density/seed/size changes
  const rebuild = React.useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // cellSize defines approx width of a monospace char; height ~ 2x width
    const charW = cellSize;
    const charH = cellSize * 2;
    const cols = Math.max(20, Math.floor(rect.width / charW));
    const rows = Math.max(10, Math.floor(rect.height / charH));
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { vessels, nodes } = generateVessels({ seed, density, w: cols, h: rows, aspectRatio: rect.height / rect.width });
    const grid = rasterize({ vessels, cols, rows, thickness });
    stateRef.current.cols = cols;
    stateRef.current.rows = rows;
    stateRef.current.vessels = vessels;
    stateRef.current.nodes = nodes;
    stateRef.current.grid = grid;
    stateRef.current.displacement = new Float32Array(cols * rows * 2);
    stateRef.current.bloom = new Float32Array(cols * rows);
    // Fresh flow scheduling — trunkTimers rebuilds on first tick
    stateRef.current.trunkTimers = null;
    stateRef.current.globalHeartbeatT = -1.5;
    stateRef.current.charW = charW;
    stateRef.current.charH = charH;
    stateRef.current.pxW = rect.width;
    stateRef.current.pxH = rect.height;
  }, [density, seed, cellSize, thickness]);

  React.useEffect(() => {
    rebuild();
    // Rebuild again after layout settles — covers cases where the wrapper
    // grows after fonts/images load or body content finishes mounting.
    const t1 = setTimeout(rebuild, 100);
    const t2 = setTimeout(rebuild, 500);
    const t3 = setTimeout(rebuild, 1500);
    const onResize = () => rebuild();
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    const wrap = wrapRef.current;
    let ro;
    if (wrap && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => rebuild());
      ro.observe(wrap);
    }
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
      if (ro) ro.disconnect();
    };
  }, [rebuild]);

  // mouse tracking
  React.useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      stateRef.current.mouse = { x, y, active: true };
    };
    const onLeave = () => { stateRef.current.mouse.active = false; };
    const onClick = (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      injectPulse(stateRef.current, x, y);
    };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", onLeave);
    wrap.addEventListener("click", onClick);
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", onLeave);
      wrap.removeEventListener("click", onClick);
    };
  }, []);

  // Anchor paper cards to vessel TERMINI (leaf ends).
  // Pick termini with good spatial spread so cards don't collide.
  const [anchorTick, setAnchorTick] = React.useState(0);
  React.useEffect(() => { setAnchorTick(t => t + 1); }, [density, seed, thickness, cellSize]);
  const anchoredNodes = React.useMemo(() => {
    const st = stateRef.current;
    if (!st.nodes || !st.nodes.length) return [];
    // keep termini with enough margin for a card to fit — inner safe zone
    const candidates = st.nodes.filter(n =>
      n.x > 0.18 && n.x < 0.82 && n.y > 0.18 && n.y < 0.82
    );
    if (!candidates.length) return [];
    // Greedy: pick most-separated termini
    const picks = [];
    const remaining = [...candidates];
    // start from left-most to bias layout
    remaining.sort((a, b) => a.x - b.x);
    const first = remaining.shift();
    picks.push(first);
    while (picks.length < paperNodes.length && remaining.length) {
      let bestIdx = 0, bestDist = -1;
      for (let i = 0; i < remaining.length; i++) {
        const c = remaining[i];
        let minD = Infinity;
        for (const p of picks) {
          const d = Math.hypot(c.x - p.x, (c.y - p.y) * 2);
          if (d < minD) minD = d;
        }
        if (minD > bestDist) { bestDist = minD; bestIdx = i; }
      }
      picks.push(remaining.splice(bestIdx, 1)[0]);
    }
    return picks.slice(0, paperNodes.length).map((n, i) => ({ ...n, paper: paperNodes[i] }));
  }, [paperNodes, anchorTick]);

  React.useEffect(() => { onNodes(anchoredNodes); }, [anchoredNodes, onNodes]);

  // animation loop
  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const st = stateRef.current;
      st.time += dt;

      // --- Pulse propagation --------------------------------------------
      // Advance each pulse, remembering its prior t so we can detect children
      // whose branch-point lies in (prevT, t]. For each such child, spawn a
      // new pulse starting at t=0 on that vessel. A pulse dies when it leaves
      // the vessel (t >= 1) — simulating blood continuing only into children.
      const SPEED_DEPTH = [0.050, 0.094, 0.158, 0.216, 0.274]; // trunk → leaf (+20%)
      const LIFE_DEPTH  = [28,    17,    12,    9,     7];

      const newPulses = [];
      for (const p of st.pulses) {
        const prevT = p.t;
        p.t += dt * p.speed;
        p.life -= dt;
        // if this pulse is still active, check for children to spawn on
        const v = st.vessels[p.vId];
        if (!v) continue;
        for (const child of v.children) {
          if (child.t > prevT && child.t <= p.t) {
            const cv = st.vessels[child.vId];
            if (!cv) continue;
            const d = Math.min(cv.depth, SPEED_DEPTH.length - 1);
            newPulses.push({
              vId: cv.id, t: 0,
              life: LIFE_DEPTH[d], life0: LIFE_DEPTH[d],
              speed: SPEED_DEPTH[d] * (0.9 + Math.random() * 0.2),
              strength: Math.max(0.45, p.strength * 0.9),
              generation: (p.generation || 0) + 1,
            });
          }
        }
      }
      // pulses die when they exit the vessel or time out
      st.pulses = st.pulses.filter((p) => p.life > 0 && p.t < 1.02);
      // push newly-spawned child pulses
      for (const np of newPulses) st.pulses.push(np);

      // Heartbeat: every few seconds, inject fresh pulses at ALL trunk roots
      // (depth === 0 and parentId < 0) so blood flow cascades through the tree.
      // ---- Flow scheduling --------------------------------------------
      // Each trunk has its own timers:
      //   baseT: steady low-amplitude pulses every 2-4s with per-trunk phase
      //   heartbeatDelay: delay after the global beat, so trunks fire in a
      //                   spread rather than in sync
      // This gives "mixed" flow — constant baseline activity with a louder
      // wave every HEARTBEAT_PERIOD seconds.
      if (autoFlow && st.vessels.length) {
        if (!st.trunkTimers) {
          st.trunkTimers = new Map();
          for (const v of st.vessels) {
            if (v.depth === 0 && v.parentId < 0) {
              st.trunkTimers.set(v.id, {
                // baseline timer: less frequent, per-trunk random phase + period
                baseT: Math.random() * 11,
                basePeriod: 11 + Math.random() * 7,
                // shared heartbeat: fires within a short window after the
                // global heartbeat signal; per-trunk delay adds stagger
                heartbeatDelay: Math.random() * 0.9, // seconds
                heartbeatPending: -1,
              });
            }
          }
        }
        st.globalHeartbeatT = (st.globalHeartbeatT || -1.5) + dt;
        const HEARTBEAT_PERIOD = 17.0; // seconds between big beats
        // global heartbeat event → arm each trunk with a delayed pending fire
        if (st.globalHeartbeatT >= HEARTBEAT_PERIOD) {
          st.globalHeartbeatT = 0;
          for (const [, timer] of st.trunkTimers) {
            timer.heartbeatPending = timer.heartbeatDelay;
          }
        }
        // advance each trunk's baseline + pending heartbeat
        for (const v of st.vessels) {
          if (!(v.depth === 0 && v.parentId < 0)) continue;
          const timer = st.trunkTimers.get(v.id);
          if (!timer) continue;
          // baseline steady pulses
          timer.baseT += dt;
          if (timer.baseT >= timer.basePeriod) {
            timer.baseT = 0;
            timer.basePeriod = 11 + Math.random() * 7;
            st.pulses.push({
              vId: v.id, t: 0,
              life: LIFE_DEPTH[0], life0: LIFE_DEPTH[0],
              speed: SPEED_DEPTH[0] * 0.55 * (0.85 + Math.random() * 0.3),
              strength: 0.5 + Math.random() * 0.2,
              generation: 0,
            });
          }
          // delayed heartbeat
          if (timer.heartbeatPending >= 0) {
            timer.heartbeatPending -= dt;
            if (timer.heartbeatPending <= 0) {
              timer.heartbeatPending = -1;
              st.pulses.push({
                vId: v.id, t: 0,
                life: LIFE_DEPTH[0], life0: LIFE_DEPTH[0],
                speed: SPEED_DEPTH[0] * 0.7 * (0.95 + Math.random() * 0.1),
                strength: 1.1,
                generation: 0,
              });
            }
          }
        }
      }

      // detect pulses that have reached the end of a leaf vessel → trigger card flash
      for (const p of st.pulses) {
        if (p.t >= 0.92 && !p._arrived) {
          p._arrived = true;
          // find anchored node for this vessel
          const node = anchoredNodes.find(n => n.vesselId === p.vId);
          if (node && onPulseArrive) onPulseArrive(node);
        }
      }

      renderFrame(canvasRef.current, st, {
        mode, radius, charSet, swapChar, accent, ink, bg,
      });

      // node-hover check
      if (st.mouse.active) {
        const mx = st.mouse.x, my = st.mouse.y;
        let best = null, bestD = 40;
        for (const n of anchoredNodes) {
          const nx = n.x * st.pxW;
          const ny = n.y * st.pxH;
          const d = Math.hypot(nx - mx, ny - my);
          if (d < bestD) { bestD = d; best = n; }
        }
        onNodeHover(best);
      } else {
        onNodeHover(null);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, radius, charSet, swapChar, accent, ink, bg, autoFlow, anchoredNodes, onNodeHover, onPulseArrive]);

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

function injectPulse(st, px, py) {
  if (!st.grid || !st.pxW) return;
  const cols = st.cols, rows = st.rows;
  const charW = st.charW, charH = st.charH;
  // Convert click (px space) → grid coords for the search bbox
  const gx = (px / st.pxW) * cols;
  const gy = (py / st.pxH) * rows;
  // Search a bbox of equal pixel radius in both axes.
  const R_PX = 140;
  const spanX = Math.ceil(R_PX / charW);
  const spanY = Math.ceil(R_PX / charH);
  const x0 = Math.max(0, Math.floor(gx - spanX));
  const x1 = Math.min(cols - 1, Math.ceil(gx + spanX));
  const y0 = Math.max(0, Math.floor(gy - spanY));
  const y1 = Math.min(rows - 1, Math.ceil(gy + spanY));
  let best = -1, bestD = Infinity;
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const idx = yy * cols + xx;
      // must be ON a vessel
      if (st.grid.dist[idx] > st.grid.rAt[idx]) continue;
      // true pixel distance from click to this cell's center
      const cellPxX = xx * charW + charW * 0.5;
      const cellPxY = yy * charH + charH * 0.5;
      const dPx = Math.hypot(cellPxX - px, cellPxY - py);
      if (dPx < bestD) { bestD = dPx; best = idx; }
    }
  }
  if (best < 0) return;
  const vId = st.grid.vid[best];
  const t0 = st.grid.tAlong[best];
  const v = st.vessels[vId];
  const depth = v ? v.depth : 0;
  const speed = depth === 0 ? 0.14 : depth === 1 ? 0.22 : 0.32;
  const life = depth === 0 ? 10 : depth === 1 ? 7 : 5;
  st.pulses.push({
    vId, t: t0, life, life0: life, speed, strength: 1.5,
  });
}

function renderFrame(canvas, st, opts) {
  if (!canvas || !st.grid) return;
  const ctx = canvas.getContext("2d");
  const { cols, rows, charW, charH, pxW, pxH, grid, time, mouse, pulses } = st;

  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, pxW, pxH);

  ctx.font = `${Math.round(charH * 0.78)}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  // Work in PIXEL space for cursor radius so it's a true circle regardless of
  // char-cell aspect (cells are ~charW x charH; charH ≈ 2 * charW).
  const mxPx = mouse.active ? mouse.x : -1e9;
  const myPx = mouse.active ? mouse.y : -1e9;
  // Radius is in "cells" conceptually; convert to px using charW so 1 unit ≈ 1 char width.
  const Rpx = opts.radius * charW;

  // prepare bloom decay
  const bloom = st.bloom;
  for (let i = 0; i < bloom.length; i++) bloom[i] *= 0.9;

  // bloom injection around cursor
  if (mouse.active && opts.mode === "bloom") {
    const cx = Math.floor(mxPx / charW), cy = Math.floor(myPx / charH);
    const spanX = Math.ceil(Rpx / charW);
    const spanY = Math.ceil(Rpx / charH);
    const x0 = Math.max(0, cx - spanX), x1 = Math.min(cols - 1, cx + spanX);
    const y0 = Math.max(0, cy - spanY), y1 = Math.min(rows - 1, cy + spanY);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cellPxX = x * charW + charW * 0.5;
        const cellPxY = y * charH + charH * 0.5;
        const d = Math.hypot(cellPxX - mxPx, cellPxY - myPx);
        if (d <= Rpx) {
          const idx = y * cols + x;
          if (grid.dist[idx] < grid.rAt[idx] + 1) {
            bloom[idx] = Math.min(1, bloom[idx] + 1 - d / Rpx);
          }
        }
      }
    }
  }

  // pulses → per-cell activation map
  const pulseAct = new Float32Array(cols * rows);
  for (const p of pulses) {
    // find cells on this vessel within a t-window around p.t
    // (simple scan — vessels are small)
    const v = st.vessels[p.vId];
    if (!v) continue;
    // We drew vessel cells into grid.tAlong, so scan cells with vid == p.vId
    // This is O(cols*rows) — acceptable for typical grids (~ 15k cells)
    const tWin = 0.05;
    for (let i = 0; i < cols * rows; i++) {
      if (grid.vid[i] !== p.vId) continue;
      const dt = grid.tAlong[i] - p.t;
      if (Math.abs(dt) < tWin) {
        const amp = (1 - Math.abs(dt) / tWin) * p.strength * Math.max(0, Math.min(1, p.life / (p.life0 || 4)));
        if (amp > pulseAct[i]) pulseAct[i] = amp;
      }
    }
  }

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      const d = grid.dist[idx];
      const rC = grid.rAt[idx];
      const onVessel = d <= rC;

      // background: faint dot grid
      if (!onVessel) {
        // only draw sparse background chars near vessels for atmosphere
        if (d > rC + 2) continue;
        const fade = Math.max(0, 1 - (d - rC) / 2);
        ctx.fillStyle = hexWithAlpha(opts.ink, 0.08 * fade);
        const ch = opts.charSet[(x * 31 + y * 17) % opts.charSet.length];
        ctx.fillText(ch, x * charW, y * charH);
        continue;
      }

      // cell is ON a vessel
      let px = x * charW;
      let py = y * charH;

      // deflect: push cells away from cursor (pixel space, true circle)
      // Reduced magnitude; also applies under "flow-deflect" combined mode.
      if ((opts.mode === "deflect" || opts.mode === "flow-deflect") && mouse.active) {
        const cellPxX = x * charW + charW * 0.5;
        const cellPxY = y * charH + charH * 0.5;
        const dxPx = cellPxX - mxPx, dyPx = cellPxY - myPx;
        const mdPx = Math.hypot(dxPx, dyPx);
        if (mdPx < Rpx) {
          const f = (1 - mdPx / Rpx) ** 2;
          const dir = mdPx > 0.001 ? 1 / mdPx : 0;
          // magnitude dialed down: 1.2 in solo deflect, 0.8 in combined
          const mag = opts.mode === "flow-deflect" ? 0.8 : 1.2;
          px += dxPx * dir * f * charW * mag;
          py += dyPx * dir * f * charW * mag;
        }
      }

      // flow: along-vessel oscillation. Softer amplitude; combined mode uses
      // a subtler version still.
      if (opts.mode === "flow" || opts.mode === "flow-deflect" || pulseAct[idx] > 0) {
        const speedScale = opts.mode === "flow" ? 1.0 : 0.7;
        const ampScale =
          opts.mode === "flow" ? 0.18
          : opts.mode === "flow-deflect" ? 0.14
          : 0.4; // pulse visuals keep the original amplitude
        const phase = time * 1.2 * speedScale - grid.tAlong[idx] * 8;
        const wob = Math.sin(phase) * ampScale;
        px += grid.nx[idx] * wob * charW;
        py += grid.ny[idx] * wob * charH;
      }

      // color: subtle taper darker near thick trunks
      const core = 1 - Math.min(1, d / Math.max(1, rC));
      let alpha = 0.35 + core * 0.55;

      // pulse brightens
      const pa = pulseAct[idx];
      if (pa > 0) alpha = Math.min(1, alpha + pa);

      // bloom: local intensify
      if (bloom[idx] > 0.01) alpha = Math.min(1, alpha + bloom[idx] * 0.6);

      // character choice
      let ch = opts.charSet[(x * 7 + y * 13 + grid.vid[idx] * 11) % opts.charSet.length];

      // swap inside radius (pixel space, true circle)
      const cellPxX = x * charW + charW * 0.5;
      const cellPxY = y * charH + charH * 0.5;
      const cursorMd = mouse.active ? Math.hypot(cellPxX - mxPx, cellPxY - myPx) : Infinity;
      const inSwap = opts.mode === "swap" && mouse.active && cursorMd < Rpx;
      if (inSwap) ch = opts.swapChar;
      // pulse also swaps
      if (pa > 0.15) ch = opts.swapChar;
      if (bloom[idx] > 0.4) ch = opts.swapChar;

      // colour: ink, shift toward accent on activation
      const useAccent = pa > 0.15 || bloom[idx] > 0.4 || inSwap;
      ctx.fillStyle = hexWithAlpha(useAccent ? opts.accent : opts.ink, alpha);
      ctx.fillText(ch, px, py);
    }
  }
}

function hexWithAlpha(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

Object.assign(window, { ArteryHero });
