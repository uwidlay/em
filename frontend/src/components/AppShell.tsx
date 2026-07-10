import { Bell, CalendarDays, LogOut, PanelLeftClose, PanelLeftOpen, Settings, Users } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Tutor } from '../types/domain'

type Props = {
  tutor: Tutor
  pendingReviews: number
  onSignOut: () => Promise<void>
  workspaceModeLabel?: string
  workspaceError?: string | null
  isWorkspaceLoading?: boolean
}

export function AppShell({
  tutor,
  pendingReviews,
  onSignOut,
  workspaceModeLabel = 'MVP на мок-данных',
  workspaceError,
  isWorkspaceLoading = false,
}: Props) {
  const navigate = useNavigate()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  async function handleSignOut() {
    await onSignOut()
    navigate('/login')
  }

  return (
    <div className={`app-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <button className="brand" onClick={() => navigate('/app')} type="button" title="TUTOR-SPACE">
            <span className="brand-mark">TS</span>
            <span className="sidebar-label">
              <strong>TUTOR-SPACE</strong>
              <small>кабинет репетитора</small>
            </span>
          </button>
          <button
            className="icon-button sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            aria-label={isSidebarCollapsed ? 'Развернуть боковую панель' : 'Скрыть боковую панель'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="main-nav" aria-label="Основная навигация">
          <NavLink to="/app" end title="Ученики">
            <Users size={18} />
            <span className="sidebar-label">Ученики</span>
            {pendingReviews > 0 && <span className="nav-badge">{pendingReviews}</span>}
          </NavLink>
          <NavLink to="/app/schedule" title="Расписание">
            <CalendarDays size={18} />
            <span className="sidebar-label">Расписание</span>
          </NavLink>
          <NavLink to="/app/settings" title="Настройки">
            <Settings size={18} />
            <span className="sidebar-label">Настройки</span>
          </NavLink>
        </nav>

        <nav className="mobile-nav" aria-label="Мобильная навигация">
          <NavLink to="/app" end title="Ученики">
            <Users size={18} />
            <span>Ученики</span>
            {pendingReviews > 0 && <span className="nav-badge">{pendingReviews}</span>}
          </NavLink>
          <NavLink to="/app/schedule" title="Расписание">
            <CalendarDays size={18} />
            <span>Расписание</span>
          </NavLink>
          <NavLink to="/app/settings" title="Настройки">
            <Settings size={18} />
            <span>Настройки</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="mini-profile">
            <div className="avatar">{tutor.name.slice(0, 1)}</div>
            <div className="sidebar-label">
              <strong>{tutor.name}</strong>
              <small>{tutor.email}</small>
            </div>
          </div>
          <button className="ghost-button" type="button" onClick={handleSignOut}>
            <LogOut size={17} />
            <span className="sidebar-label">Выйти</span>
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{isWorkspaceLoading ? 'Загружаем данные...' : workspaceModeLabel}</p>
            <h1>Рабочее пространство</h1>
            {workspaceError && <p className="workspace-alert">{workspaceError}</p>}
          </div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Уведомления">
              <Bell size={19} />
              {pendingReviews > 0 && <span className="dot" />}
            </button>
            {pendingReviews > 0 && <span className="updates-pill">Д/З на проверке: {pendingReviews}</span>}
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
