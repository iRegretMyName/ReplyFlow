import Icon from './Icon.jsx';

export function Spinner({ label }) {
  return (
    <span className="spinner" role={label ? 'status' : undefined} aria-label={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".25" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// Placeholder rows shown while a list loads, shaped like the content that will replace them.
export function SkeletonRows({ rows = 5 }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <span className="skeleton skeleton-dot" />
          <span className="skeleton skeleton-line" style={{ width: `${48 + ((i * 17) % 34)}%` }} />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children, action }) {
  return (
    <div className="state state-empty">
      <Icon name={icon} size={22} />
      <p className="state-title">{title}</p>
      {children && <p className="state-body">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <Icon name="alert" size={22} />
      <p className="state-title">Something didn't load</p>
      <p className="state-body">{message}</p>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function InlineError({ id, children }) {
  if (!children) return null;
  return (
    <p className="field-error" id={id} role="alert">
      <Icon name="alert" size={15} />
      <span>{children}</span>
    </p>
  );
}
