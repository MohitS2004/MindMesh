'use client'

import * as React from 'react'
import { Plus, Trash2, CheckSquare, Loader2, Clock, AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { TagPicker, TagList } from '@/components/tag-picker'
import { AiChatFab } from '@/components/ai-chat-fab'
import { useTenant } from '@/lib/tenant-context'
import { 
  getTasks, 
  createTask, 
  updateTask, 
  deleteTask,
  type Task,
  type TaskStatus 
} from '@/lib/actions/tasks'
import { getItemTags, type Tag } from '@/lib/actions/tags'
import { cn } from '@/lib/utils'

// Skeleton loader component
function TaskSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="animate-pulse flex items-center gap-4 p-4 border rounded-lg">
          <div className="h-5 w-5 bg-muted rounded" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="flex-1" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
      ))}
    </div>
  )
}

// Calculate time remaining
function getTimeRemaining(dueDate: string | null): { text: string; status: 'pending' | 'urgent' | 'soon' | 'ok' } | null {
  if (!dueDate) return null
  
  const now = new Date()
  const due = new Date(dueDate)
  const diffMs = due.getTime() - now.getTime()
  
  // If past deadline
  if (diffMs < 0) {
    return { text: 'Pending', status: 'pending' }
  }
  
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 60) {
    return { text: `${diffMins} min${diffMins !== 1 ? 's' : ''} left`, status: 'urgent' }
  }
  if (diffHours < 24) {
    return { text: `${diffHours} hour${diffHours !== 1 ? 's' : ''} left`, status: 'urgent' }
  }
  if (diffDays <= 3) {
    return { text: `${diffDays} day${diffDays !== 1 ? 's' : ''} left`, status: 'soon' }
  }
  return { text: `${diffDays} days left`, status: 'ok' }
}

// Empty state component
function EmptyState({ onCreateTask }: { onCreateTask: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <CheckSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Stay organized by creating tasks to track your work and deadlines.
      </p>
      <Button onClick={onCreateTask}>
        <Plus className="h-4 w-4 mr-2" />
        Create your first task
      </Button>
    </div>
  )
}

interface TaskRowProps {
  task: Task
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function TaskRow({ task, onUpdate, onDelete }: TaskRowProps) {
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(task.title)
  const [description, setDescription] = React.useState(task.description || '')
  const [tags, setTags] = React.useState<Tag[]>([])
  const [showTags, setShowTags] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    getItemTags('task', task.id).then(setTags).catch(console.error)
  }, [task.id])

  const handleTitleBlur = async () => {
    setEditingTitle(false)
    if (title !== task.title) {
      await onUpdate(task.id, { title })
    }
  }

  const handleDescriptionChange = (value: string) => {
    const limited = value.split(/\r?\n/).slice(0, 2).join('\n')
    setDescription(limited)
  }

  const handleDescriptionBlur = async () => {
    if (description !== (task.description || '')) {
      await onUpdate(task.id, { description })
    }
  }

  const handleToggleDone = async (checked: boolean) => {
    await onUpdate(task.id, { 
      status: checked ? 'done' : 'in_progress'
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(task.id)
    } finally {
      setDeleting(false)
    }
  }

  const timeRemaining = task.status === 'done' ? null : getTimeRemaining(task.due_date)
  const isDone = task.status === 'done'
  const isPending = timeRemaining?.status === 'pending'

  return (
    <div className={cn(
      "group border rounded-lg p-4 transition-colors",
      isDone && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
      isPending && !isDone && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
      !isDone && !isPending && "hover:bg-accent/30"
    )}>
      <div className="flex items-center gap-4">
        {/* Checkbox to mark done */}
        <Checkbox
          checked={isDone}
          onCheckedChange={handleToggleDone}
          className={cn(
            "h-5 w-5",
            isDone && "bg-green-500 border-green-500 text-white"
          )}
        />
        
        {/* Title */}
        <div className="flex-1 min-w-0">
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
              className={cn(
                'text-left font-medium truncate w-full hover:underline',
                isDone && 'line-through text-muted-foreground'
              )}
            >
              {task.title || 'Untitled Task'}
            </button>
          )}
        </div>

        {/* Status badge */}
        {isDone ? (
          <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        ) : isPending ? (
          <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300">
            <Circle className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        )}

        {/* Time remaining */}
        {timeRemaining && !isDone && (
          <div className={cn(
            'flex items-center gap-1 text-sm font-medium',
            timeRemaining.status === 'pending' && 'text-red-600 dark:text-red-400',
            timeRemaining.status === 'urgent' && 'text-orange-600 dark:text-orange-400',
            timeRemaining.status === 'soon' && 'text-yellow-600 dark:text-yellow-400',
            timeRemaining.status === 'ok' && 'text-muted-foreground'
          )}>
            <Clock className="h-4 w-4" />
            {timeRemaining.text}
          </div>
        )}

        {/* Delete button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* Description */}
      <div className="mt-2 pl-9">
        <Textarea
          value={description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          onBlur={handleDescriptionBlur}
          rows={2}
          placeholder="Add details..."
          className="min-h-[3rem] text-sm resize-none"
        />
      </div>

      {/* Tags row */}
      <div className="mt-2 pl-9">
        {showTags ? (
          <TagPicker
            itemType="task"
            itemId={task.id}
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

// New task form state
interface NewTaskForm {
  title: string
  description: string
  deadline: string
}

export default function TasksPage() {
  const { currentTenantId } = useTenant()
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const [newTask, setNewTask] = React.useState<NewTaskForm>({ title: '', description: '', deadline: '' })
  const [filterStatus, setFilterStatus] = React.useState<'all' | 'active' | 'done' | 'pending'>('all')

  // Load tasks
  const loadTasks = React.useCallback(async () => {
    if (!currentTenantId) return
    
    try {
      const data = await getTasks(currentTenantId)
      setTasks(data)
    } catch (error) {
      console.error('Failed to load tasks:', error)
      toast.error('Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [currentTenantId])

  React.useEffect(() => {
    if (currentTenantId) {
      loadTasks()
    }
  }, [currentTenantId, loadTasks])

  // Filter tasks
  const filteredTasks = React.useMemo(() => {
    return tasks.filter(task => {
      const timeRemaining = getTimeRemaining(task.due_date)
      const isPending = timeRemaining?.status === 'pending'
      
      switch (filterStatus) {
        case 'active':
          return task.status !== 'done' && !isPending
        case 'done':
          return task.status === 'done'
        case 'pending':
          return task.status !== 'done' && isPending
        default:
          return true
      }
    })
  }, [tasks, filterStatus])

  const handleCreateTask = async () => {
    if (!currentTenantId || !newTask.title.trim()) {
      toast.error('Please enter a task title')
      return
    }
    if (!newTask.deadline) {
      toast.error('Please set a deadline')
      return
    }
    
    setCreating(true)
    try {
      const task = await createTask(currentTenantId, { 
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        due_date: newTask.deadline,
        status: 'in_progress'
      })
      setTasks(prev => [task, ...prev])
      setNewTask({ title: '', description: '', deadline: '' })
      setShowCreateForm(false)
      toast.success('Task created')
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('Failed to create task')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const updated = await updateTask(id, updates)
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
      if (updates.status === 'done') {
        toast.success('Task completed! 🎉')
      }
    } catch (error) {
      console.error('Failed to update task:', error)
      toast.error('Failed to update task')
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      await deleteTask(id)
      setTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Task deleted')
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast.error('Failed to delete task')
    }
  }

  // Stats
  const stats = React.useMemo(() => {
    const active = tasks.filter(t => t.status !== 'done' && getTimeRemaining(t.due_date)?.status !== 'pending').length
    const done = tasks.filter(t => t.status === 'done').length
    const pending = tasks.filter(t => t.status !== 'done' && getTimeRemaining(t.due_date)?.status === 'pending').length
    return { total: tasks.length, active, done, pending }
  }, [tasks])

  if (!currentTenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select a workspace first</p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Tasks</h1>
          
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        {/* Create task form */}
        {showCreateForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-card">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task Title</label>
              <Input
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && newTask.deadline && handleCreateTask()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Details</label>
              <Textarea
                rows={2}
                placeholder="Add 1-2 lines..."
                value={newTask.description}
                onChange={(e) => {
                  const limited = e.target.value.split(/\r?\n/).slice(0, 2).join('\n')
                  setNewTask(prev => ({ ...prev, description: limited }))
                }}
                className="text-sm resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Deadline</label>
              <Input
                type="datetime-local"
                value={newTask.deadline}
                onChange={(e) => setNewTask(prev => ({ ...prev, deadline: e.target.value }))}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowCreateForm(false)
                setNewTask({ title: '', description: '', deadline: '' })
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreateTask} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Task
              </Button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          {[
            { key: 'all', label: `All (${stats.total})` },
            { key: 'active', label: `In Progress (${stats.active})` },
            { key: 'pending', label: `Pending (${stats.pending})` },
            { key: 'done', label: `Done (${stats.done})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key as typeof filterStatus)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                filterStatus === tab.key 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tasks list */}
        <ScrollArea className="h-[calc(100vh-20rem)]">
          {loading ? (
            <TaskSkeleton />
          ) : tasks.length === 0 ? (
            <EmptyState onCreateTask={() => setShowCreateForm(true)} />
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No tasks in this category
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onUpdate={handleUpdateTask}
                  onDelete={handleDeleteTask}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      <AiChatFab />
    </div>
  )
}
