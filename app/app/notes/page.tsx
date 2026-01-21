'use client'

import * as React from 'react'
import { Plus, Search, Trash2, FileText, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { TagPicker, TagList } from '@/components/tag-picker'
import { AiChatFab } from '@/components/ai-chat-fab'
import { useTenant } from '@/lib/tenant-context'
import { 
  getNotesSimple, 
  createNote, 
  updateNote, 
  deleteNote,
  type Note 
} from '@/lib/actions/notes'
import { getItemTags, type Tag } from '@/lib/actions/tags'
import { cn } from '@/lib/utils'

// Skeleton loader component
function NoteSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="animate-pulse space-y-2 rounded-lg border border-border/60 p-3">
          <div className="h-4 bg-muted rounded w-4/5" />
          <div className="h-3 bg-muted rounded w-2/3" />
        </div>
      ))}
    </div>
  )
}

// Empty state component
function EmptyState({ onCreateNote }: { onCreateNote: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No notes yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Start capturing your thoughts, ideas, and important information.
      </p>
      <Button onClick={onCreateNote}>
        <Plus className="h-4 w-4 mr-2" />
        Create your first note
      </Button>
    </div>
  )
}

// Note detail empty state
function NoteDetailEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">Select a note</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Choose a note from the list to view and edit its contents.
      </p>
    </div>
  )
}

export default function NotesPage() {
  const { currentTenantId } = useTenant()
  const [notes, setNotes] = React.useState<Note[]>([])
  const [selectedNote, setSelectedNote] = React.useState<Note | null>(null)
  const [selectedTags, setSelectedTags] = React.useState<Tag[]>([])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  
  const { register, watch, reset } = useForm<{
    title: string
    body: string
  }>({
    defaultValues: { title: '', body: '' }
  })

  const watchedTitle = watch('title')
  const watchedBody = watch('body')
  const wordCount = React.useMemo(() => {
    const clean = watchedBody?.trim()
    if (!clean) return 0
    return clean.split(/\s+/).length
  }, [watchedBody])

  // Debounced autosave
  const saveTimeoutRef = React.useRef<NodeJS.Timeout>(null)

  React.useEffect(() => {
    if (!selectedNote) return
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Check if values changed
    if (watchedTitle === selectedNote.title && watchedBody === selectedNote.body) {
      return
    }

    // Set new timeout for 500ms debounce
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        const updated = await updateNote(selectedNote.id, {
          title: watchedTitle,
          body: watchedBody
        })
        
        // Update notes list
        setNotes(prev => prev.map(n => 
          n.id === updated.id ? { ...n, title: updated.title, body: updated.body, updated_at: updated.updated_at } : n
        ))
        
        // Update selected note reference
        setSelectedNote(prev => prev ? { ...prev, ...updated } : null)
      } catch (error) {
        console.error('Failed to save:', error)
        toast.error('Failed to save note')
      } finally {
        setSaving(false)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [watchedTitle, watchedBody, selectedNote])

  // Load notes
  const loadNotes = React.useCallback(async () => {
    if (!currentTenantId) return
    
    try {
      const data = await getNotesSimple(currentTenantId, searchQuery || undefined)
      setNotes(data)
    } catch (error) {
      console.error('Failed to load notes:', error)
      toast.error('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }, [currentTenantId, searchQuery])

  React.useEffect(() => {
    if (currentTenantId) {
      loadNotes()
    }
  }, [currentTenantId, loadNotes])

  // Load tags when note is selected
  React.useEffect(() => {
    async function loadTags() {
      if (!selectedNote) {
        setSelectedTags([])
        return
      }
      
      try {
        const tags = await getItemTags('note', selectedNote.id)
        setSelectedTags(tags)
      } catch (error) {
        console.error('Failed to load tags:', error)
      }
    }
    
    loadTags()
  }, [selectedNote?.id])

  const handleCreateNote = async () => {
    if (!currentTenantId) return
    
    setCreating(true)
    try {
      const note = await createNote(currentTenantId)
      setNotes(prev => [note, ...prev])
      setSelectedTags([])
      setSelectedNote(note)
      reset({ title: note.title, body: note.body })
      toast.success('Note created')
    } catch (error) {
      console.error('Failed to create note:', error)
      toast.error('Failed to create note')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteNote = async () => {
    if (!selectedNote) return
    
    try {
      await deleteNote(selectedNote.id)
      setNotes(prev => prev.filter(n => n.id !== selectedNote.id))
      setSelectedNote(null)
      reset({ title: '', body: '' })
      toast.success('Note deleted')
    } catch (error) {
      console.error('Failed to delete note:', error)
      toast.error('Failed to delete note')
    }
  }

  const handleSelectNote = (note: Note) => {
    // Save any pending changes first
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    setSelectedTags([])
    setSelectedNote(note)
    reset({ title: note.title, body: note.body })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!currentTenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select an organization first</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-background">
      {/* Left Panel - Notes List */}
      <div className="w-80 flex flex-col bg-card/40">
        {/* Header */}
        <div className="p-4 border-b space-y-4 bg-card/70 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Notes</h2>
              <p className="text-xs text-muted-foreground">{notes.length} total</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCreateNote}
              disabled={creating}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 rounded-full bg-background/60"
            />
          </div>
        </div>

        {/* Notes List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <NoteSkeleton />
          ) : notes.length === 0 ? (
            <EmptyState onCreateNote={handleCreateNote} />
          ) : (
            <div className="space-y-3 p-4 pr-6">
              {notes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg border transition-colors',
                    selectedNote?.id === note.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-transparent hover:bg-accent/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-1 h-2.5 w-2.5 rounded-full',
                      selectedNote?.id === note.id ? 'bg-primary' : 'bg-muted-foreground/40'
                    )} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">
                          {note.title || 'Untitled'}
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatDate(note.updated_at)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getPreviewText(note.body || '')}
                      </div>
                      {note.tags && note.tags.length > 0 && (
                        <TagList tags={note.tags} />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <div className="w-8 bg-background shrink-0" />

      {/* Right Panel - Note Detail */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            {/* Detail Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-card/70 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {saving && (
                  <Badge variant="secondary" className="text-xs">
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Saving...
                  </Badge>
                )}
                {!saving && (
                  <Badge variant="secondary" className="text-xs text-green-600 dark:text-green-400">
                    Saved
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Last edited {formatDate(selectedNote.updated_at)}
                </span>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  {wordCount} words
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteNote}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Note Content */}
            <div className="flex-1 overflow-auto">
              <div className="max-w-3xl mx-auto p-6 space-y-6">
                <div className="rounded-2xl border bg-card/80 p-5 space-y-4 shadow-sm">
                  <Input
                    {...register('title')}
                    placeholder="Untitled"
                    className="text-3xl font-semibold border-none px-0 focus-visible:ring-0"
                  />
                  <TagPicker
                    itemType="note"
                    itemId={selectedNote.id}
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                  />
                </div>

                <div className="rounded-2xl border bg-card/80 p-5 shadow-sm">
                  <Textarea
                    {...register('body')}
                    placeholder="Start writing your note..."
                    className="min-h-[420px] border-none px-0 focus-visible:ring-0 resize-none text-base leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <NoteDetailEmpty />
        )}
      </div>
      <AiChatFab />
    </div>
  )
}

function getPreviewText(value: string) {
  const clean = value.replace(/\s+/g, ' ').trim()
  if (!clean) return 'No content yet.'
  return clean.length > 100 ? `${clean.slice(0, 100)}...` : clean
}
