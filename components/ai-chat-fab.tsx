'use client'

import * as React from 'react'
import {
  Bot,
  MessageSquare,
  SendHorizontal,
  Sparkles,
  User,
  X
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useTenant } from '@/lib/tenant-context'
import { askAssistant, type ChatSource } from '@/lib/actions/chat'
import { cn } from '@/lib/utils'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
}

export function AiChatFab() {
  const { currentTenantId } = useTenant()
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])

  const handleSend = async () => {
    const question = inputValue.trim()
    if (!question) return
    if (!currentTenantId) {
      toast.error('Please select a workspace first')
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question
    }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInputValue('')
    setLoading(true)

    try {
      const result = await askAssistant(currentTenantId, question)
      setMessages([
        ...nextMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.answer,
          sources: result.sources
        }
      ])
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Assistant is unavailable right now')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[320px] sm:w-[380px] rounded-2xl border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              AI Assistant
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Quick chat — ask about your notes, tasks, files, or reminders.
              </div>
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-xl p-3 text-sm max-w-[85%]',
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 border'
                      )}
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-70 mb-1">
                        {message.role === 'user' ? (
                          <>
                            <User className="h-3 w-3" /> You
                          </>
                        ) : (
                          <>
                            <Bot className="h-3 w-3" /> Assistant
                          </>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ))}
                {loading ? (
                  <div className="rounded-xl p-3 text-sm bg-muted/60 border">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-70 mb-1">
                      <Bot className="h-3 w-3" /> Assistant
                    </div>
                    <div className="text-muted-foreground text-sm">
                      Thinking...
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t p-3 flex items-end gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask something..."
              className="min-h-[48px] resize-none border-none focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              disabled={loading}
            />
            <Button size="icon" onClick={handleSend} disabled={loading || !inputValue.trim()}>
              <SendHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        size="lg"
        onClick={() => setOpen(true)}
        className="gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl hover:from-emerald-500/90 hover:to-teal-500/90"
        aria-label="Open AI chat"
      >
        <MessageSquare className="h-5 w-5" />
        Ask AI
      </Button>
    </div>
  )
}
