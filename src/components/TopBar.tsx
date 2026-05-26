import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Terminal, RefreshCw, Menu, X } from 'lucide-react'
import { useAppStore } from '../stores/appStore.ts'
import { formatNumber, formatCost } from '../utils/costCalculator.ts'

interface QuickStats {
  totalSessions: number
  totalTokens: number
  totalCost: number
}

interface TopBarProps {
  onSync: () => void
  quickStats?: QuickStats | null
}

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/providers-models', label: 'Providers & Models', aliases: ['/providers', '/models'] },
  { to: '/agents', label: 'Agents' },
  { to: '/skills', label: 'Skills' },
]

export default function TopBar({ onSync, quickStats }: TopBarProps) {
  const isSyncing = useAppStore((s) => s.isSyncing)
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showPulse, setShowPulse] = useState(false)
  const prevSyncing = useRef(isSyncing)

  useEffect(() => {
    if (prevSyncing.current && !isSyncing) {
      setShowPulse(true)
      const t = setTimeout(() => setShowPulse(false), 350)
      return () => clearTimeout(t)
    }
    prevSyncing.current = isSyncing
  }, [isSyncing])

  function isActive(path: string, aliases?: string[]): boolean {
    if (location.pathname === path) return true
    if (aliases) return aliases.includes(location.pathname)
    return false
  }

  const tooltipText = quickStats
    ? `Sessions: ${formatNumber(quickStats.totalSessions)} · Tokens: ${formatNumber(quickStats.totalTokens)} · Cost: ${formatCost(quickStats.totalCost)}`
    : 'Loading overview data…'

  return (
    <header
      style={{
        height: 48,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Brand */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textDecoration: 'none',
          flexShrink: 0,
        }}
      >
        <Terminal size={18} style={{ color: 'var(--text-primary)' }} />
        <span
          style={{
            fontFamily: 'var(--sans)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Opencode
        </span>
      </Link>

      {/* Divider */}
      <div
        style={{
          width: 1,
          height: 20,
          background: 'var(--border)',
          margin: '0 12px',
          flexShrink: 0,
        }}
      />

      {/* Desktop Nav */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
        }}
        className="topbar-nav"
      >
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              fontWeight: 500,
              color: isActive(item.to, item.aliases) ? 'var(--text-primary)' : 'var(--text-secondary)',
              textDecoration: 'none',
              padding: '12px 8px',
              borderBottom: isActive(item.to, item.aliases) ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 150ms, border-color 150ms',
              display: 'block',
            }}
            onMouseEnter={(e) => {
              if (!isActive(item.to, item.aliases)) {
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.to, item.aliases)) {
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Quick Stats — desktop (all 3 metrics) */}
      <span
        className="topbar-stats-desktop"
        title={tooltipText}
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          marginRight: 12,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {quickStats
          ? `${formatNumber(quickStats.totalSessions)} · ${formatNumber(quickStats.totalTokens)} · ${formatCost(quickStats.totalCost)}`
          : '— · — · —'}
      </span>

      {/* Quick Stats — mobile (sessions only) */}
      <span
        className="topbar-stats-mobile"
        title={tooltipText}
        style={{
          display: 'none',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: 'var(--text-muted)',
          marginRight: 8,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {quickStats
          ? formatNumber(quickStats.totalSessions)
          : '—'}
      </span>

      {/* Sync Button */}
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 28,
          padding: '6px 10px',
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: isSyncing ? 'var(--text-muted)' : 'var(--text-secondary)',
          fontFamily: 'var(--sans)',
          fontSize: 12,
          cursor: isSyncing ? 'not-allowed' : 'pointer',
          opacity: isSyncing ? 0.7 : 1,
          transition: 'color 150ms, background 150ms',
          animation: showPulse ? 'syncPulse 300ms ease' : undefined,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isSyncing) {
            e.currentTarget.style.background = 'var(--bg-tertiary)'
            e.currentTarget.style.color = 'var(--text-primary)'
          }
        }}
        onMouseLeave={(e) => {
          if (!isSyncing) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-secondary)'
          }
        }}
      >
        <RefreshCw
          size={14}
          style={{
            animation: isSyncing ? 'spin 1s linear infinite' : undefined,
          }}
        />
        {isSyncing ? 'Syncing…' : 'Sync'}
      </button>

      {/* Hamburger — mobile */}
      <button
        type="button"
        className="topbar-hamburger"
        onClick={() => setMenuOpen(!menuOpen)}
        style={{
          display: 'none',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '4px 6px',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          flexShrink: 0,
          marginLeft: 8,
        }}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile Nav Dropdown */}
      {menuOpen && (
        <div
          className="topbar-mobile-menu"
          style={{
            position: 'fixed',
            top: 48,
            left: 0,
            right: 0,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            padding: '8px 0',
            zIndex: 20,
          }}
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 13,
                fontWeight: 500,
                color: isActive(item.to, item.aliases) ? 'var(--text-primary)' : 'var(--text-secondary)',
                textDecoration: 'none',
                padding: '10px 20px',
                borderLeft: isActive(item.to, item.aliases) ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'color 150ms',
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .topbar-nav { display: none !important; }
          .topbar-stats-desktop { display: none !important; }
          .topbar-stats-mobile { display: inline !important; }
          .topbar-hamburger { display: flex !important; }
        }
        @media (min-width: 769px) {
          .topbar-mobile-menu { display: none !important; }
        }
      `}</style>
    </header>
  )
}
