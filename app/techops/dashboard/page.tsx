'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, Plus, Trash2, Eye } from 'lucide-react'

type ClientItem = {
  id: string
  name: string
  email: string
  industry: string
  status: string
  retell_connected: boolean
  google_calendar_connected: boolean
}

export default function TechOpsDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<ClientItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function loadClients() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/techops/clients/list', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load clients')
      setClients(json.clients || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load clients')
      setClients([])
    } finally {
      setLoading(false)
    }
  }

  async function deleteClient(clientId: string) {
    if (!clientId) return
    const ok = confirm('Delete this client permanently from the database?')
    if (!ok) return

    setDeletingId(clientId)
    try {
      const res = await fetch(`/api/techops/clients/${clientId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Delete failed')
      await loadClients()
    } catch (e: any) {
      alert(e?.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              TechOps Dashboard
            </h1>
            <p className="text-slate-400 mt-1">Manage clients + integrations status</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-slate-600 bg-slate-800/40 text-white hover:bg-slate-700"
              onClick={loadClients}
            >
              Refresh
            </Button>

            <Link href="/techops/clients/new">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Client
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 border border-red-500/20 bg-red-500/10 rounded text-red-300">
            {error}
          </div>
        )}

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading clients...
              </div>
            ) : clients.length === 0 ? (
              <div className="text-slate-400">No clients found.</div>
            ) : (
              <div className="space-y-3">
                {clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded border border-slate-700 bg-slate-900/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-white font-semibold truncate">{c.name || '(No name)'}</div>
                        <Badge className="bg-slate-700 text-slate-200">{c.status}</Badge>
                      </div>
                      <div className="text-slate-400 text-sm truncate">{c.email}</div>
                      <div className="text-slate-500 text-xs">{c.industry}</div>

                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge className={c.google_calendar_connected ? 'bg-emerald-600' : 'bg-slate-700'}>
                          Calendar {c.google_calendar_connected ? 'Connected' : 'Not connected'}
                        </Badge>
                        <Badge className={c.retell_connected ? 'bg-emerald-600' : 'bg-slate-700'}>
                          Retell {c.retell_connected ? 'Connected' : 'Not connected'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/techops/clients/${c.id}`}>
                        <Button
                          variant="outline"
                          className="border-slate-600 bg-slate-800/40 text-white hover:bg-slate-700 flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </Link>

                      <Button
                        variant="destructive"
                        className="flex items-center gap-2"
                        onClick={() => deleteClient(c.id)}
                        disabled={deletingId === c.id}
                      >
                        {deletingId === c.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Deleting
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" /> Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
