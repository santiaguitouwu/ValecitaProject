import { useRef, useEffect } from 'react';

// ── Heart path helper ─────────────────────────────────────────────────────────
// Generates a cubic-bezier heart SVG path centered at (cx, cy) with radius r.
function hp(cx, cy, r) {
  const x = (dx) => (cx + r * dx).toFixed(2);
  const y = (dy) => (cy + r * dy).toFixed(2);
  return [
    `M${x(0)},${y(0.55)}`,
    `C${x(-0.1)},${y(0.38)} ${x(-0.65)},${y(0.15)} ${x(-0.65)},${y(-0.12)}`,
    `C${x(-0.65)},${y(-0.52)} ${x(-0.32)},${y(-0.64)} ${x(0)},${y(-0.38)}`,
    `C${x(0.32)},${y(-0.64)} ${x(0.65)},${y(-0.52)} ${x(0.65)},${y(-0.12)}`,
    `C${x(0.65)},${y(0.15)} ${x(0.1)},${y(0.38)} ${x(0)},${y(0.55)}Z`,
  ].join(' ');
}

// Normalized heart path for the falling SVG hearts (viewBox -7 -7 14 13)
const FALL_HEART = 'M0,5 C-1,3.5 -6.5,1 -6.5,-1.8 C-6.5,-5 -3,-6.5 0,-3.8 C3,-6.5 6.5,-5 6.5,-1.8 C6.5,1 1,3.5 0,5 Z';

const COLORS = ['#FF6B8A', '#E84A6F', '#FF9EAD', '#FFB0C0', '#FF8FA3', '#FF7AA0', '#F2B8C0'];

// ── Branch definitions ────────────────────────────────────────────────────────
// [path_d, strokeWidth, animDelay_s, animDuration_s]
const BRANCHES = [
  // center vertical
  ['M170,192 C169,162 168,128 169,94',       11, 0.40, 0.80],
  // left and right mains
  ['M169,164 C138,147 108,124 82,102',         9, 0.88, 0.68],
  ['M171,164 C202,147 232,124 258,102',        9, 0.94, 0.68],
  // left secondaries
  ['M86,106 C68,88 54,70 44,54',              6, 1.38, 0.52],
  ['M99,118 C87,100 82,82 78,65',             5, 1.46, 0.46],
  // right secondaries
  ['M254,106 C272,88 286,70 296,54',          6, 1.38, 0.52],
  ['M241,118 C253,100 258,82 262,65',         5, 1.46, 0.46],
  // top-left, top-right, top-center
  ['M169,96 C152,78 139,61 129,45',           5, 1.68, 0.46],
  ['M170,96 C187,78 200,61 210,45',           5, 1.73, 0.46],
  ['M170,96 C169,74 169,54 170,36',           5, 1.78, 0.42],
  // tiny twigs — left
  ['M44,56 C36,44 32,33 30,22',              3, 2.00, 0.34],
  ['M78,67 C70,55 67,44 66,33',              3, 2.05, 0.32],
  ['M129,47 C121,35 118,25 118,14',          3, 2.10, 0.30],
  // tiny twigs — right
  ['M296,56 C304,44 308,33 310,22',          3, 2.00, 0.34],
  ['M262,67 C270,55 273,44 274,33',          3, 2.05, 0.32],
  ['M210,47 C218,35 221,25 221,14',          3, 2.10, 0.30],
  // top-center twigs
  ['M170,38 C164,26 162,15 163,5',           3, 2.16, 0.28],
  ['M170,38 C176,26 178,15 177,5',           3, 2.16, 0.28],
];

// ── Leaf hearts ───────────────────────────────────────────────────────────────
// [cx, cy, r, colorIdx, delay_s]
const LEAVES = [
  // top-center twigs
  [163, 3, 11, 0, 2.52], [177, 3, 11, 1, 2.54],
  [170, 34, 9,  2, 2.62],
  // top branches
  [118, 12, 13, 3, 2.58], [221, 12, 13, 4, 2.60],
  [129, 43, 14, 0, 2.56], [210, 43, 14, 1, 2.58],
  // tiny twig tips — left
  [30, 20, 13,  2, 2.46], [66, 31, 11,  3, 2.62], [78, 63, 12,  4, 2.64],
  // tiny twig tips — right
  [310, 20, 13, 0, 2.48], [274, 31, 11, 1, 2.64], [262, 63, 12, 2, 2.66],
  // secondary tips
  [44, 52, 17, 3, 2.44], [296, 52, 17, 4, 2.46],
  // secondary mid
  [60, 78, 12, 0, 2.68], [280, 78, 12, 1, 2.70],
  // left/right main branch area
  [82, 100, 12, 2, 2.74], [258, 100, 12, 3, 2.76],
  [100, 116, 11, 4, 2.78], [240, 116, 11, 0, 2.80],
  // canopy fill — upper
  [140, 56, 10, 1, 2.82], [200, 56, 10, 2, 2.84],
  [115, 62, 10, 3, 2.86], [225, 62, 10, 4, 2.88],
  [150, 74, 10, 0, 2.90], [190, 74, 10, 1, 2.92],
  // canopy fill — mid
  [135, 86, 9,  2, 2.94], [205, 86, 9,  3, 2.96],
  [58,  84, 10, 4, 2.98], [282, 84, 10, 0, 3.00],
  [92,  98, 9,  1, 3.02], [248, 98, 9,  2, 3.04],
  [160, 92, 10, 3, 3.06], [170, 62, 9,  4, 3.08],
  // lower canopy
  [160, 108, 9, 0, 3.12], [152, 48, 8, 1, 3.14], [188, 48, 8, 2, 3.16],
];

// ── Falling hearts (generated once at module load) ────────────────────────────
const FALLERS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  left: 4 + Math.random() * 92,
  delay: (-(Math.random() * 16)).toFixed(2),
  dur: (8 + Math.random() * 8).toFixed(2),
  size: Math.round(9 + Math.random() * 13),
  color: COLORS[i % COLORS.length],
}));

// ── Component ─────────────────────────────────────────────────────────────────
export default function HeartTree() {
  const branchRefs = useRef([]);

  useEffect(() => {
    // Set stroke-dasharray to actual path length so animation draws correctly
    branchRefs.current.forEach((el, i) => {
      if (!el) return;
      const [, , delay, dur] = BRANCHES[i];
      const len = el.getTotalLength();
      el.style.strokeDasharray = len;
      el.style.strokeDashoffset = len;
      el.style.opacity = '1';
      el.style.animation = `drawBranch ${dur}s ease-out ${delay}s both`;
    });
  }, []);

  return (
    <div style={{ position: 'relative', margin: '10px -18px 0', overflow: 'hidden' }}>

      {/* Falling hearts overlay */}
      {FALLERS.map(f => (
        <svg
          key={f.id}
          viewBox="-7 -7 14 13"
          width={f.size * 2}
          height={f.size * 2}
          style={{
            position: 'absolute',
            left: `${f.left}%`,
            top: -f.size,
            pointerEvents: 'none',
            overflow: 'visible',
            animation: `leafFall ${f.dur}s ease-in ${f.delay}s infinite`,
          }}
        >
          <path d={FALL_HEART} fill={f.color} />
        </svg>
      ))}

      {/* Tree SVG */}
      <svg
        viewBox="0 0 340 268"
        style={{ width: '100%', display: 'block', position: 'relative', zIndex: 2 }}
      >
        {/* Trunk — grows upward from the ground */}
        <rect
          x="163" y="192" width="14" height="76" rx="6"
          fill="#8B6347"
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center bottom',
            animation: 'trunkGrow 0.5s ease-out 0s both',
          }}
        />

        {/* Branches — each drawn sequentially via stroke-dashoffset */}
        {BRANCHES.map(([d, sw], i) => (
          <path
            key={i}
            ref={el => { branchRefs.current[i] = el; }}
            d={d}
            stroke="#8B6347"
            strokeWidth={sw}
            fill="none"
            strokeLinecap="round"
            style={{ opacity: 0 }}
          />
        ))}

        {/* Leaf hearts — pop in after their parent branch is drawn */}
        {LEAVES.map(([cx, cy, r, ci, delay], i) => (
          <path
            key={i}
            d={hp(cx, cy, r)}
            fill={COLORS[ci]}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: `leafPop 0.45s cubic-bezier(.2,1.4,.4,1) ${delay}s both`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
