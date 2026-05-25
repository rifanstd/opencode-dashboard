interface LoadingOverlayProps {
  message?: string
}

export default function LoadingOverlay({ message = 'Loading…' }: LoadingOverlayProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13, 17, 23, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 50,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}
      >
        {message}
      </span>
    </div>
  )
}
