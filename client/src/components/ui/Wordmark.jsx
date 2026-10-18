// The ReplyFlow mark is a filled answer bubble, as on an exam answer sheet.
export function Mark({ size = 28 }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="16" r="6.6" fill="currentColor" />
    </svg>
  );
}

export default function Wordmark({ size = 'md' }) {
  return (
    <span className={`wordmark wordmark-${size}`}>
      <Mark size={size === 'lg' ? 40 : 24} />
      <span className="wordmark-text">Reply<em>Flow</em></span>
    </span>
  );
}
