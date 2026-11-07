// Bound the whole operation, including time waiting for a refreshed auth token.
export async function withRequestTimeout<T>(
  request: (signal: AbortSignal) => PromiseLike<T>
): Promise<T> {
  const controller = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(() => request(controller.signal)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Connection timed out. Check your connection and retry.'))
          controller.abort()
        }, 15000)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
