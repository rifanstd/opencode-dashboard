import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/tokens', label: 'Token Usage' },
  { to: '/sessions', label: 'Sessions' },
  { to: '/providers', label: 'Providers' },
  { to: '/models', label: 'Models' },
  { to: '/agents', label: 'Agents' },
  { to: '/skills', label: 'Skills' },
  { to: '/logs', label: 'Logs' },
]

export default function Sidebar() {
  return (
    <nav
      style={{
        width: 200,
        minWidth: 200,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        padding: '24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          padding: '0 20px 20px',
          fontWeight: 600,
          fontSize: 18,
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 12,
        }}
      >
        Opencode
      </div>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          style={({ isActive }) => ({
            display: 'block',
            padding: '10px 20px',
            color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
            background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: isActive ? 500 : 400,
            borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
            transition: 'all 0.15s ease',
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
