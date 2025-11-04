"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Loader2, User, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/sign-in')
        return
      }

      setEmail(user.email || '')

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .maybeSingle()

      let profile = profileData

      // If no profile exists, create one
      if (!profile && !error) {
        const defaultUsername = user.email?.split('@')[0] || 'user'
        
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            username: defaultUsername,
            full_name: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        profile = newProfile
      }

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (profile) {
        setUsername(profile.username || '')
        setFullName(profile.full_name || '')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessage({ type: "error", text: message })
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  async function updateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('No user found')

      const updateData = {
        username: username.trim(),
        full_name: fullName.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()

      if (error) {
        throw error
      }

      setMessage({ type: "success", text: "Profile updated successfully! Redirecting..." })
      
      // Wait a moment then reload
      setTimeout(() => {
        // Use replace instead of href to avoid history entry
        window.location.replace('/app/dashboard')
      }, 1000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setMessage({ 
        type: "error", 
        text: message.includes('duplicate') 
          ? "Username already taken. Please choose another." 
          : message 
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Back Button */}
      <div className="border-b">
        <div className="container px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
            <Link 
              href="/app/dashboard"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account information and preferences
            </p>
          </div>

          <div className="max-w-2xl bg-card border rounded-lg p-6 sm:p-8 shadow-sm">
            <form onSubmit={updateProfile} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Email address cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    pattern="[a-zA-Z0-9_-]+"
                    minLength={3}
                    maxLength={20}
                    placeholder="yourusername"
                    className="w-full pl-10 pr-4 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  3-20 characters • Only letters, numbers, dash (-) and underscore (_)
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={50}
                  placeholder="John Doe"
                  className="w-full px-4 py-2.5 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
                <p className="text-xs text-muted-foreground">
                  Optional • How you’d like to be addressed
                </p>
              </div>

              {message && (
                <div
                  className={`p-4 rounded-md text-sm ${
                    message.type === "success"
                      ? "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={saving || !username.trim()} className="min-w-[140px]">
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/app/dashboard')}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
