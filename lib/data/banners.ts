/**
 * Built-in profile banner presets - zero asset cost, always crisp.
 *
 * Every preset is generated from pure CSS gradients and/or an inline SVG layer
 * (no stock photos, no network requests). Brand-aligned to the Collab47 tokens:
 *   cobalt #B95402, ink #12100E, saffron #F5A623, plus supporting blends.
 *
 * A profile's banner is ONE of:
 *   - a preset id stored in `profiles.banner_preset`, OR
 *   - an uploaded `cover_url` + focal point (`cover_focal_x/y`).
 *
 * <ProfileBanner> consumes this registry. Keep it framework-agnostic data:
 * `background` is a CSS background string; `svg` is an optional inline SVG
 * markup string layered on top (tinted via brand hexes, scales to any width).
 */

export type BannerFamily = "gradient" | "doodle" | "abstract" | "scenic";

export interface BannerPreset {
  id: string;
  family: BannerFamily;
  label: string;
  /** CSS `background` shorthand value applied to the base layer. */
  background: string;
  /**
   * Optional inline SVG markup (a single root <svg> with width/height 100%)
   * layered above the background. Uses brand hexes so it stays crisp + cheap.
   */
  svg?: string;
}

export const DEFAULT_BANNER = "cobalt-aurora";

// ---------------------------------------------------------------------------
// SVG layer builders (kept tiny + inline; scale to any banner width)
// ---------------------------------------------------------------------------

const svgWrap = (inner: string, extra = "") =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%' preserveAspectRatio='xMidYMid slice' viewBox='0 0 1200 360' ${extra}>${inner}</svg>`;

// Plus-marks doodle field.
const plusField = (color: string, opacity: number) => {
  let marks = "";
  for (let y = 30; y < 360; y += 60) {
    for (let x = 30; x < 1200; x += 60) {
      const o = ((x + y) % 120 === 0) ? opacity : opacity * 0.45;
      marks += `<path d='M${x - 6} ${y} h12 M${x} ${y - 6} v12' stroke='${color}' stroke-width='2' stroke-opacity='${o}' stroke-linecap='round'/>`;
    }
  }
  return svgWrap(marks);
};

// Circuit lines doodle.
const circuit = (color: string) =>
  svgWrap(
    `<g fill='none' stroke='${color}' stroke-width='2' stroke-opacity='0.45'>
       <path d='M0 90 H300 V200 H520'/><circle cx='300' cy='90' r='5' fill='${color}'/><circle cx='520' cy='200' r='5' fill='${color}'/>
       <path d='M1200 120 H900 V260 H640'/><circle cx='900' cy='120' r='5' fill='${color}'/><circle cx='640' cy='260' r='5' fill='${color}'/>
       <path d='M150 360 V250 H420 V140'/><circle cx='420' cy='140' r='5' fill='${color}'/>
       <path d='M1050 360 V240 H760'/><circle cx='760' cy='240' r='5' fill='${color}'/>
     </g>`
  );

// Sketch nodes (connected dots) doodle.
const nodes = (color: string) => {
  const pts = [
    [120, 90], [340, 170], [560, 80], [780, 200], [1000, 110], [1120, 250],
    [220, 280], [460, 300], [700, 320], [920, 280],
  ];
  let lines = "";
  for (let i = 0; i < pts.length - 1; i++) {
    lines += `<line x1='${pts[i][0]}' y1='${pts[i][1]}' x2='${pts[i + 1][0]}' y2='${pts[i + 1][1]}' stroke='${color}' stroke-width='1.5' stroke-opacity='0.3'/>`;
  }
  const dots = pts
    .map(([x, y]) => `<circle cx='${x}' cy='${y}' r='6' fill='${color}' fill-opacity='0.55'/>`)
    .join("");
  return svgWrap(`<g>${lines}${dots}</g>`);
};

// Constellation doodle (stars + faint links).
const constellation = (color: string) => {
  const stars = [
    [180, 120], [260, 70], [330, 150], [470, 100], [600, 60], [720, 140],
    [850, 90], [980, 160], [1080, 100], [400, 250], [620, 280], [880, 250],
  ];
  let links = "";
  const order = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let i = 0; i < order.length - 1; i++) {
    const a = stars[order[i]];
    const b = stars[order[i + 1]];
    links += `<line x1='${a[0]}' y1='${a[1]}' x2='${b[0]}' y2='${b[1]}' stroke='${color}' stroke-width='1' stroke-opacity='0.25'/>`;
  }
  const pts = stars
    .map(([x, y], i) => `<circle cx='${x}' cy='${y}' r='${i % 3 === 0 ? 3 : 1.8}' fill='${color}' fill-opacity='0.85'/>`)
    .join("");
  return svgWrap(`<g>${links}${pts}</g>`);
};

// Blueprint grid.
const blueprintGrid = (color: string) => {
  let g = "";
  for (let x = 0; x <= 1200; x += 48) g += `<line x1='${x}' y1='0' x2='${x}' y2='360' stroke='${color}' stroke-width='1' stroke-opacity='0.16'/>`;
  for (let y = 0; y <= 360; y += 48) g += `<line x1='0' y1='${y}' x2='1200' y2='${y}' stroke='${color}' stroke-width='1' stroke-opacity='0.16'/>`;
  return svgWrap(`<g>${g}</g>`);
};

// Halftone dots (size gradient left->right).
const halftone = (color: string) => {
  let dots = "";
  for (let y = 24; y < 360; y += 40) {
    for (let x = 24; x < 1200; x += 40) {
      const r = 1 + (x / 1200) * 6;
      dots += `<circle cx='${x}' cy='${y}' r='${r.toFixed(1)}' fill='${color}' fill-opacity='0.22'/>`;
    }
  }
  return svgWrap(`<g>${dots}</g>`);
};

// Diagonal bands.
const diagonalBands = (a: string, b: string) =>
  svgWrap(
    `<g>
       <polygon points='0,360 360,360 0,0' fill='${a}' fill-opacity='0.18'/>
       <polygon points='1200,0 1200,360 840,0' fill='${b}' fill-opacity='0.18'/>
       <polygon points='420,360 720,360 540,140' fill='${a}' fill-opacity='0.10'/>
     </g>`
  );

// Soft blobs.
const blobs = (a: string, b: string) =>
  svgWrap(
    `<g filter='url(#bb)'>
       <defs><filter id='bb'><feGaussianBlur stdDeviation='28'/></filter></defs>
       <circle cx='260' cy='120' r='110' fill='${a}' fill-opacity='0.5'/>
       <circle cx='820' cy='260' r='140' fill='${b}' fill-opacity='0.45'/>
       <circle cx='1040' cy='90' r='90' fill='${a}' fill-opacity='0.4'/>
     </g>`
  );

// Scenic horizon (sun + ground line).
const horizon = () =>
  svgWrap(
    `<g>
       <circle cx='600' cy='250' r='90' fill='#F5A623' fill-opacity='0.85'/>
       <rect x='0' y='250' width='1200' height='110' fill='#12100E' fill-opacity='0.35'/>
       <line x1='0' y1='250' x2='1200' y2='250' stroke='#F5A623' stroke-width='1.5' stroke-opacity='0.5'/>
     </g>`
  );

// Scenic skyline (city silhouette).
const skyline = () => {
  let bldgs = "";
  let x = 0;
  const heights = [70, 120, 90, 160, 110, 200, 130, 180, 100, 150, 90, 140, 80, 170, 110, 130];
  for (const h of heights) {
    const w = 60 + (h % 40);
    bldgs += `<rect x='${x}' y='${360 - h}' width='${w - 8}' height='${h}' fill='#12100E' fill-opacity='0.5'/>`;
    x += w;
  }
  return svgWrap(`<g>${bldgs}</g>`);
};

// Scenic waves.
const waves = () =>
  svgWrap(
    `<g fill='none' stroke-linecap='round'>
       <path d='M0 200 Q150 150 300 200 T600 200 T900 200 T1200 200' stroke='#FFFFFF' stroke-width='2' stroke-opacity='0.35'/>
       <path d='M0 250 Q150 210 300 250 T600 250 T900 250 T1200 250' stroke='#FFFFFF' stroke-width='2' stroke-opacity='0.25'/>
       <path d='M0 300 Q150 270 300 300 T600 300 T900 300 T1200 300' stroke='#FFFFFF' stroke-width='2' stroke-opacity='0.18'/>
     </g>`
  );

// Scenic aurora ribbons.
const aurora = () =>
  svgWrap(
    `<g filter='url(#au)'>
       <defs><filter id='au'><feGaussianBlur stdDeviation='22'/></filter></defs>
       <path d='M0 120 Q300 40 600 120 T1200 120 L1200 220 Q900 160 600 220 T0 220 Z' fill='#B95402' fill-opacity='0.55'/>
       <path d='M0 200 Q300 280 600 200 T1200 200 L1200 280 Q900 230 600 280 T0 280 Z' fill='#D76202' fill-opacity='0.4'/>
     </g>`
  );

// ---------------------------------------------------------------------------
// The 18 presets
// ---------------------------------------------------------------------------

export const BANNER_PRESETS: BannerPreset[] = [
  // --- Gradients (5) -------------------------------------------------------
  {
    id: "cobalt-aurora",
    family: "gradient",
    label: "Cobalt Aurora",
    background:
      "linear-gradient(135deg, #03265E 0%, #1a2744 38%, #B95402 78%, #D76202 100%)",
  },
  {
    id: "midnight-mesh",
    family: "gradient",
    label: "Midnight Mesh",
    background:
      "radial-gradient(ellipse at 80% 18%, #B9540255 0%, transparent 60%), linear-gradient(135deg, #03265E 0%, #1a2744 45%, #12100E 100%)",
  },
  {
    id: "dawn-cobalt",
    family: "gradient",
    label: "Dawn Cobalt",
    background:
      "linear-gradient(120deg, #B95402 0%, #D76202 40%, #F5A623 100%)",
  },
  {
    id: "ink-fade",
    family: "gradient",
    label: "Ink Fade",
    background:
      "linear-gradient(180deg, #12100E 0%, #131b30 60%, #1a2744 100%)",
  },
  {
    id: "paper-cobalt-soft",
    family: "gradient",
    label: "Soft Cobalt",
    background:
      "linear-gradient(135deg, #B95402 0%, #4f74ff 50%, #A34802 100%)",
  },

  // --- Doodles (4) ---------------------------------------------------------
  {
    id: "doodle-plus",
    family: "doodle",
    label: "Plus Field",
    background: "linear-gradient(135deg, #03265E 0%, #1a2744 100%)",
    svg: plusField("#D76202", 0.7),
  },
  {
    id: "doodle-circuit",
    family: "doodle",
    label: "Circuit",
    background: "linear-gradient(135deg, #12100E 0%, #16223f 100%)",
    svg: circuit("#B95402"),
  },
  {
    id: "doodle-nodes",
    family: "doodle",
    label: "Network",
    background: "linear-gradient(135deg, #101a33 0%, #1f2e52 100%)",
    svg: nodes("#D76202"),
  },
  {
    id: "doodle-constellation",
    family: "doodle",
    label: "Constellation",
    background: "linear-gradient(160deg, #12100E 0%, #131b30 70%, #1a2744 100%)",
    svg: constellation("#F5A623"),
  },

  // --- Abstract (5) --------------------------------------------------------
  {
    id: "abstract-conic",
    family: "abstract",
    label: "Conic Mesh",
    background:
      "conic-gradient(from 200deg at 70% 40%, #B95402, #03265E, #D76202, #1a2744, #B95402)",
  },
  {
    id: "abstract-blueprint",
    family: "abstract",
    label: "Blueprint",
    background: "linear-gradient(135deg, #0e1830 0%, #16223f 100%)",
    svg: blueprintGrid("#D76202"),
  },
  {
    id: "abstract-blobs",
    family: "abstract",
    label: "Soft Blobs",
    background: "linear-gradient(135deg, #03265E 0%, #131b30 100%)",
    svg: blobs("#B95402", "#F5A623"),
  },
  {
    id: "abstract-halftone",
    family: "abstract",
    label: "Halftone",
    background: "linear-gradient(120deg, #1a2744 0%, #B95402 120%)",
    svg: halftone("#FFFFFF"),
  },
  {
    id: "abstract-bands",
    family: "abstract",
    label: "Diagonal Bands",
    background: "linear-gradient(135deg, #03265E 0%, #1f2e52 100%)",
    svg: diagonalBands("#B95402", "#F5A623"),
  },

  // --- Scenic (4) - all pure CSS/SVG, no photos ---------------------------
  {
    id: "scenic-horizon",
    family: "scenic",
    label: "Horizon",
    background:
      "linear-gradient(180deg, #1a2744 0%, #3a4d80 45%, #F5A62333 100%)",
    svg: horizon(),
  },
  {
    id: "scenic-skyline",
    family: "scenic",
    label: "Skyline",
    background:
      "linear-gradient(180deg, #B95402 0%, #D76202 40%, #1a2744 100%)",
    svg: skyline(),
  },
  {
    id: "scenic-wave",
    family: "scenic",
    label: "Tide",
    background:
      "linear-gradient(180deg, #03265E 0%, #16357a 55%, #B95402 100%)",
    svg: waves(),
  },
  {
    id: "scenic-aurora",
    family: "scenic",
    label: "Northern Lights",
    background: "linear-gradient(180deg, #12100E 0%, #101a33 100%)",
    svg: aurora(),
  },
];

const PRESET_MAP: Record<string, BannerPreset> = Object.fromEntries(
  BANNER_PRESETS.map((p) => [p.id, p])
);

/** Look up a preset by id, falling back to the default. Never returns null. */
export function getBanner(id: string | null | undefined): BannerPreset {
  return (id && PRESET_MAP[id]) || PRESET_MAP[DEFAULT_BANNER];
}

export const BANNER_FAMILIES: { id: BannerFamily; label: string }[] = [
  { id: "gradient", label: "Gradients" },
  { id: "doodle", label: "Doodles" },
  { id: "abstract", label: "Abstract" },
  { id: "scenic", label: "Scenic" },
];
