'use server'

type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004'
const GEMINI_CHAT_MODEL = process.env.GEMINI_CHAT_MODEL
const DEFAULT_CHAT_MODEL = 'gemini-1.0-pro'
const CHAT_MODEL_PREFERENCES = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-pro'
]

let cachedChatModel: string | null = null

function requireApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return GEMINI_API_KEY
}

function normalizeModelName(value: string) {
  return value.replace(/^models\//, '').trim()
}

async function listModels() {
  const apiKey = requireApiKey()
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini list models error: ${errorText}`)
  }

  const data = await response.json()
  const models = Array.isArray(data?.models) ? data.models : []
  return models
    .filter((model: any) => Array.isArray(model.supportedGenerationMethods) &&
      model.supportedGenerationMethods.includes('generateContent'))
    .map((model: any) => normalizeModelName(model.name || ''))
    .filter(Boolean)
}

function pickPreferredModel(models: string[], avoid?: string) {
  for (const preferred of CHAT_MODEL_PREFERENCES) {
    const match = models.find((model) => model === preferred || model.startsWith(`${preferred}-`))
    if (match && match !== avoid) return match
  }
  return models.find((model) => model !== avoid) || ''
}

async function resolveChatModel() {
  if (GEMINI_CHAT_MODEL) {
    return normalizeModelName(GEMINI_CHAT_MODEL)
  }
  if (cachedChatModel) return cachedChatModel

  try {
    const models = await listModels()
    const picked = pickPreferredModel(models) || DEFAULT_CHAT_MODEL
    cachedChatModel = picked
    return picked
  } catch {
    return DEFAULT_CHAT_MODEL
  }
}

function isModelNotFound(responseText: string) {
  return responseText.includes('not found') || responseText.includes('NOT_FOUND')
}

function isQuotaExceeded(responseText: string) {
  return responseText.includes('RESOURCE_EXHAUSTED') || responseText.includes('Quota exceeded')
}

export async function embedText(text: string, task: EmbeddingTask) {
  const apiKey = requireApiKey()

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType: task
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini embed error: ${errorText}`)
  }

  const data = await response.json()
  const values = data?.embedding?.values
  if (!Array.isArray(values)) {
    throw new Error('Gemini embed response missing embedding values')
  }
  return values as number[]
}

async function generateWithModel(model: string, prompt: string) {
  const apiKey = requireApiKey()

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: [
                'You are MindMesh, a helpful personal assistant.',
                'Use the provided context to answer in a natural, personalized tone.',
                'Do not dump raw database fields or copy text verbatim.',
                'Summarize and connect relevant items. Ask a brief clarification if needed.',
                'If no relevant context exists, say so and ask a helpful follow-up.'
              ].join(' ')
            }
          ]
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    const error = new Error(`Gemini generate error: ${errorText}`)
    ;(error as any).status = response.status
    ;(error as any).responseText = errorText
    throw error
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini generate response missing text')
  }
  return text as string
}

export async function generateAnswer(prompt: string) {
  const primaryModel = await resolveChatModel()

  try {
    return await generateWithModel(primaryModel, prompt)
  } catch (error) {
    const responseText = (error as any)?.responseText || ''
    if (!isModelNotFound(responseText) && !isQuotaExceeded(responseText)) {
      throw error
    }
  }

  try {
    const models = await listModels()
    const fallbackModel = pickPreferredModel(models, primaryModel)
    if (!fallbackModel) {
      throw new Error(`Gemini generate error: No available model supports generateContent`)
    }
    cachedChatModel = fallbackModel
    return await generateWithModel(fallbackModel, prompt)
  } catch (error) {
    throw error
  }
}
