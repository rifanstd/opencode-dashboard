import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Box } from 'lucide-react'
import { loadProviders, loadModels } from '../utils/dataLoader.ts'
import ErrorMessage from '../components/ErrorMessage.tsx'
import type { ProviderInfo, ModelInfo } from '../types/index.ts'

export default function Resources() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true)
        setError(null)
        const [prov, mod] = await Promise.all([loadProviders(), loadModels()])
        setProviders(Array.isArray(prov) ? prov : [])
        setModels(Array.isArray(mod) ? mod : [])
        if (Array.isArray(prov)) {
          setExpanded(new Set(prov.map((p) => p.id)))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const modelsByProvider: Record<string, ModelInfo[]> = {}
  for (const m of models) {
    const pid = m.provider
    if (!modelsByProvider[pid]) modelsByProvider[pid] = []
    modelsByProvider[pid].push(m)
  }

  function toggleProvider(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--sans)' }}>Loading resources…</span>
      </div>
    )
  }

  return (
    <div>
      <h1
        style={{
          fontFamily: 'var(--sans)',
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 20,
        }}
      >
        Providers &amp; Models
      </h1>
      {error && <ErrorMessage message={error} />}
      {providers.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 40, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--text-muted)' }}>
          No providers configured
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {providers.map((provider) => {
          const isExpanded = expanded.has(provider.id)
          const providerModels = modelsByProvider[provider.id] ?? []
          const headerRadius: React.CSSProperties = {
            borderTopLeftRadius: 6,
            borderTopRightRadius: 6,
            borderBottomLeftRadius: isExpanded ? 0 : 6,
            borderBottomRightRadius: isExpanded ? 0 : 6,
          }

          return (
            <div key={provider.id}>
              {/* Provider Header */}
              <div
                onClick={() => toggleProvider(provider.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  gap: 8,
                  userSelect: 'none',
                  transition: 'background 100ms',
                  ...headerRadius,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 16,
                    height: 16,
                    color: 'var(--text-muted)',
                    transition: 'transform 150ms',
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 15,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    flex: 1,
                  }}
                >
                  {provider.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: provider.configured ? 'rgba(63,185,80,0.15)' : 'rgba(72,79,88,0.15)',
                    color: provider.configured ? 'var(--success)' : 'var(--text-muted)',
                  }}
                >
                  {provider.configured ? 'Configured' : 'Not configured'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginLeft: 8,
                  }}
                >
                  {providerModels.length} {providerModels.length === 1 ? 'model' : 'models'}
                </span>
              </div>

              {/* Models List */}
              {isExpanded && (
                <div
                  style={{
                    borderBottom: '1px solid var(--border)',
                    borderLeft: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    borderBottomLeftRadius: 6,
                    borderBottomRightRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  {providerModels.length === 0 ? (
                    <div
                      style={{
                        padding: '16px',
                        paddingLeft: 44,
                        fontFamily: 'var(--sans)',
                        fontSize: 13,
                        color: 'var(--text-muted)',
                      }}
                    >
                      No models for this provider
                    </div>
                  ) : (
                    providerModels.map((model) => {
                      const inputPrice = model.input_price ? `$${model.input_price.toFixed(2)}/Mt input` : null
                      const outputPrice = model.output_price ? `$${model.output_price.toFixed(2)}/Mt output` : null
                      const ctx = model.context_window ? `${(model.context_window / 1000).toFixed(0)}K ctx` : null
                      const pricingParts = [inputPrice, outputPrice, ctx].filter(Boolean).join(' · ')

                      return (
                        <div
                          key={model.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 16px',
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 100ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(88,166,255,0.04)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <Box size={14} style={{ color: 'var(--text-muted)', marginRight: 12, flexShrink: 0 }} />
                          <span
                            style={{
                              fontFamily: 'var(--sans)',
                              fontSize: 13,
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              marginRight: 12,
                              flexShrink: 0,
                            }}
                          >
                            {model.name}
                          </span>
                          <span
                            style={{
                              fontFamily: 'var(--mono)',
                              fontSize: 12,
                              color: 'var(--text-muted)',
                              flex: 1,
                            }}
                          >
                            {pricingParts}
                          </span>
                          {model.capabilities.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {model.capabilities.slice(0, 4).map((cap) => (
                                <span
                                  key={cap}
                                  style={{
                                    fontFamily: 'var(--sans)',
                                    fontSize: 10,
                                    color: 'var(--text-muted)',
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    borderRadius: 999,
                                    padding: '1px 8px',
                                  }}
                                >
                                  {cap}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
