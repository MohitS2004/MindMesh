'use client'

import * as React from 'react'
import { Bell, CalendarClock, Loader2, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { TagPicker, TagList } from '@/components/tag-picker'
import { AiChatFab } from '@/components/ai-chat-fab'
import { useTenant } from '@/lib/tenant-context'
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  type Reminder
} from '@/lib/actions/reminders'
import { getItemTags, type Tag } from '@/lib/actions/tags'
import { cn } from '@/lib/utils'

function toLocalDateTimeValue(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function toIsoFromLocal(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return date.toLocaleString()
}

function getTimeLabel(value: string) {
  const now = new Date()
  const date = new Date(value)
  const diffMs = date.getTime() - now.getTime()
  const diffMins = Math.round(diffMs / 60000)
  const diffHours = Math.round(diffMs / 3600000)
  const diffDays = Math.round(diffMs / 86400000)

  if (diffMs < 0) {
    const overdue = Math.abs(diffMins)
    if (overdue < 60) return { label: `${overdue} min overdue`, tone: 'past' as const }
    const overdueHours = Math.abs(diffHours)
    if (overdueHours < 24) return { label: `${overdueHours}h overdue`, tone: 'past' as const }
    return { label: `${Math.abs(diffDays)}d overdue`, tone: 'past' as const }
  }

  if (diffMins < 60) return { label: `in ${diffMins} min`, tone: 'soon' as const }
  if (diffHours < 24) return { label: `in ${diffHours}h`, tone: 'soon' as const }
  return { label: `in ${diffDays}d`, tone: 'upcoming' as const }
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Bell className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No reminders yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Add reminders for important moments so you never miss them.
      </p>
      <Button onClick={onCreate}>
        <Bell className="h-4 w-4 mr-2" />
        Create your first reminder
      </Button>
    </div>
  )
}

interface ReminderCardProps {
  reminder: Reminder
  onUpdate: (id: string, updates: Partial<Pick<Reminder, 'title' | 'remind_at' | 'visibility'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function ReminderCard({ reminder, onUpdate, onDelete }: ReminderCardProps) {
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(reminder.title)
  const [remindAt, setRemindAt] = React.useState(toLocalDateTimeValue(reminder.remind_at))
  const [tags, setTags] = React.useState<Tag[]>([])
  const [showTags, setShowTags] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    setTitle(reminder.title)
    setRemindAt(toLocalDateTimeValue(reminder.remind_at))
  }, [reminder.id, reminder.title, reminder.remind_at])

  React.useEffect(() => {
    getItemTags('reminder', reminder.id).then(setTags).catch(console.error)
  }, [reminder.id])

  const handleTitleBlur = async () => {
    setEditingTitle(false)
    if (title !== reminder.title) {
      await onUpdate(reminder.id, { title })
    }
  }

  const handleRemindAtBlur = async () => {
    const iso = toIsoFromLocal(remindAt)
    if (!iso) return
    if (iso !== reminder.remind_at) {
      await onUpdate(reminder.id, { remind_at: iso })
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(reminder.id)
    } finally {
      setDeleting(false)
    }
  }

  const timeLabel = getTimeLabel(reminder.remind_at)
  const pastDue = timeLabel.tone === 'past'

  return (
    <div className={cn(
      'border rounded-lg p-4 bg-card space-y-3',
      pastDue && 'border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'mt-1 h-2.5 w-2.5 rounded-full',
          pastDue ? 'bg-red-500' : 'bg-blue-500'
        )} />
        <div className="flex-1 min-w-0 space-y-1">
          {editingTitle ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleBlur()}
              className="h-8"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-left font-medium truncate w-full hover:underline"
            >
              {reminder.title || 'Untitled reminder'}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateTime(reminder.remind_at)}</span>
            <Badge
              variant="secondary"
              className={cn(
                'text-[11px]',
                pastDue && 'text-red-600 dark:text-red-400'
              )}
            >
              {timeLabel.label}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className="pl-6 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <Input
          type="datetime-local"
          value={remindAt}
          onChange={(e) => setRemindAt(e.target.value)}
          onBlur={handleRemindAtBlur}
          className="h-8 text-sm max-w-xs"
        />
      </div>

      <div className="pl-6">
        {showTags ? (
          <TagPicker
            itemType="reminder"
            itemId={reminder.id}
            selectedTags={tags}
            onTagsChange={setTags}
          />
        ) : tags.length > 0 ? (
          <button onClick={() => setShowTags(true)} className="hover:opacity-80">
            <TagList tags={tags} />
          </button>
        ) : (
          <button
            onClick={() => setShowTags(true)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            + Add tags
          </button>
        )}
      </div>
    </div>
  )
}

export default function RemindersPage() {
  const { currentTenantId } = useTenant()
  const [reminders, setReminders] = React.useState<Reminder[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'upcoming' | 'past'>('all')
  const [newReminder, setNewReminder] = React.useState({ title: '', remindAt: '' })

  const loadReminders = React.useCallback(async () => {
    if (!currentTenantId) return
    setLoading(true)
    try {
      const data = await getReminders(currentTenantId, searchQuery || undefined)
      setReminders(data)
    } catch (error) {
      console.error('Failed to load reminders:', error)
      toast.error('Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }, [currentTenantId, searchQuery])

  React.useEffect(() => {
    if (currentTenantId) {
      loadReminders()
    }
  }, [currentTenantId, loadReminders])

  const handleCreateReminder = async () => {
    if (!currentTenantId) return
    if (!newReminder.title.trim()) {
      toast.error('Please add a title')
      return
    }
    if (!newReminder.remindAt) {
      toast.error('Please select a date and time')
      return
    }

    const remindAtIso = toIsoFromLocal(newReminder.remindAt)
    if (!remindAtIso) {
      toast.error('Invalid date/time')
      return
    }

    setCreating(true)
    try {
      const created = await createReminder(currentTenantId, {
        title: newReminder.title.trim(),
        remind_at: remindAtIso
      })
      setReminders((prev) => [created, ...prev])
      setNewReminder({ title: '', remindAt: '' })
      toast.success('Reminder created')
    } catch (error) {
      console.error('Failed to create reminder:', error)
      toast.error('Failed to create reminder')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateReminder = async (
    id: string,
    updates: Partial<Pick<Reminder, 'title' | 'remind_at' | 'visibility'>>
  ) => {
    try {
      const updated = await updateReminder(id, updates)
      setReminders((prev) => prev.map((reminder) => reminder.id === id ? { ...reminder, ...updated } : reminder))
    } catch (error) {
      console.error('Failed to update reminder:', error)
      toast.error('Failed to update reminder')
    }
  }

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder(id)
      setReminders((prev) => prev.filter((reminder) => reminder.id !== id))
      toast.success('Reminder deleted')
    } catch (error) {
      console.error('Failed to delete reminder:', error)
      toast.error('Failed to delete reminder')
    }
  }

  const filteredReminders = React.useMemo(() => {
    const now = new Date().getTime()
    return reminders.filter((reminder) => {
      const remindAt = new Date(reminder.remind_at).getTime()
      if (filterStatus === 'past') return remindAt < now
      if (filterStatus === 'upcoming') return remindAt >= now
      return true
    })
  }, [reminders, filterStatus])

  const stats = React.useMemo(() => {
    const now = new Date().getTime()
    const upcoming = reminders.filter((reminder) => new Date(reminder.remind_at).getTime() >= now).length
    const past = reminders.length - upcoming
    return { total: reminders.length, upcoming, past }
  }, [reminders])

  if (!currentTenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select a workspace first</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background p-6">
      <div className="max-w-5xl mx-auto h-full flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reminders</h1>
            <p className="text-sm text-muted-foreground">
              Set a time, add tags, and stay on track.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{stats.total} total</Badge>
            <Badge variant="secondary" className="text-blue-600 dark:text-blue-400">
              {stats.upcoming} upcoming
            </Badge>
            <Badge variant="secondary" className="text-red-600 dark:text-red-400">
              {stats.past} past
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="border rounded-lg p-4 bg-card space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-medium">New reminder</h2>
                <p className="text-xs text-muted-foreground">Title, date, and time.</p>
              </div>
            </div>
            <Input
              placeholder="Reminder title"
              value={newReminder.title}
              onChange={(e) => setNewReminder((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Input
              type="datetime-local"
              value={newReminder.remindAt}
              onChange={(e) => setNewReminder((prev) => ({ ...prev, remindAt: e.target.value }))}
              min={new Date().toISOString().slice(0, 16)}
            />
            <Button onClick={handleCreateReminder} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create reminder
            </Button>
          </div>

          <div className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-medium">Filters</h2>
                <p className="text-xs text-muted-foreground">Focus on what matters now.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { key: 'all', label: 'All reminders' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past due' }
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setFilterStatus(filter.key as typeof filterStatus)}
                  className={cn(
                    'text-left rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    filterStatus === filter.key
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border rounded-lg bg-card p-4 flex flex-col gap-4 flex-1 min-h-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reminders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <ScrollArea className="flex-1 pr-2 min-h-0">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="border rounded-lg p-4 space-y-3 animate-pulse">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-8 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : reminders.length === 0 ? (
              <EmptyState onCreate={handleCreateReminder} />
            ) : filteredReminders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No reminders match this filter
              </div>
            ) : (
              <div className="space-y-4">
                {filteredReminders.map((reminder) => (
                  <ReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    onUpdate={handleUpdateReminder}
                    onDelete={handleDeleteReminder}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      <AiChatFab />
    </div>
  )
}
