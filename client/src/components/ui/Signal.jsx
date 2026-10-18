// Lead temperature, shown as three ascending bars (hot = 3, warm = 2, cold = 1) plus a
// word. It uses the single brand colour and the shape carries the meaning, so it still
// reads for anyone who cannot tell colours apart.
const LEVEL = { hot: 3, warm: 2, cold: 1 };

export function Signal({ level, showLabel = false }) {
  const n = LEVEL[level] || 0;
  return (
    <span className="signal-wrap">
      <span className="signal" role={showLabel ? undefined : 'img'} aria-label={showLabel ? undefined : `${level || 'unknown'} lead`} aria-hidden={showLabel ? 'true' : undefined}>
        {[1, 2, 3].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
      </span>
      {showLabel && <span className="signal-label">{level}</span>}
    </span>
  );
}

export function StatusTag({ status }) {
  return <span className={`tag tag-${status}`}>{status}</span>;
}
