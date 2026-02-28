import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppShell() {
  return (
    <div className="min-h-screen bg-bg-base">
      <Sidebar />
      {/* Main content — offset by sidebar width on desktop */}
      <main className="md:ml-64 min-h-screen">
        <div className="px-5 md:px-10 py-8 pb-10 max-w-[1200px]">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
