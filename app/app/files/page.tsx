'use client'

import * as React from 'react'
import {
  ExternalLink,
  File as FileIcon,
  FileText,
  Image,
  Link2,
  Loader2,
  Music,
  Search,
  Trash2,
  Upload,
  Video,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { TagPicker, TagList } from '@/components/tag-picker'
import { AiChatFab } from '@/components/ai-chat-fab'
import { useTenant } from '@/lib/tenant-context'
import { createClient } from '@/lib/supabase/client'
import {
  getFiles,
  createFile,
  updateFile,
  deleteFile,
  type FileItem
} from '@/lib/actions/files'
import { getItemTags, type Tag } from '@/lib/actions/tags'
import { cn } from '@/lib/utils'

const STORAGE_BUCKET = 'Files'

type UploadStatus = 'ready' | 'uploading' | 'error'

type QueuedFile = {
  id: string
  file: File
  title: string
  description: string
  status: UploadStatus
  error?: string
}

const MAX_DESCRIPTION_LINES = 2

function limitDescription(value: string) {
  return value.split(/\r?\n/).slice(0, MAX_DESCRIPTION_LINES).join('\n')
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, '')
}

function sanitizeFileName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildStoragePath(tenantId: string, file: File) {
  const safeName = sanitizeFileName(file.name)
  return `${tenantId}/${crypto.randomUUID()}-${safeName}`
}

function formatBytes(value?: number | string | null) {
  if (value === null || value === undefined) return ''
  const bytes = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(bytes)) return ''
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  const precision = size >= 10 ? 0 : 1
  return `${size.toFixed(precision)} ${units[unit]}`
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString()
}

function getHost(url?: string | null) {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function extractYouTubeId(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.replace('/', '')
    }
    if (parsed.hostname.includes('youtube.com')) {
      const idFromQuery = parsed.searchParams.get('v')
      if (idFromQuery) return idFromQuery
      const pathMatch = parsed.pathname.match(/\/(embed|shorts)\/([^/?]+)/)
      if (pathMatch?.[2]) return pathMatch[2]
    }
  } catch {
    return null
  }
  return null
}

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(url.split('?')[0])
}

function getLinkPreviewUrl(url?: string | null) {
  if (!url) return null
  const videoId = extractYouTubeId(url)
  if (videoId) {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  }
  if (isImageUrl(url)) {
    return url
  }
  return null
}

function normalizeUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function getFileGlyph(file: FileItem) {
  if (file.file_type === 'link') return Link2
  const mime = file.mime_type || ''
  if (mime.startsWith('image/')) return Image
  if (mime.startsWith('video/')) return Video
  if (mime.startsWith('audio/')) return Music
  if (mime === 'application/pdf') return FileText
  return FileIcon
}

function EmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Upload className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">No files yet</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        Upload files or save links to build your library.
      </p>
      <Button onClick={onBrowse}>
        <Upload className="h-4 w-4 mr-2" />
        Upload your first file
      </Button>
    </div>
  )
}

interface FileCardProps {
  file: FileItem
  onUpdate: (id: string, updates: Partial<Pick<FileItem, 'title' | 'description' | 'visibility'>>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onOpen: (file: FileItem) => Promise<void>
}

function FileCard({ file, onUpdate, onDelete, onOpen }: FileCardProps) {
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [title, setTitle] = React.useState(file.title || file.original_name || '')
  const [description, setDescription] = React.useState(file.description || '')
  const [tags, setTags] = React.useState<Tag[]>([])
  const [showTags, setShowTags] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [opening, setOpening] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [previewFailed, setPreviewFailed] = React.useState(false)

  React.useEffect(() => {
    setTitle(file.title || file.original_name || '')
    setDescription(file.description || '')
  }, [file.id, file.title, file.description, file.original_name])

  React.useEffect(() => {
    getItemTags('file', file.id).then(setTags).catch(console.error)
  }, [file.id])

  React.useEffect(() => {
    setPreviewFailed(false)
    if (file.file_type === 'link') {
      setPreviewUrl(getLinkPreviewUrl(file.url))
      return
    }

    if (file.file_type === 'upload' && file.mime_type?.startsWith('image/') && file.storage_path) {
      const supabase = createClient()
      supabase
        .storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(file.storage_path, 300)
        .then(({ data, error }) => {
          if (error || !data?.signedUrl) {
            setPreviewUrl(null)
            return
          }
          setPreviewUrl(data.signedUrl)
        })
        .catch(() => setPreviewUrl(null))
      return
    }

    setPreviewUrl(null)
  }, [file.file_type, file.mime_type, file.storage_path, file.url])

  const handleTitleBlur = async () => {
    setEditingTitle(false)
    if (title !== file.title) {
      await onUpdate(file.id, { title })
    }
  }

  const handleDescriptionBlur = async () => {
    if (description !== (file.description || '')) {
      await onUpdate(file.id, { description })
    }
  }

  const handleOpen = async () => {
    setOpening(true)
    try {
      await onOpen(file)
    } finally {
      setOpening(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(file.id)
    } finally {
      setDeleting(false)
    }
  }

  const Glyph = getFileGlyph(file)
  const sizeLabel = formatBytes(file.size_bytes)
  const sourceLabel = file.file_type === 'link' ? 'Link' : 'Upload'
  const showPreview = previewUrl && !previewFailed

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex items-center justify-center">
          {showPreview ? (
            <img
              src={previewUrl || ''}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <Glyph className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
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
              {file.title || file.original_name || 'Untitled'}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-[11px]">
              {sourceLabel}
            </Badge>
            {sizeLabel ? <span>{sizeLabel}</span> : null}
            <span>{formatDate(file.created_at)}</span>
            {file.file_type === 'link' && file.url ? (
              <span className="truncate max-w-[12rem]">{getHost(file.url)}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpen}
            disabled={opening}
          >
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          </Button>
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
      </div>

      <div className="pl-14">
        <Textarea
          value={description}
          onChange={(e) => setDescription(limitDescription(e.target.value))}
          onBlur={handleDescriptionBlur}
          rows={2}
          placeholder="Add a short description..."
          className="min-h-[3rem] text-sm resize-none"
        />
      </div>

      <div className="pl-14">
        {showTags ? (
          <TagPicker
            itemType="file"
            itemId={file.id}
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

export default function FilesPage() {
  const { currentTenantId } = useTenant()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [files, setFiles] = React.useState<FileItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [filterType, setFilterType] = React.useState<'all' | 'upload' | 'link'>('all')
  const [uploadQueue, setUploadQueue] = React.useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [creatingLink, setCreatingLink] = React.useState(false)
  const [linkForm, setLinkForm] = React.useState({ url: '', title: '', description: '' })

  const loadFiles = React.useCallback(async () => {
    if (!currentTenantId) return
    setLoading(true)
    try {
      const data = await getFiles(currentTenantId, searchQuery || undefined)
      setFiles(data)
    } catch (error) {
      console.error('Failed to load files:', error)
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }, [currentTenantId, searchQuery])

  React.useEffect(() => {
    if (currentTenantId) {
      loadFiles()
    }
  }, [currentTenantId, loadFiles])

  const filteredFiles = React.useMemo(() => {
    if (filterType === 'all') return files
    return files.filter((file) => file.file_type === filterType)
  }, [files, filterType])

  const handleBrowse = () => {
    fileInputRef.current?.click()
  }

  const addFilesToQueue = (incoming: FileList | File[]) => {
    const next = Array.from(incoming).map((file) => ({
      id: crypto.randomUUID(),
      file,
      title: stripExtension(file.name),
      description: '',
      status: 'ready' as UploadStatus
    }))
    if (next.length > 0) {
      setUploadQueue((prev) => [...next, ...prev])
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFilesToQueue(event.target.files)
      event.target.value = ''
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files?.length) {
      addFilesToQueue(event.dataTransfer.files)
    }
  }

  const handleUploadItem = async (item: QueuedFile) => {
    if (!currentTenantId) return
    const supabase = createClient()
    setUploadQueue((prev) =>
      prev.map((queued) =>
        queued.id === item.id ? { ...queued, status: 'uploading', error: undefined } : queued
      )
    )

    const storagePath = buildStoragePath(currentTenantId, item.file)
    const { error: uploadError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, item.file)

    if (uploadError) {
      setUploadQueue((prev) =>
        prev.map((queued) =>
          queued.id === item.id ? { ...queued, status: 'error', error: uploadError.message } : queued
        )
      )
      toast.error(`Upload failed: ${item.file.name}`)
      return
    }

    try {
      const created = await createFile(currentTenantId, {
        title: item.title || stripExtension(item.file.name),
        description: item.description,
        file_type: 'upload',
        storage_path: storagePath,
        mime_type: item.file.type || null,
        size_bytes: item.file.size,
        original_name: item.file.name
      })
      setFiles((prev) => [created, ...prev])
      setUploadQueue((prev) => prev.filter((queued) => queued.id !== item.id))
      toast.success('File uploaded')
    } catch (error) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
      setUploadQueue((prev) =>
        prev.map((queued) =>
          queued.id === item.id ? { ...queued, status: 'error', error: 'Failed to save file' } : queued
        )
      )
      toast.error('Failed to save file')
    }
  }

  const handleUploadAll = async () => {
    for (const item of uploadQueue) {
      if (item.status === 'uploading') continue
      await handleUploadItem(item)
    }
  }

  const handleRemoveQueued = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateFile = async (
    id: string,
    updates: Partial<Pick<FileItem, 'title' | 'description' | 'visibility'>>
  ) => {
    try {
      const updated = await updateFile(id, updates)
      setFiles((prev) => prev.map((file) => file.id === id ? { ...file, ...updated } : file))
    } catch (error) {
      console.error('Failed to update file:', error)
      toast.error('Failed to update file')
    }
  }

  const handleDeleteFile = async (id: string) => {
    try {
      await deleteFile(id)
      setFiles((prev) => prev.filter((file) => file.id !== id))
      toast.success('File deleted')
    } catch (error) {
      console.error('Failed to delete file:', error)
      toast.error('Failed to delete file')
    }
  }

  const handleOpenFile = async (file: FileItem) => {
    if (file.file_type === 'link' && file.url) {
      window.open(file.url, '_blank', 'noopener,noreferrer')
      return
    }

    if (!file.storage_path) {
      toast.error('Missing file path')
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, 60)

    if (error || !data?.signedUrl) {
      toast.error('Unable to open file')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleCreateLink = async () => {
    if (!currentTenantId) return
    const normalizedUrl = normalizeUrl(linkForm.url)
    if (!normalizedUrl) {
      toast.error('Please enter a link')
      return
    }

    setCreatingLink(true)
    try {
      const created = await createFile(currentTenantId, {
        title: linkForm.title.trim() || getHost(normalizedUrl) || 'Untitled link',
        description: linkForm.description.trim(),
        file_type: 'link',
        url: normalizedUrl
      })
      setFiles((prev) => [created, ...prev])
      setLinkForm({ url: '', title: '', description: '' })
      toast.success('Link saved')
    } catch (error) {
      console.error('Failed to save link:', error)
      toast.error('Failed to save link')
    } finally {
      setCreatingLink(false)
    }
  }

  if (!currentTenantId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Please select a workspace first</p>
      </div>
    )
  }

  const hasQueue = uploadQueue.length > 0
  const uploadingCount = uploadQueue.filter((item) => item.status === 'uploading').length

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background p-6">
      <div className="max-w-6xl mx-auto h-full flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Files</h1>
            <p className="text-sm text-muted-foreground">
              Upload files, save links, and organize them with tags.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{files.length} items</Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="border rounded-lg p-4 bg-card space-y-4">
            <div
              className={cn(
                'rounded-lg border border-dashed p-4 text-center space-y-2 transition-colors',
                isDragging && 'border-primary/60 bg-primary/5'
              )}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Drop files here</p>
                <p className="text-xs text-muted-foreground">Any file type works.</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                Browse files
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />

            {hasQueue ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Ready to upload</p>
                  <Button
                    size="sm"
                    onClick={handleUploadAll}
                    disabled={uploadQueue.length === 0 || uploadingCount > 0}
                  >
                    {uploadingCount > 0 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Upload ${uploadQueue.length} file${uploadQueue.length === 1 ? '' : 's'}`
                    )}
                  </Button>
                </div>
                <div className="space-y-3">
                  {uploadQueue.map((item) => (
                    <div key={item.id} className="rounded-md border p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveQueued(item.id)}
                          disabled={item.status === 'uploading'}
                        >
                          {item.status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          setUploadQueue((prev) =>
                            prev.map((queued) =>
                              queued.id === item.id ? { ...queued, title: e.target.value } : queued
                            )
                          )
                        }
                        placeholder="Title"
                        className="h-8 text-sm"
                        disabled={item.status === 'uploading'}
                      />
                      <Textarea
                        value={item.description}
                        onChange={(e) =>
                          setUploadQueue((prev) =>
                            prev.map((queued) =>
                              queued.id === item.id
                                ? { ...queued, description: limitDescription(e.target.value) }
                                : queued
                            )
                          )
                        }
                        rows={2}
                        placeholder="Short description (1-2 lines)"
                        className="text-sm resize-none"
                        disabled={item.status === 'uploading'}
                      />
                      {item.status === 'error' ? (
                        <div className="flex items-center justify-between text-xs text-destructive">
                          <span>{item.error || 'Upload failed'}</span>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleUploadItem(item)}
                            className="px-0 text-destructive"
                          >
                            Retry
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No files selected yet.</p>
            )}
          </div>

          <div className="border rounded-lg p-4 bg-card space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-medium">Save a link</h2>
                <p className="text-xs text-muted-foreground">YouTube, PDF links, or any URL.</p>
              </div>
            </div>
            <Input
              placeholder="Paste a link..."
              value={linkForm.url}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, url: e.target.value }))}
            />
            <Input
              placeholder="Title"
              value={linkForm.title}
              onChange={(e) => setLinkForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <Textarea
              rows={2}
              placeholder="Short description (1-2 lines)"
              value={linkForm.description}
              onChange={(e) =>
                setLinkForm((prev) => ({ ...prev, description: limitDescription(e.target.value) }))
              }
              className="text-sm resize-none"
            />
            <Button onClick={handleCreateLink} disabled={creatingLink}>
              {creatingLink ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save link
            </Button>
          </div>
        </div>

        <div className="border rounded-lg bg-card p-4 flex flex-col gap-4 flex-1 min-h-0">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2 border-b">
            {[
              { key: 'all', label: `All (${files.length})` },
              { key: 'upload', label: `Uploads (${files.filter((f) => f.file_type === 'upload').length})` },
              { key: 'link', label: `Links (${files.filter((f) => f.file_type === 'link').length})` }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key as typeof filterType)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  filterType === tab.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
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
            ) : filteredFiles.length === 0 ? (
              files.length === 0 ? (
                <EmptyState onBrowse={handleBrowse} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No files match your filters
                </div>
              )
            ) : (
              <div className="space-y-4">
                {filteredFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    onUpdate={handleUpdateFile}
                    onDelete={handleDeleteFile}
                    onOpen={handleOpenFile}
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
