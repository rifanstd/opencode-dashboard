import { Component, type ReactNode } from 'react'
import ErrorMessage from './ErrorMessage.tsx'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
          }}
        >
          <ErrorMessage message={this.state.error?.message ?? 'An unexpected error occurred.'} />
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
