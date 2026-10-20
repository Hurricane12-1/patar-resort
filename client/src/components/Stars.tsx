export default function Stars({ value = 0, onChange, size = 15 }) {
  return (
    <span className={`stars ${onChange ? 'interactive' : ''}`} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i
          key={n}
          className="fas fa-star"
          onClick={onChange ? () => onChange(n) : undefined}
          style={{
            fontSize: `${size}px`,
            color: n <= Math.round(value) ? '#F59E0B' : 'rgba(255, 255, 255, 0.25)',
            cursor: onChange ? 'pointer' : 'default',
            transition: 'color 0.15s ease',
          }}
        />
      ))}
    </span>
  );
}
