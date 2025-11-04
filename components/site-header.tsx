import Link from "next/link"
import { Brain, User } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { SignOutButton } from "@/components/sign-out-button"
import { unstable_noStore as noStore } from 'next/cache'

export async function SiteHeader() {
  noStore() // Prevent caching of this component
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch profile if user is logged in
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    profile = data
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 flex h-14 max-w-screen-2xl items-center">
        <div className="flex">
          <Link href="/" className="flex items-center space-x-2">
            <Brain className="h-6 w-6" />
            <span className="font-bold text-xl">MindMesh</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-3">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/app/profile">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors cursor-pointer">
                    <User className="h-4 w-4" />
                    <span className="text-sm hidden sm:inline-block">
                      {profile?.username || user.email?.split('@')[0] || 'User'}
                    </span>
                  </div>
                </Link>
                <SignOutButton />
              </>
            ) : (
              <Button asChild variant="ghost">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
