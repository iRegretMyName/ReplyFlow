// The login artwork: an exam answer (OMR) sheet, the bubble sheet every JEE and NEET
// student fills in, with one line of answers tracing a path down the page. Drawn in
// SVG so there is no image to download and nothing to break offline.
const OPTIONS = ['A', 'B', 'C', 'D'];
const ROWS = 16;
const ANSWERS_A = [1, 2, 3, 2, 1, 0, 1, 2, 3, 3, 2, 1, 0, 1, 2, 2];
const ANSWERS_B = [3, 1, 0, 2, 2, 3, 1, 0, 0, 2, 3, 1, 2, 1, 0, 3];

const ROW_Y = (i) => 148 + i * 38;
const BLOCKS = [
  { numX: 66, firstX: 116, step: 42, start: 1, answers: ANSWERS_A, path: true },
  { numX: 336, firstX: 386, step: 42, start: 17, answers: ANSWERS_B, path: false },
];

export default function OmrArt({ align = 'xMaxYMin' }) {
  let fillIndex = 0;
  const pathPoints = BLOCKS[0].answers
    .map((a, i) => `${BLOCKS[0].firstX + a * BLOCKS[0].step},${ROW_Y(i)}`)
    .join(' ');

  return (
    <svg className="omr" viewBox="0 0 640 780" preserveAspectRatio={`${align} slice`} aria-hidden="true" focusable="false">
      <rect className="omr-sheet" x="20" y="24" width="600" height="740" rx="10" />
      <text className="omr-title" x="48" y="62">ANSWER SHEET</text>
      <text className="omr-title omr-title-r" x="592" y="62">SET A</text>
      <line className="omr-rule" x1="48" y1="78" x2="592" y2="78" />

      {BLOCKS.map((b, bi) => (
        <g key={bi}>
          {OPTIONS.map((o, c) => (
            <text key={o} className="omr-col" x={b.firstX + c * b.step} y="118" textAnchor="middle">{o}</text>
          ))}
          {Array.from({ length: ROWS }, (_, i) => (
            <g key={i}>
              <text className="omr-num" x={b.numX} y={ROW_Y(i) + 4} textAnchor="end">{String(b.start + i).padStart(2, '0')}</text>
              {OPTIONS.map((o, c) => {
                const filled = b.answers[i] === c;
                const style = filled ? { '--i': fillIndex++ } : undefined;
                return (
                  <circle
                    key={o}
                    className={filled ? 'omr-bubble omr-filled' : 'omr-bubble'}
                    cx={b.firstX + c * b.step}
                    cy={ROW_Y(i)}
                    r="11"
                    style={style}
                  />
                );
              })}
            </g>
          ))}
        </g>
      ))}

      <polyline className="omr-path" points={pathPoints} pathLength="1" />
    </svg>
  );
}
