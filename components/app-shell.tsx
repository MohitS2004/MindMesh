'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, CheckSquare, Files, Bell, MessageSquare } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { OrgSwitcher } from '@/components/org-switcher'
import { TenantProvider } from '@/lib/tenant-context'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Notes', href: '/app/notes', icon: FileText },
  { name: 'Tasks', href: '/app/tasks', icon: CheckSquare },
  { name: 'Files', href: '/app/files', icon: Files },
  { name: 'Reminders', href: '/app/reminders', icon: Bell },
  { name: 'Chat', href: '/app/chat', icon: MessageSquare },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex md:w-64 md:flex-col">
          <div className="flex flex-col grow border-r border-border bg-card overflow-y-auto">
            <div className="flex items-center shrink-0 px-4 py-4 border-b border-border">
              <h1 className="text-xl font-bold">MindMesh</h1>
            </div>
            <nav className="flex-1 px-2 py-4 space-y-1">
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
                  >
                    <item.icon
                      className={cn(
                        'mr-3 shrink-0 h-5 w-5',
                        isActive
                          ? 'text-accent-foreground'
                          : 'text-muted-foreground group-hover:text-accent-foreground'
                      )}
                    />
                    {item.name}
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
