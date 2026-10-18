// The picture for a course: the uploaded image when there is one; otherwise a small answer-sheet
// pattern generated from the course name, so every course has its own look in the same brand style.
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const label = (name) => (name.length <= 11 ? name : name.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase());

function Generated({ course }) {
  const h = hash(course.name);
  const rand = rng(h);
  const COLS = 4; const ROWS = 6;
  const answers = Array.from({ length: ROWS }, () => Math.floor(rand() * COLS));
  const cx = (c) => 150 + c * 34; const cy = (r) => 58 + r * 26;
  const pts = answers.map((a, r) => `${cx(a)},${cy(r)}`).join(' ');
  return (
    <svg className={`cover-art cv-${h % 3}`} viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect className="cv-bg" width="300" height="200" />
      <text className="cv-meta" x="20" y="30">{course.class ? `CLASS ${course.class}` : 'COURSE'}</text>
      {Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (
        <circle key={`${r}-${c}`} className={answers[r] === c ? 'cv-dot cv-on' : 'cv-dot'} cx={cx(c)} cy={cy(r)} r="9" />
      )))}
      <polyline className="cv-line" points={pts} />
      <text className="cv-name" x="20" y="176">{label(course.name)}</text>
    </svg>
  );
}

export default function CourseCover({ course, eager = false }) {
  return (
    <div className="cover">
      {course.image
        ? <img className="cover-img" src={course.image} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" width="600" height="400" />
        : <Generated course={course} />}
    </div>
  );
}
