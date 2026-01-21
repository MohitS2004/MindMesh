'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'
import { Bell, CheckSquare, ChevronLeft, ChevronRight, FileText, Files } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { OrgSwitcher } from '@/components/org-switcher'
import { TenantProvider } from '@/lib/tenant-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Notes', href: '/app/notes', icon: FileText },
  { name: 'Tasks', href: '/app/tasks', icon: CheckSquare },
  { name: 'Files', href: '/app/files', icon: Files },
  { name: 'Reminders', href: '/app/reminders', icon: Bell },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('mindmesh.sidebar.collapsed')
    if (stored) {
      setSidebarCollapsed(stored === 'true')
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('mindmesh.sidebar.collapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className={cn('hidden md:flex md:flex-col', sidebarCollapsed ? 'md:w-16' : 'md:w-64')}>
          <div className="flex flex-col grow border-r border-border bg-card overflow-y-auto">
            <div className={cn('flex items-center shrink-0 border-b border-border', sidebarCollapsed ? 'px-2 py-3 justify-center' : 'px-4 py-4')}>
              <div className={cn('flex items-center gap-2', sidebarCollapsed && 'flex-col gap-1')}>
                <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted text-sm font-semibold">
                  MM
                </div>
                <div className={cn(sidebarCollapsed && 'sr-only')}>
                  <h1 className="text-xl font-bold">MindMesh</h1>
                </div>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                className={cn(sidebarCollapsed ? 'mt-2' : 'ml-auto')}
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
            <nav className={cn('flex-1 py-4 space-y-1', sidebarCollapsed ? 'px-2' : 'px-2')}>
              {navigation.map((item) => {
                const isActive = pathname?.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    title={item.name}
                  >
                    <item.icon
                      className={cn(
                        'mr-3 shrink-0 h-5 w-5',
                        isActive
                          ? 'text-accent-foreground'
                          : 'text-muted-foreground group-hover:text-accent-foreground'
                      )}
                    />
                    <span className={cn(sidebarCollapsed && 'sr-only')}>
                      {item.name}
                    </span>
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-4">
              <OrgSwitcher />
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </TenantProvider>
  )
}
