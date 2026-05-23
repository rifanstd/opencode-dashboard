interface ErrorMessageProps {
  message: string
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        background: 'rgba(239, 68, 68, 0.15)',
        color: 'var(--danger)',
        fontSize: 14,
        marginBottom: 16,
        border: '1px solid rgba(239, 68, 68, 0.3)',
      }}
    >
      {message}
    </div>
  )
}
