import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { Button } from '@/components/ui/Button'
import { commandFlowtime, readAllFlowtime } from '@/lib/flowtimeApi'
import { queryKeys } from '@/lib/queryKeys'
import type { Category, TaskWithCategory, Session } from '@/types'
export function Trash() {
  const { user } = useUser()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['trash', user?.id],
    queryFn: async () => {
      const [categories, tasks, sessions] = await Promise.all([
        readAllFlowtime<Category>('categories', { trash: 'only' }),
        readAllFlowtime<TaskWithCategory>('tasks', { status: 'all', trash: 'only' }),
        readAllFlowtime<Session>('sessions', { trash: 'only' }),
      ])
      return { categories, tasks, sessions }
    },
    enabled: !!user,
    refetchInterval: 5000,
  })
  const restore = useMutation({
    mutationFn: ({ kind, id }: { kind: string; id: string }) =>
      commandFlowtime(kind, { operations: [{ action: 'restore', id }] }),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['trash', user?.id] }),
        client.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
        client.invalidateQueries({ queryKey: queryKeys.categories(user?.id) }),
        client.invalidateQueries({ queryKey: queryKeys.sessions(user?.id) }),
      ]),
  })
  return (
    <details className="w-full border-y border-surface-border p-4">
      <summary className="cursor-pointer font-medium">Trash</summary>
      <p className="my-3 text-sm text-ink-secondary">
        Restoring a category keeps its previous archive status and reveals its tasks. Individually
        trashed tasks stay in Trash.
      </p>
      {query.isLoading ? <p>Loading…</p> : null}
      {query.error || restore.error ? (
        <p role="alert">{(query.error ?? restore.error)?.message}</p>
      ) : null}
      {query.data?.categories.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-3 py-2">
          <span>
            Category: {c.name}
            {c.archived_at ? ' (archived)' : ''}
          </span>
          <Button
            size="sm"
            loading={restore.isPending}
            onClick={() => restore.mutate({ kind: 'categories', id: c.id })}
          >
            Restore
          </Button>
        </div>
      ))}
      {query.data?.tasks.map((t) => (
        <div key={t.id} className="flex items-center justify-between gap-3 py-2">
          <span>
            {t.name}
            {t.categories?.deleted_at ? ' (restore its category first)' : ''}
          </span>
          <Button
            size="sm"
            disabled={!t.deleted_at || !!t.categories?.deleted_at}
            loading={restore.isPending}
            onClick={() => restore.mutate({ kind: 'tasks', id: t.id })}
          >
            Restore task
          </Button>
        </div>
      ))}
      {query.data?.sessions.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-3 py-2">
          <span>
            {s.task_name_snapshot ?? 'Session'} · {new Date(s.started_at).toLocaleString()}
          </span>
          <Button
            size="sm"
            loading={restore.isPending}
            onClick={() => restore.mutate({ kind: 'sessions', id: s.id })}
          >
            Restore session
          </Button>
        </div>
      ))}
      {query.data &&
      !query.data.categories.length &&
      !query.data.tasks.length &&
      !query.data.sessions.length ? (
        <p className="text-sm text-ink-secondary">Trash is empty.</p>
      ) : null}
    </details>
  )
}
