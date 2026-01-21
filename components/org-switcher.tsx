'use client'

import { useState, useEffect, useTransition } from 'react'
import { Check, ChevronsUpDown, Plus, User, Users } from 'lucide-react'
import { useTenant } from '@/lib/tenant-context'
import { getUserMemberships, createOrganization, ensurePersonalWorkspace } from '@/lib/actions/org'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Tenant {
  id: string
  name: string
  slug: string | null
  is_personal?: boolean
}

interface Membership {
  tenant_id: string
  role: string
  tenants: Tenant
}

export function OrgSwitcher() {
  const { currentTenantId, setCurrentTenantId } = useTenant()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMemberships()
  }, [])

  const loadMemberships = async () => {
    // Ensure personal workspace exists first
    await ensurePersonalWorkspace()
    
    const { data, error } = await getUserMemberships()
    
    if (data && Array.isArray(data)) {
      const validData = data.filter(m => m.tenants && !Array.isArray(m.tenants))
      
      // Sort: personal workspace first, then alphabetically
      const sorted = (validData as unknown as Membership[]).sort((a, b) => {
        if (a.tenants?.is_personal && !b.tenants?.is_personal) return -1
        if (!a.tenants?.is_personal && b.tenants?.is_personal) return 1
        return (a.tenants?.name || '').localeCompare(b.tenants?.name || '')
      })
      
      setMemberships(sorted)
      
      // Auto-select personal workspace if nothing selected
      if (!currentTenantId && sorted.length > 0) {
        const personal = sorted.find(m => m.tenants?.is_personal)
        const firstTenant = personal?.tenants || sorted[0].tenants
        if (firstTenant?.id) {
          setCurrentTenantId(firstTenant.id)
        }
      }
    }
  }

  const currentOrg = memberships.find(
    m => m.tenants?.id === currentTenantId
  )?.tenants

  // Separate personal and shared workspaces
  const personalWorkspace = memberships.find(m => m.tenants?.is_personal)
  const sharedWorkspaces = memberships.filter(m => !m.tenants?.is_personal)

  const handleCreateOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const { data, error } = await createOrganization(formData)
      if (error) {
        setError(error)
      } else if (data) {
        setIsCreateDialogOpen(false)
        await loadMemberships()
        setCurrentTenantId(data.id)
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            <span className="flex items-center gap-2 truncate">
              {currentOrg?.is_personal ? (
                <User className="h-4 w-4 text-blue-500 shrink-0" />
              ) : (
                <Users className="h-4 w-4 text-green-500 shrink-0" />
              )}
              <span className="truncate">{currentOrg?.name || 'Select workspace'}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[220px]">
          {/* Personal Workspace */}
          {personalWorkspace && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Personal</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => setCurrentTenantId(personalWorkspace.tenants.id)}
              >
                <User className="mr-2 h-4 w-4 text-blue-500" />
                <span className="flex-1 truncate">{personalWorkspace.tenants.name}</span>
                {currentTenantId === personalWorkspace.tenants.id && (
                  <Check className="ml-2 h-4 w-4" />
                )}
              </DropdownMenuItem>
            </>
          )}
          
          {/* Shared Workspaces */}
          {sharedWorkspaces.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Shared Workspaces</DropdownMenuLabel>
              {sharedWorkspaces.map((membership) => (
                membership.tenants && (
                  <DropdownMenuItem
                    key={membership.tenant_id}
                    onSelect={() => setCurrentTenantId(membership.tenants!.id)}
                  >
                    <Users className="mr-2 h-4 w-4 text-green-500" />
                    <span className="flex-1 truncate">{membership.tenants.name}</span>
                    {currentTenantId === membership.tenants.id && (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                )
              ))}
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Shared Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle>Create Shared Workspace</DialogTitle>
              <DialogDescription>
                Create a workspace to share notes and tasks with your team or collaborators.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Workspace Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Project Alpha"
                  required
                  minLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug (optional)</Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="project-alpha"
                  pattern="[a-z0-9-]+"
                />
                <p className="text-xs text-muted-foreground">
                  URL-friendly identifier (auto-generated if left blank)
                </p>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
