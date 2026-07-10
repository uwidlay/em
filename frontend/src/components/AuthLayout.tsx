import { Link, Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="auth-brand" to="/login">
          <span className="brand-mark">TS</span>
          <span>TUTOR-SPACE</span>
        </Link>
        <Outlet />
      </section>
    </main>
  )
}
