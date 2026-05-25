import { XCircle } from 'lucide-react'

interface ErrorMessageProps {
  message: string
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderRadius: 6,
        background: 'var(--bg-secondary)',
        borderLeft: '2px solid var(--danger)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 16,
      }}
    >
      <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
      <span
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 13,
          color: 'var(--danger)',
        }}
      >
        {message}
      </span>
    </div>
  )
}
