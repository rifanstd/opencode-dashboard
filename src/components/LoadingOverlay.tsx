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
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.95)',
        zIndex: 9998,
      }}
    >
      <div
        style={{
          width: 400,
          maxWidth: '90vw',
          padding: 32,
          borderRadius: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}
      >
        <h2 style={{ marginBottom: 8, fontSize: 18 }}>{message}</h2>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto',
          }}
        />
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
