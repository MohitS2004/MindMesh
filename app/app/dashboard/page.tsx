import { createClient } from "@/lib/supabase/server"
import { FileText, CheckSquare, Upload, MessageSquare } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="container py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome to your Second Brain
            </h1>
            <p className="text-lg text-muted-foreground mt-2">
              Your knowledge hub is ready. Start capturing and organizing your thoughts.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <DashboardCard
              icon={<FileText className="h-8 w-8" />}
              title="Notes"
              description="Create and organize your notes"
              href="/app/notes"
            />
            <DashboardCard
              icon={<CheckSquare className="h-8 w-8" />}
              title="Tasks"
              description="Manage your to-dos and projects"
              href="/app/tasks"
            />
            <DashboardCard
              icon={<Upload className="h-8 w-8" />}
              title="Files"
              description="Store and organize your files"
              href="/app/files"
            />
            <DashboardCard
              icon={<MessageSquare className="h-8 w-8" />}
              title="AI Chat"
              description="Ask questions about your data"
              href="/app/chat"
            />
          </div>

          <div className="border rounded-lg p-8 bg-muted/50">
            <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
            <div className="space-y-3 text-muted-foreground">
              <p>🎉 Your account is set up and ready to go!</p>
              <p>📝 Create your first note to capture an idea</p>
              <p>✅ Add a task to track what you need to do</p>
              <p>🤖 Chat with AI to search and analyze your knowledge</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function DashboardCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border p-6 transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-col gap-3">
        <div className="text-primary">{icon}</div>
        <div>
          <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  )
}
