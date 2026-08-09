import type { SaveSessionInput } from '@/features/sessions/types'

const DATABASE_NAME = 'flowtime-session-outbox'
const DATABASE_VERSION = 1
const STORE_NAME = 'pending-sessions'
const USER_ID_INDEX = 'user-id'

export interface QueuedSession {
  id: string
  userId: string
  queuedAt: string
  payload: SaveSessionInput
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true })
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true })
    transaction.addEventListener('error', () => reject(transaction.error), { once: true })
  })
}

function openOutboxDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve<IDBDatabase | null>(null)
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.addEventListener(
      'upgradeneeded',
      () => {
        const database = request.result
        if (database.objectStoreNames.contains(STORE_NAME)) return

        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex(USER_ID_INDEX, 'userId', { unique: false })
      },
      { once: true }
    )
    request.addEventListener('success', () => resolve(request.result), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
  })
}

export async function queueSession(payload: SaveSessionInput) {
  const database = await openOutboxDatabase()
  if (!database) return false

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put({
      id: payload.id,
      userId: payload.user_id,
      queuedAt: new Date().toISOString(),
      payload,
    } satisfies QueuedSession)
    await transactionToPromise(transaction)
    return true
  } finally {
    database.close()
  }
}

export async function removeQueuedSession(sessionId: string) {
  const database = await openOutboxDatabase()
  if (!database) return

  try {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(sessionId)
    await transactionToPromise(transaction)
  } finally {
    database.close()
  }
}

export async function getQueuedSessions(userId: string) {
  const database = await openOutboxDatabase()
  if (!database) return []

  try {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).index(USER_ID_INDEX).getAll(userId)
    const sessions = await requestToPromise(request)

    return (sessions as QueuedSession[]).sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  } finally {
    database.close()
  }
}
