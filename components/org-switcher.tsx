'use client'

import { useState, useEffect, useTransition } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useTenant } from '@/lib/tenant-context'
import { getUserMemberships, createOrganization } from '@/lib/actions/org'
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
    const { data, error } = await getUserMemberships()
    if (data && Array.isArray(data)) {
      const validData = data.filter(m => m.tenants && !Array.isArray(m.tenants))
      setMemberships(validData as unknown as Membership[])
      if (!currentTenantId && validData.length > 0) {
        const firstTenant = (validData[0].tenants as any)
        if (firstTenant?.id) {
          setCurrentTenantId(firstTenant.id)
        }
      }
    }
  }

  const currentOrg = memberships.find(
    m => m.tenants?.id === currentTenantId
  )?.tenants

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
            {currentOrg?.name || 'Select organization'}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {memberships.map((membership) => (
            membership.tenants && (
              <DropdownMenuItem
                key={membership.tenant_id}
                onSelect={() => setCurrentTenantId(membership.tenants!.id)}
              >
                <Check
                  className={`mr-2 h-4 w-4 ${
                    currentTenantId === membership.tenants.id
                      ? 'opacity-100'
                      : 'opacity-0'
                  }`}
                />
                {membership.tenants.name}
              </DropdownMenuItem>
            )
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to collaborate with your team.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="My Organization"
                  required
                  minLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug (optional)</Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="my-organization"
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
