'use client'

import * as React from 'react'
import { X, Plus, Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { getUsedTags, createTag, addTagToItem, removeTagFromItem, type Tag } from '@/lib/actions/tags'
import { useTenant } from '@/lib/tenant-context'

interface TagPickerProps {
  itemType: 'note' | 'task' | 'file' | 'reminder'
  itemId: string
  selectedTags: Tag[]
  onTagsChange: (tags: Tag[]) => void
  className?: string
}

export function TagPicker({ itemType, itemId, selectedTags, onTagsChange, className }: TagPickerProps) {
  const { currentTenantId } = useTenant()
  const [open, setOpen] = React.useState(false)
  const [allTags, setAllTags] = React.useState<Tag[]>([])
  const [inputValue, setInputValue] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const trimmedInput = inputValue.trim()

  React.useEffect(() => {
    if (currentTenantId) {
      getUsedTags(currentTenantId, itemType).then(setAllTags).catch(console.error)
    }
  }, [currentTenantId, itemType])

  React.useEffect(() => {
    setInputValue('')
    setOpen(false)
  }, [itemId])

  const handleSelect = async (tag: Tag) => {
    const isSelected = selectedTags.some(t => t.id === tag.id)
    
    try {
      if (isSelected) {
        await removeTagFromItem(tag.id, itemType, itemId)
        onTagsChange(selectedTags.filter(t => t.id !== tag.id))
      } else {
        await addTagToItem(tag.id, itemType, itemId)
        onTagsChange([...selectedTags, tag])
      }
      setInputValue('')
    } catch (error) {
      console.error('Failed to update tag:', error)
    }
  }

  const handleCreateTag = async () => {
    if (!currentTenantId || !inputValue.trim()) return
    setLoading(true)
    try {
      const newTag = await createTag(currentTenantId, itemType, inputValue.trim())
      setAllTags(prev => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)))
      // Also add to item
      await addTagToItem(newTag.id, itemType, itemId)
      onTagsChange([...selectedTags, newTag])
      setInputValue('')
    } catch (error) {
      console.error('Failed to create tag:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveTag = async (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await removeTagFromItem(tag.id, itemType, itemId)
      onTagsChange(selectedTags.filter(t => t.id !== tag.id))
    } catch (error) {
      console.error('Failed to remove tag:', error)
    }
  }

  const filteredTags = trimmedInput
    ? allTags.filter(tag =>
        tag.name.toLowerCase().includes(trimmedInput.toLowerCase())
      )
    : []

  const showCreateOption = trimmedInput &&
    !allTags.some(t => t.name.toLowerCase() === trimmedInput.toLowerCase())

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setInputValue('')
    }
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {selectedTags.map(tag => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="gap-1 px-2 py-0.5 text-xs"
          style={{ 
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            borderColor: `${tag.color}40`
          }}
        >
          {tag.name}
          <button
            onClick={(e) => handleRemoveTag(tag, e)}
            className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tag..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && showCreateOption) {
                  e.preventDefault()
                  handleCreateTag()
                }
              }}
            />
            <CommandList>
              <CommandEmpty>
                {trimmedInput ? (
                  <button
                    onClick={handleCreateTag}
                    disabled={loading}
                    className="flex items-center gap-2 w-full p-2 text-sm hover:bg-accent rounded"
                  >
                    <Plus className="h-4 w-4" />
                    Create &quot;{trimmedInput}&quot;
                  </button>
                ) : (
                  <span className="text-muted-foreground text-sm p-2">Type to search or create a tag</span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredTags.map(tag => {
                  const isSelected = selectedTags.some(t => t.id === tag.id)
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      onSelect={() => handleSelect(tag)}
                      className="cursor-pointer"
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1">{tag.name}</span>
                      {isSelected && <Check className="h-4 w-4" />}
                    </CommandItem>
                  )
                })}
                {showCreateOption && filteredTags.length > 0 && (
                  <CommandItem
                    value={`create-${inputValue}`}
                    onSelect={handleCreateTag}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create &quot;{inputValue.trim()}&quot;
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function TagList({ tags, className }: { tags: { id: string; name: string; color: string }[]; className?: string }) {
  if (!tags.length) return null
  
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map(tag => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="px-1.5 py-0 text-[10px]"
          style={{ 
            backgroundColor: `${tag.color}20`,
            color: tag.color,
            borderColor: `${tag.color}40`
          }}
        >
          {tag.name}
        </Badge>
      ))}
    </div>
  )
}
