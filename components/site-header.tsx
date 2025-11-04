"use client"

import Link from "next/link"
import { Brain } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
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
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  )
}
