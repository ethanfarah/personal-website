// app.jsx — site shell, sections, tweak panel
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ---- Tweaks: persisted defaults ------------------------------------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "sparse",
  "mode": "flow-deflect",
  "radius": 9,
  "cellSize": 9,
  "thickness": 2.4,
  "seed": 88,
  "charSet": "0",
  "swapChar": "1",
  "autoFlow": true,
  "accent": "#7c2d12",
  "ink": "#0a0a0a",
  "bg": "#f4efe6"
}/*EDITMODE-END*/;

const MODES = [
  { id: "swap", label: "swap (0→1)", hint: "Cells inside cursor radius become the swap char" },
  { id: "bloom", label: "bloom", hint: "Cells light up + decay back" },
  { id: "deflect", label: "deflect", hint: "Velocity-field push away from cursor" },
  { id: "flow-deflect", label: "flow + deflect", hint: "Gentle along-vessel flow + cursor deflection" },
  { id: "pulse", label: "click → pulse", hint: "Click a vessel to inject a travelling pulse" },
  { id: "flow", label: "flow", hint: "Continuous along-vessel oscillation" },
];

const DENSITIES = ["sparse", "medium", "dense"];

function App() {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = useState(false);
  const [hoverNode, setHoverNode] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [openPaper, setOpenPaper] = useState(null);

  // tweak protocol
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "__activate_edit_mode") setEditMode(true);
      if (d.type === "__deactivate_edit_mode") setEditMode(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const setTweak = useCallback((k, v) => {
    setTweaks((t) => {
      const next = { ...t, [k]: v };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
      return next;
    });
  }, []);

  // track mouse globally for paper-card position
  useEffect(() => {
    const onMove = (e) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Easter-egg theme switcher: cycles through paper → blood → binary on `\`,
  // or jumps directly via shift+P / shift+B / shift+N. A brief toast appears.
  const [themeToast, setThemeToast] = useState(null);
  const themeCycle = ["paper", "blood", "binary"];
  useEffect(() => {
    const onKey = (e) => {
      // ignore when typing in inputs
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      let which = null;
      if (e.key === "\\") {
        // cycle
        const cur = detectCurrentTheme(tweaks);
        const idx = themeCycle.indexOf(cur);
        which = themeCycle[(idx + 1) % themeCycle.length];
      } else if (e.shiftKey && (e.key === "P" || e.key === "p")) which = "paper";
      else if (e.shiftKey && (e.key === "B" || e.key === "b")) which = "blood";
      else if (e.shiftKey && (e.key === "N" || e.key === "n")) which = "binary";
      if (!which) return;
      e.preventDefault();
      applyPreset(setTweak, which);
      setThemeToast(which);
      clearTimeout(window.__themeToastT);
      window.__themeToastT = setTimeout(() => setThemeToast(null), 1400);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tweaks, setTweak]);

  const SITE = window.SITE;
  const paperNodes = SITE.papers;

  // shared state between artery bg and hero overlay
  const { anchoredNodes, setAnchoredNodes, flashedVessel, handlePulseArrive } = useAnchoredNodesAndFlash();

  // colors
  const ink = tweaks.ink;
  const bg = tweaks.bg;
  const accent = tweaks.accent;

  return (
    <div style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: "'JetBrains Mono', ui-monospace, monospace", position: "relative" }}>
      {/* Fixed full-viewport artery layer */}
      <ArteryBackground
        tweaks={tweaks}
        paperNodes={paperNodes}
        onNodeHover={setHoverNode}
        onNodes={setAnchoredNodes}
        onPulseArrive={handlePulseArrive}
        ink={ink} bg={bg} accent={accent}
      />

      {/* Hero HUD + paper cards (absolute inside full-viewport hero section) */}
      <Hero
        tweaks={tweaks} SITE={SITE}
        anchoredNodes={anchoredNodes}
        flashedVessel={flashedVessel}
        ink={ink} bg={bg} accent={accent}
        onOpenPaper={setOpenPaper}
      />

      {/* Scrollable content on top */}
      <Body SITE={SITE} ink={ink} bg={bg} accent={accent} onOpenPaper={setOpenPaper} />

      {editMode && <TweakPanel tweaks={tweaks} setTweak={setTweak} />}

      {themeToast && <ThemeToast name={themeToast} ink={ink} bg={bg} accent={accent} />}

      {openPaper && <PaperModal paper={openPaper} onClose={() => setOpenPaper(null)} ink={ink} bg={bg} accent={accent} />}
    </div>
  );
}

// App needs shared state for paper cards + pulse flash, since the ArteryBackground
// is outside the Hero now.
function useAnchoredNodesAndFlash() {
  const [anchoredNodes, setAnchoredNodes] = React.useState([]);
  const [flashedVessel, setFlashedVessel] = React.useState(null);
  const flashTimerRef = React.useRef(null);
  const handlePulseArrive = React.useCallback((node) => {
    if (!node) return;
    setFlashedVessel(node.vesselId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashedVessel(null), 900);
  }, []);
  return { anchoredNodes, setAnchoredNodes, flashedVessel, handlePulseArrive };
}

// ---- Artery Background (absolute, spans full document) ------------------
function ArteryBackground({ tweaks, paperNodes, onNodeHover, onNodes, onPulseArrive, ink, bg, accent }) {
  // Track document height so the canvas covers the whole scroll extent,
  // and re-measure when it changes (fonts loading, images, layout shifts).
  const [docH, setDocH] = React.useState(() => Math.max(
    document.documentElement.scrollHeight,
    window.innerHeight
  ));
  React.useEffect(() => {
    const measure = () => {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight
      );
      setDocH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("load", measure);
    const id = setInterval(measure, 1200); // cheap fallback
    return () => { ro.disconnect(); clearInterval(id); window.removeEventListener("load", measure); };
  }, []);

  return (
    <div style={{
      position: "absolute", top: 0, left: 0, width: "100%", height: docH,
      zIndex: 0, pointerEvents: "none",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
        <ArteryHero
          density={tweaks.density}
          seed={tweaks.seed}
          thickness={tweaks.thickness}
          cellSize={tweaks.cellSize}
          charSet={tweaks.charSet}
          swapChar={tweaks.swapChar}
          radius={tweaks.radius}
          mode={tweaks.mode}
          autoFlow={tweaks.autoFlow}
          showNodes={false}
          onNodeHover={onNodeHover}
          onNodes={onNodes}
          onPulseArrive={onPulseArrive}
          paperNodes={paperNodes}
          accent={accent} ink={ink} bg={bg}
        />
      </div>
    </div>
  );
}

// ---- Hero ---------------------------------------------------------------
function Hero({ tweaks, SITE, anchoredNodes, flashedVessel, ink, bg, accent, onOpenPaper }) {
  return (
    <section style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      <PaperCardOverlay
        papers={SITE.papers}
        onOpen={onOpenPaper}
        ink={ink} bg={bg} accent={accent}
      />

      {/* HUD: name + nav + tagline overlay */}
      <div style={{ position: "absolute", top: 28, left: 36, right: 36, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none", zIndex: 5 }}>
        <div style={{ pointerEvents: "auto" }}>
          <div style={{ fontSize: 13, letterSpacing: "0.04em", textTransform: "lowercase", color: ink, opacity: 0.55 }}>
            {SITE.domain}
          </div>
          <h1 style={{ margin: "4px 0 0", fontFamily: "'Newsreader', Georgia, serif", fontWeight: 400, fontStyle: "italic", fontSize: "clamp(38px, 5vw, 72px)", lineHeight: 1, color: ink }}>
            {SITE.name}
          </h1>
        </div>
        <Nav ink={ink} accent={accent} />
      </div>

      <div style={{ position: "absolute", left: 36, bottom: 36, maxWidth: 520, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ fontSize: 12, color: ink, opacity: 0.55, marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>
          ── res. interests
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: ink, opacity: 0.78 }}>
          {SITE.tagline}
        </p>
      </div>

      <div style={{ position: "absolute", right: 36, bottom: 36, fontSize: 11, color: ink, opacity: 0.45, fontFamily: "'JetBrains Mono', monospace", textAlign: "right", pointerEvents: "none", zIndex: 5, lineHeight: 1.7 }}>
        <div>mode/{tweaks.mode}</div>
        <div>ρ/{tweaks.density}</div>
        <div>Re ≈ 1.7e3</div>
        <div style={{ marginTop: 8, opacity: 0.6 }}>⇧P ⇧B ⇧N · \</div>
      </div>

      <div style={{ position: "absolute", left: "50%", bottom: 18, transform: "translateX(-50%)", fontSize: 11, color: ink, opacity: 0.4, letterSpacing: "0.2em", textTransform: "uppercase", pointerEvents: "none", zIndex: 5 }}>
      </div>
    </section>
  );
}

// ---- Paper cards anchored to vessel termini ----------------------------
// Placement algorithm:
//   1. For each terminus, compute a "desired" card position offset outward.
//   2. Clamp into a safe zone (avoiding HUD areas: top 120px, bottom 110px,
//      left 360px at top for name, right 280px at top for nav).
//   3. Iteratively resolve overlaps via simple force-directed push.
// Ray-from-point → rect-edge intersection.
// Returns null if the ray (forward direction only) doesn't hit the rect.
function rayIntoRect(ox, oy, dx, dy, rx, ry, rw, rh) {
  // Parametric ray: (ox + t*dx, oy + t*dy), t >= 0
  // Find the smallest t >= 0 where the ray crosses any rect edge AND the
  // intersection lies within that edge's span.
  const hits = [];
  // left edge x = rx
  if (dx !== 0) {
    const t = (rx - ox) / dx;
    if (t >= 0) {
      const y = oy + t * dy;
      if (y >= ry && y <= ry + rh) hits.push({ t, x: rx, y });
    }
    // right edge x = rx + rw
    const t2 = (rx + rw - ox) / dx;
    if (t2 >= 0) {
      const y = oy + t2 * dy;
      if (y >= ry && y <= ry + rh) hits.push({ t: t2, x: rx + rw, y });
    }
  }
  // top edge y = ry
  if (dy !== 0) {
    const t = (ry - oy) / dy;
    if (t >= 0) {
      const x = ox + t * dx;
      if (x >= rx && x <= rx + rw) hits.push({ t, x, y: ry });
    }
    // bottom edge y = ry + rh
    const t2 = (ry + rh - oy) / dy;
    if (t2 >= 0) {
      const x = ox + t2 * dx;
      if (x >= rx && x <= rx + rw) hits.push({ t: t2, x, y: ry + rh });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.t - b.t);
  return hits[0];
}

// ---- PaperCardOverlay ----------------------------------------------------
// Cards are placed at fixed (x, y) fractions tuned to where arteries end for
// the locked default seed (88) + thickness (2.4). No connector lines — the
// cards float over the vascular texture on their own.
function PaperCardOverlay({ papers, onOpen, ink, bg, accent }) {
  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Hardcoded anchor fractions, ordered to align with SITE.papers.
  // Each is (xFrac, yFrac) — the CENTER of the card — with tiny offsets
  // so nothing collides with the hero HUD (name, nav, interests, mode).
  const ANCHORS = [
    { xf: 0.14, yf: 0.78 }, // lower-left  → paper[0]
    { xf: 0.48, yf: 0.19 }, // upper-mid   → paper[1]
    { xf: 0.82, yf: 0.46 }, // mid-right   → paper[2]
    { xf: 0.82, yf: 0.82 }, // lower-right → paper[3]
    { xf: 0.48, yf: 0.42 }, // center      → paper[4]
    { xf: 0.55, yf: 0.87 }, // lower-mid   → paper[5]
    { xf: 0.17, yf: 0.49 }, // mid-left    → paper[6]
  ];
  const CARD_W = 230, CARD_H = 86;

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {papers.map((paper, i) => {
        const a = ANCHORS[i] || { xf: 0.5, yf: 0.5 };
        const MARGIN = 20;
        let cx = a.xf * size.w - CARD_W / 2;
        let cy = a.yf * size.h - CARD_H / 2;
        cx = Math.max(MARGIN, Math.min(size.w - CARD_W - MARGIN, cx));
        cy = Math.max(MARGIN, Math.min(size.h - CARD_H - MARGIN, cy));
        return (
          <button key={i}
            onClick={() => onOpen(paper)}
            style={{
              position: "absolute",
              left: cx, top: cy,
              width: CARD_W, minHeight: CARD_H,
              padding: "10px 12px",
              background: bg,
              border: `1px solid ${ink}33`,
              boxShadow: `2px 2px 0 ${ink}11`,
              color: ink, textAlign: "left", cursor: "pointer",
              fontFamily: "inherit", zIndex: 4,
              transition: "border-color 0.25s, box-shadow 0.25s",
              pointerEvents: "auto",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accent;
              e.currentTarget.style.boxShadow = `3px 3px 0 ${accent}66`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = ink + "33";
              e.currentTarget.style.boxShadow = `2px 2px 0 ${ink}11`;
            }}
          >
            <div style={{ fontSize: 9, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              {paper.venue}
            </div>
            <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 14, lineHeight: 1.25, marginBottom: 4 }}>
              {paper.title}
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.04em" }}>
              {paper.tags.join(" · ")}
            </div>
          </button>
        );
      })}
    </div>
  );
}
function Nav({ ink, accent }) {
  const items = [
    { l: "papers", h: "#papers" },
    { l: "posters", h: "#posters" },
    { l: "projects", h: "#projects" },
    { l: "about", h: "#about" },
    { l: "cv", h: "#cv" },
    { l: "contact", h: "#contact" },
  ];
  return (
    <nav style={{ pointerEvents: "auto", display: "flex", gap: 22, fontSize: 12, color: ink, opacity: 0.75 }}>
      {items.map((i) => (
        <a key={i.l} href={i.h} style={{ color: ink, textDecoration: "none", borderBottom: `1px solid transparent`, paddingBottom: 2 }}
          onMouseEnter={(e) => { e.target.style.borderBottomColor = accent; e.target.style.color = accent; }}
          onMouseLeave={(e) => { e.target.style.borderBottomColor = "transparent"; e.target.style.color = ink; }}>
          {i.l}
        </a>
      ))}
    </nav>
  );
}

// ---- Hover card (follows cursor when near a node) --------------------------
function HoverCard({ node, pos, accent, ink, bg, visible = true }) {
  if (!visible) return null;
  if (!node || !node.paper) return null;
  const p = node.paper;
  const offsetX = 18, offsetY = 18;
  return (
    <div style={{
      position: "fixed", left: pos.x + offsetX, top: pos.y + offsetY,
      width: 320, padding: "14px 16px",
      background: bg, border: `1px solid ${ink}33`, boxShadow: `4px 4px 0 ${ink}11`,
      pointerEvents: "none", zIndex: 50,
    }}>
      <div style={{ fontSize: 10, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>{p.venue}</div>
      <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 18, lineHeight: 1.25, marginBottom: 6 }}>{p.title}</div>
      <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>{p.blurb}</div>
    </div>
  );
}

// ---- Body sections -------------------------------------------------------
function Body({ SITE, ink, bg, accent, onOpenPaper }) {
  // Translucent layer so the arteries bleed subtly through the body sections.
  const panelBg = hexToRgba(bg, 0.55);
  return (
    <main style={{
      position: "relative", zIndex: 2,
      background: panelBg,
      backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)",
      borderTop: `1px solid ${ink}22`,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 36px 140px" }}>
        <Section title="about" id="about" ink={ink} accent={accent}>
          <p style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 22, lineHeight: 1.55, maxWidth: 720, margin: "0 0 18px" }}>
            {SITE.about}
          </p>
        </Section>

        <Section title="papers" id="papers" ink={ink} accent={accent}>
          <PapersList papers={SITE.allPapers || SITE.papers} ink={ink} accent={accent} bg={bg} onOpen={onOpenPaper} />
        </Section>

        <Section title="posters" id="posters" ink={ink} accent={accent}>
          <PapersList papers={SITE.posters || []} ink={ink} accent={accent} bg={bg} onOpen={onOpenPaper} />
        </Section>

        <Section title="projects" id="projects" ink={ink} accent={accent}>
          <ProjectsList projects={SITE.projects} ink={ink} accent={accent} bg={bg} />
        </Section>

        <Section title="cv" id="cv" ink={ink} accent={accent}>
          <a href={SITE.cv} style={{ color: accent, textDecoration: "none", borderBottom: `1px solid ${accent}`, fontSize: 14 }}>
            → download cv.pdf
          </a>
        </Section>

        <Section title="contact" id="contact" ink={ink} accent={accent}>
          <ContactList SITE={SITE} ink={ink} accent={accent} />
        </Section>

        <Footer ink={ink} accent={accent} SITE={SITE} />
      </div>
    </main>
  );
}

function hexToRgba(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function Section({ title, id, children, ink, accent }) {
  return (
    <section id={id} style={{ marginBottom: 88 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 28, borderBottom: `1px solid ${ink}1f`, paddingBottom: 12 }}>
        <span style={{ fontSize: 11, opacity: 0.5, letterSpacing: "0.15em", textTransform: "uppercase" }}>§</span>
        <h2 style={{ margin: 0, fontFamily: "'Newsreader', Georgia, serif", fontWeight: 400, fontStyle: "italic", fontSize: 36 }}>{title}</h2>
        <span style={{ flex: 1, fontSize: 11, opacity: 0.4, letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "right" }}>
          /{title}
        </span>
      </header>
      {children}
    </section>
  );
}

function PapersList({ papers, ink, accent, bg, onOpen }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      {papers.map((p, i) => (
        <button key={i} onClick={() => onOpen(p)} style={{
          display: "grid", gridTemplateColumns: "40px 110px 1fr 200px", alignItems: "baseline", gap: 24,
          width: "100%", padding: "20px 22px",
          background: bg + "d9",
          border: `1px solid ${ink}14`,
          borderLeft: `2px solid ${accent}`,
          textAlign: "left", color: ink, cursor: "pointer", fontFamily: "inherit",
          transition: "background .15s, border-color .15s",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = bg + "f2"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = bg + "d9"; }}>
          <span style={{ fontSize: 11, opacity: 0.45 }}>0{i + 1}</span>
          <span style={{ fontSize: 11, opacity: 0.6, color: accent, letterSpacing: "0.05em" }}>{p.venue}</span>
          <span style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 22, lineHeight: 1.3 }}>{p.title}</span>
          <span style={{ fontSize: 11, opacity: 0.55, textAlign: "right" }}>
            {p.tags.join(" · ")}
          </span>
        </button>
      ))}
    </div>
  );
}

function ProjectsList({ projects, ink, accent, bg }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
      {projects.map((p, i) => (
        <div key={i} style={{
          background: bg + "d9",
          border: `1px solid ${ink}14`,
          borderLeft: `2px solid ${accent}`,
          padding: "18px 20px",
        }}>
          <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 22, marginBottom: 6 }}>{p.title}</div>
          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.55, marginBottom: p.code ? 10 : 0 }}>{p.blurb}</div>
          {p.code && (
            <a href={p.code} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", borderBottom: `1px solid ${accent}`, fontSize: 12 }}>→ code</a>
          )}
        </div>
      ))}
    </div>
  );
}

function ContactList({ SITE, ink, accent }) {
  const items = [
    { k: "email", v: SITE.email, h: `mailto:${SITE.email}` },
    { k: "github", v: SITE.github, h: `https://${SITE.github}` },
    { k: "linkedin", v: SITE.linkedin, h: `https://${SITE.linkedin}` },
  ];
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 14 }}>
      {items.map((i) => (
        <li key={i.k} style={{ display: "flex", gap: 24, padding: "10px 0", borderBottom: `1px dashed ${ink}1a` }}>
          <span style={{ width: 100, opacity: 0.5, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.1em" }}>{i.k}</span>
          <a href={i.h} style={{ color: ink, textDecoration: "none", borderBottom: `1px solid transparent` }}
            onMouseEnter={(e) => { e.target.style.color = accent; e.target.style.borderBottomColor = accent; }}
            onMouseLeave={(e) => { e.target.style.color = ink; e.target.style.borderBottomColor = "transparent"; }}>
            {i.v}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Footer({ ink, accent, SITE }) {
  return (
    <footer style={{ marginTop: 80, paddingTop: 24, borderTop: `1px solid ${ink}1f`, display: "flex", justifyContent: "space-between", fontSize: 11, opacity: 0.5, letterSpacing: "0.05em" }}>
      <span>© {new Date().getFullYear()} {SITE.name}</span>
      <span>built with finite differences and good intentions</span>
    </footer>
  );
}

// ---- Theme toast (easter-egg feedback) -----------------------------------
function ThemeToast({ name, ink, bg, accent }) {
  return (
    <div style={{
      position: "fixed", left: "50%", top: 40, transform: "translateX(-50%)",
      background: bg, color: ink, border: `1px solid ${ink}33`,
      padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
      zIndex: 300, pointerEvents: "none",
      animation: "themeToastIn 0.25s ease-out",
      boxShadow: `3px 3px 0 ${accent}55`,
    }}>
      <span style={{ opacity: 0.5 }}>theme</span>
      <span style={{ marginLeft: 10, color: accent }}>{name}</span>
      <style>{`@keyframes themeToastIn { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </div>
  );
}

// ---- Paper modal ---------------------------------------------------------
function PaperModal({ paper, onClose, ink, bg, accent }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: `${ink}88`,
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      padding: 30,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: bg, color: ink, padding: "36px 40px", maxWidth: 640, width: "100%",
        border: `1px solid ${ink}33`, position: "relative",
        boxShadow: `8px 8px 0 ${accent}55`,
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 14, right: 18, background: "transparent", border: "none",
          color: ink, fontSize: 18, cursor: "pointer", fontFamily: "inherit",
        }}>×</button>
        <div style={{ fontSize: 11, color: accent, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{paper.venue}</div>
        <h3 style={{ margin: "0 0 16px", fontFamily: "'Newsreader', Georgia, serif", fontWeight: 400, fontStyle: "italic", fontSize: 30, lineHeight: 1.2 }}>
          {paper.title}
        </h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.65, opacity: 0.85 }}>{paper.blurb}</p>
        <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: "0.08em", marginBottom: 18 }}>
          {paper.tags.map((t) => `[${t}]`).join("  ")}
        </div>
        {paper.authors && (
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 14, fontStyle: "italic" }}>
            {paper.authors}
          </div>
        )}
        <div style={{ display: "flex", gap: 14 }}>
          {paper.pdf ? (
            <a href={paper.pdf} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", borderBottom: `1px solid ${accent}`, fontSize: 13 }}>→ pdf</a>
          ) : (
            <span style={{ color: ink, opacity: 0.4, fontSize: 13, fontStyle: "italic" }}>pdf coming soon</span>
          )}
          {paper.bibtex && (
            <a href={paper.bibtex} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", borderBottom: `1px solid ${accent}`, fontSize: 13 }}>→ bibtex</a>
          )}
          {paper.code && (
            <a href={paper.code} target="_blank" rel="noopener noreferrer" style={{ color: accent, textDecoration: "none", borderBottom: `1px solid ${accent}`, fontSize: 13 }}>→ code</a>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Tweak panel ---------------------------------------------------------
function TweakPanel({ tweaks, setTweak }) {
  return (
    <div style={{
      position: "fixed", right: 18, bottom: 18, width: 300,
      background: "#0c0c0c", color: "#e8e3d8", border: "1px solid #333",
      padding: "14px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
      zIndex: 200, boxShadow: "6px 6px 0 rgba(0,0,0,0.4)",
      maxHeight: "85vh", overflowY: "auto",
    }}>
      <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6, marginBottom: 12 }}>Tweaks</div>

      <Group label="interaction">
        {MODES.map((m) => (
          <Pill key={m.id} active={tweaks.mode === m.id} onClick={() => setTweak("mode", m.id)}>{m.label}</Pill>
        ))}
      </Group>

      <Group label="density">
        {DENSITIES.map((d) => (
          <Pill key={d} active={tweaks.density === d} onClick={() => setTweak("density", d)}>{d}</Pill>
        ))}
      </Group>

      <Slider label="cursor radius" v={tweaks.radius} min={2} max={30} step={1} onChange={(v) => setTweak("radius", v)} />
      <Slider label="cell size" v={tweaks.cellSize} min={6} max={16} step={1} onChange={(v) => setTweak("cellSize", v)} />
      <Slider label="thickness" v={tweaks.thickness} min={0.4} max={2.5} step={0.1} onChange={(v) => setTweak("thickness", v)} />
      <Slider label="seed" v={tweaks.seed} min={1} max={99} step={1} onChange={(v) => setTweak("seed", v)} />

      <Group label="characters">
        <TextField label="set" v={tweaks.charSet} onChange={(v) => setTweak("charSet", v || "0")} />
        <TextField label="swap" v={tweaks.swapChar} onChange={(v) => setTweak("swapChar", v || "1")} />
      </Group>

      <Group label="colors">
        <ColorRow label="bg" v={tweaks.bg} onChange={(v) => setTweak("bg", v)} />
        <ColorRow label="ink" v={tweaks.ink} onChange={(v) => setTweak("ink", v)} />
        <ColorRow label="accent" v={tweaks.accent} onChange={(v) => setTweak("accent", v)} />
      </Group>

      <Group label="presets">
        <Pill onClick={() => applyPreset(setTweak, "paper")}>paper</Pill>
        <Pill onClick={() => applyPreset(setTweak, "blood")}>blood</Pill>
        <Pill onClick={() => applyPreset(setTweak, "terminal")}>terminal</Pill>
        <Pill onClick={() => applyPreset(setTweak, "ink")}>ink</Pill>
        <Pill onClick={() => applyPreset(setTweak, "binary")}>binary noise</Pill>
      </Group>

      <Group label="toggles">
        <Toggle label="auto-flow pulses" v={tweaks.autoFlow} onChange={(v) => setTweak("autoFlow", v)} />
      </Group>
    </div>
  );
}

function applyPreset(setTweak, name) {
  const presets = {
    paper:    { bg: "#f4efe6", ink: "#0a0a0a", accent: "#7c2d12", charSet: "0", swapChar: "1" },
    blood:    { bg: "#0a0606", ink: "#f5e6d8", accent: "#c1272d", charSet: "0", swapChar: "1" },
    terminal: { bg: "#0a0d0a", ink: "#7dd87d", accent: "#bef0be", charSet: "0", swapChar: "1" },
    ink:      { bg: "#fafaf7", ink: "#171717", accent: "#1d4ed8", charSet: ".o0O", swapChar: "1" },
    binary:   { bg: "#101010", ink: "#cfcfcf", accent: "#fbbf24", charSet: "01", swapChar: "█" },
  };
  const p = presets[name];
  Object.entries(p).forEach(([k, v]) => setTweak(k, v));
}

// Detect which named preset (if any) the current tweak colors match,
// so `\` can advance the cycle from wherever the user currently is.
function detectCurrentTheme(tweaks) {
  const t = { bg: tweaks.bg, ink: tweaks.ink, accent: tweaks.accent };
  if (t.bg === "#f4efe6" && t.accent === "#7c2d12") return "paper";
  if (t.bg === "#0a0606" && t.accent === "#c1272d") return "blood";
  if (t.bg === "#101010" && t.accent === "#fbbf24") return "binary";
  return "paper"; // fallback; \ will advance to blood
}

function Group({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, opacity: 0.5, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#e8e3d8" : "transparent",
      color: active ? "#0c0c0c" : "#e8e3d8",
      border: "1px solid #4a4a4a",
      padding: "4px 8px", fontSize: 11, cursor: "pointer",
      fontFamily: "inherit",
    }}>{children}</button>
  );
}

function Slider({ label, v, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.7, marginBottom: 3 }}>
        <span>{label}</span><span>{v}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "#e8e3d8" }} />
    </div>
  );
}

function TextField({ label, v, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, width: "100%" }}>
      <span style={{ fontSize: 10, opacity: 0.6, width: 36 }}>{label}</span>
      <input value={v} onChange={(e) => onChange(e.target.value)} style={{
        flex: 1, background: "#1a1a1a", color: "#e8e3d8", border: "1px solid #333",
        padding: "3px 6px", fontFamily: "inherit", fontSize: 11,
      }} />
    </div>
  );
}

function ColorRow({ label, v, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, width: "100%" }}>
      <span style={{ fontSize: 10, opacity: 0.6, width: 50 }}>{label}</span>
      <input type="color" value={v} onChange={(e) => onChange(e.target.value)} style={{ width: 28, height: 22, border: "1px solid #333", background: "transparent", padding: 0, cursor: "pointer" }} />
      <span style={{ fontSize: 10, opacity: 0.7 }}>{v}</span>
    </div>
  );
}

function Toggle({ label, v, onChange }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", width: "100%", marginBottom: 4 }}>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
