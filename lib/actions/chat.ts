'use server'

import { createClient } from '@/lib/supabase/server'
import { embedText, generateAnswer } from '@/lib/ai/gemini'

export type ChatSourceType = 'note' | 'task' | 'file' | 'reminder'

export type ChatSource = {
  source_type: ChatSourceType
  source_id: string
  title: string
  tags: string[]
  updated_at: string
  similarity: number
}

type SourceItem = {
  id: string
  title: string
  updated_at: string
  [key: string]: any
}

const MAX_CONTENT_LENGTH = 4000
const MAX_CONTEXT_LENGTH = 900
const MATCH_COUNT = 8
const MAX_SOURCES = 4
const MIN_SIMILARITY = 0.25

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...`
}

function vectorToString(values: number[]) {
  return `[${values.join(',')}]`
}

function getUrlHost(url?: string | null) {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function fetchTagsMap(
  supabase: SupabaseClient,
  itemType: ChatSourceType,
  itemIds: string[]
) {
  const map = new Map<string, string[]>()
  if (itemIds.length === 0) return map

  const { data, error } = await supabase
    .from('item_tags')
    .select('item_id, tags(name)')
    .eq('item_type', itemType)
    .in('item_id', itemIds)

  if (error) throw error

  ;(data || []).forEach((row: any) => {
    const name = row?.tags?.name
    if (!name) return
    const list = map.get(row.item_id) || []
    list.push(name)
    map.set(row.item_id, list)
  })

  return map
}

function formatTags(tags: string[]) {
  return tags.length ? `Tags: ${tags.join(', ')}` : ''
}

function buildDocumentContent(type: ChatSourceType, item: SourceItem, tags: string[]) {
  const tagLine = formatTags(tags)

  if (type === 'note') {
    const body = item.body ? `Body: ${item.body}` : ''
    return truncateText([`Title: ${item.title || 'Untitled'}`, body, tagLine].filter(Boolean).join('\n'), MAX_CONTENT_LENGTH)
  }

  if (type === 'task') {
    const parts = [
      `Title: ${item.title || 'Untitled task'}`,
      item.description ? `Description: ${item.description}` : '',
      item.status ? `Status: ${item.status}` : '',
      item.due_date ? `Due: ${item.due_date}` : '',
      tagLine
    ]
    return truncateText(parts.filter(Boolean).join('\n'), MAX_CONTENT_LENGTH)
  }

  if (type === 'file') {
    const parts = [
      `Title: ${item.title || item.original_name || 'Untitled file'}`,
      item.description ? `Description: ${item.description}` : '',
      item.file_type ? `Type: ${item.file_type}` : '',
      item.mime_type ? `Mime: ${item.mime_type}` : '',
      item.url ? `Link: ${getUrlHost(item.url)}` : '',
      tagLine
    ]
    return truncateText(parts.filter(Boolean).join('\n'), MAX_CONTENT_LENGTH)
  }

  const reminderParts = [
    `Title: ${item.title || 'Untitled reminder'}`,
    item.remind_at ? `Remind at: ${item.remind_at}` : '',
    tagLine
  ]
  return truncateText(reminderParts.filter(Boolean).join('\n'), MAX_CONTENT_LENGTH)
}

async function upsertDocuments(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  type: ChatSourceType,
  items: SourceItem[]
) {
  if (items.length === 0) return

  const tagsMap = await fetchTagsMap(supabase, type, items.map((item) => item.id))
  const { data: existing, error: existingError } = await supabase
    .from('documents')
    .select('source_type, source_id, updated_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (existingError) throw existingError

  const existingMap = new Map<string, string>()
  ;(existing || []).forEach((doc: any) => {
    existingMap.set(`${doc.source_type}:${doc.source_id}`, doc.updated_at)
  })

  for (const item of items) {
    const key = `${type}:${item.id}`
    const existingUpdatedAt = existingMap.get(key)
    if (existingUpdatedAt && existingUpdatedAt === item.updated_at) {
      continue
    }

    const tags = tagsMap.get(item.id) || []
    const content = buildDocumentContent(type, item, tags)
    const embedding = await embedText(content, 'RETRIEVAL_DOCUMENT')
    const embeddingValue = vectorToString(embedding)

    const { error } = await supabase
      .from('documents')
      .upsert({
        tenant_id: tenantId,
        user_id: userId,
        source_type: type,
        source_id: item.id,
        title: item.title || item.original_name || '',
        content,
        tags,
        updated_at: item.updated_at,
        embedding: embeddingValue
      }, { onConflict: 'source_type,source_id' })

    if (error) throw error
  }
}

async function syncDocuments(tenantId: string, userId: string) {
  const supabase = await createClient()

  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, title, body, updated_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (notesError) throw notesError
  await upsertDocuments(supabase, tenantId, userId, 'note', notes || [])

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, title, description, status, due_date, updated_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (tasksError) throw tasksError
  await upsertDocuments(supabase, tenantId, userId, 'task', tasks || [])

  const { data: files, error: filesError } = await supabase
    .from('files')
    .select('id, title, description, file_type, mime_type, url, original_name, updated_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (filesError) throw filesError
  await upsertDocuments(supabase, tenantId, userId, 'file', files || [])

  const { data: reminders, error: remindersError } = await supabase
    .from('reminders')
    .select('id, title, remind_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (remindersError) throw remindersError
  await upsertDocuments(supabase, tenantId, userId, 'reminder', reminders || [])
}

type MatchSource = ChatSource & { content: string }

function buildPrompt(question: string, sources: MatchSource[]) {
  if (sources.length === 0) {
    return [
      `User question: ${question}`,
      '',
      'Context: No relevant items found in the user library.',
      '',
      'At the end of your answer add: SOURCES_USED: (empty)'
    ].join('\n')
  }

  const context = sources.map((source, index) => {
    const tagLine = source.tags.length ? `Tags: ${source.tags.join(', ')}` : ''
    const snippet = truncateText(source.content || '', MAX_CONTEXT_LENGTH)
    return [
      `${index + 1}. [${source.source_type}] ${source.title || 'Untitled'}`,
      snippet,
      tagLine
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  return [
    `User question: ${question}`,
    '',
    'Context items:',
    context,
    '',
    'Answer in a personalized, human tone.',
    'Only use sources that directly support your answer.',
    'At the end add a line like: SOURCES_USED: 1,3 (numbers from the context list).',
    'If none are used, return: SOURCES_USED:'
  ].join('\n')
}

function parseSourcesUsed(answer: string, maxIndex: number) {
  const match = answer.match(/SOURCES_USED:\s*([0-9,\s]*)/i)
  if (!match) {
    return { cleanedAnswer: answer, indices: [] as number[] }
  }

  const indices = match[1]
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= maxIndex)

  const cleanedAnswer = answer.replace(/\s*SOURCES_USED:[\s\S]*$/i, '').trim()
  return { cleanedAnswer, indices }
}

export async function askAssistant(tenantId: string, question: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const cleanQuestion = question.trim()
  if (!cleanQuestion) throw new Error('Question is empty')

  await syncDocuments(tenantId, user.id)

  const queryEmbedding = await embedText(cleanQuestion, 'RETRIEVAL_QUERY')
  const queryEmbeddingValue = vectorToString(queryEmbedding)
  const { data: matches, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbeddingValue,
    match_count: MATCH_COUNT,
    filter_tenant: tenantId
  })

  if (error) throw error

  const sources: MatchSource[] = (matches || []).map((match: any) => ({
    source_type: match.source_type,
    source_id: match.source_id,
    title: match.title || '',
    tags: match.tags || [],
    updated_at: match.updated_at,
    similarity: match.similarity,
    content: match.content
  }))

  const filteredSources = sources.filter((source) => source.similarity >= MIN_SIMILARITY)
  const usedSources = filteredSources.length > 0
    ? filteredSources.slice(0, MAX_SOURCES)
    : sources.slice(0, 1)

  const prompt = buildPrompt(cleanQuestion, usedSources)
  const rawAnswer = await generateAnswer(prompt)
  const { cleanedAnswer, indices } = parseSourcesUsed(rawAnswer, usedSources.length)
  const answer = cleanedAnswer || rawAnswer

  const citedSources = indices.length
    ? indices.map((index) => usedSources[index - 1]).filter(Boolean)
    : []

  return {
    answer,
    sources: citedSources.map(({ source_type, source_id, title, tags, updated_at, similarity }) => ({
      source_type,
      source_id,
      title,
      tags,
      updated_at,
      similarity
    }))
  }
}
