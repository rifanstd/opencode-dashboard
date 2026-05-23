import { useAppStore } from '../stores/appStore.ts'

export async function handleSync() {
  const store = useAppStore.getState()
  store.setSyncing(true)
  store.clearError()

  try {
    const response = await fetch('/api/sync')
    const result = await response.json() as { success: boolean; message: string }
    if (!result.success) {
      store.setError(result.message || 'Sync failed')
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    store.setError(message)
    return { success: false, message }
  } finally {
    store.setSyncing(false)
  }
}
