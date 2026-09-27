import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react'
import Badge, { type BadgeVariant } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { ApiError, documentsApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import type { Document, DocumentProcessingStatus } from '../../types'

const stagger: Variants = { animate: { transition: { staggerChildren: 0.04 } } }
const fadeUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.ppt,.pptx,.txt,.md'
const MAX_FILE_BYTES = 25 * 1024 * 1024
const POLL_INTERVAL_MS = 3000

const STATUS_META: Record<
  DocumentProcessingStatus,
  { label: string; variant: BadgeVariant; icon: typeof Clock }
> = {
  pending: { label: 'Queued', variant: 'default', icon: Clock },
  processing: { label: 'Processing', variant: 'info', icon: Loader2 },
  ready: { label: 'Ready', variant: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'danger', icon: XCircle },
}

function formatBytes(n: number | null): string {
  if (!n) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && typeof err.detail === 'string' ? err.detail : fallback
}

/**
 * The knowledge base behind the AI assistant. Teacher/admin uploads are shared
 * with everyone; student uploads stay private to that student.
 */
export default function LibraryPage() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    try {
      setDocuments(await documentsApi.list())
      setError(null)
    } catch (err) {
      setError(errorText(err, 'Could not load the library'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Poll while anything is still being ingested.
  const inFlight = documents.some(
    (d) => d.processing_status === 'pending' || d.processing_status === 'processing',
  )
  useEffect(() => {
    if (!inFlight) return
    const id = window.setInterval(() => void load(), POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [inFlight, load])

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError('Files must be 25 MB or smaller.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const doc = await documentsApi.upload({ file })
      setDocuments((prev) => [doc, ...prev])
    } catch (err) {
      setError(errorText(err, 'Upload failed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const canModify = (d: Document) =>
    user?.role === 'admin' || d.uploaded_by_id === user?.id || d.owner_id === user?.id

  const handleDelete = async (d: Document) => {
    try {
      await documentsApi.delete(d.id)
      setDocuments((prev) => prev.filter((x) => x.id !== d.id))
    } catch (err) {
      setError(errorText(err, 'Delete failed'))
    }
  }

  const handleReprocess = async (d: Document) => {
    try {
      const updated = await documentsApi.reprocess(d.id)
      setDocuments((prev) => prev.map((x) => (x.id === d.id ? { ...updated, processing_status: 'pending' } : x)))
    } catch (err) {
      setError(errorText(err, 'Reprocess failed'))
    }
  }

  // <a download> can't send the bearer token, so fetch the file as a blob.
  const handleDownload = async (d: Document) => {
    try {
      const res = await fetch(documentsApi.downloadUrl(d.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = d.file_name
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed')
    }
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Library</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {user?.role === 'student'
              ? 'Your private notes plus shared material. Everything here powers the AI Assistant.'
              : 'Uploads here are shared with every learner and power the AI Assistant.'}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        <Button icon={Upload} loading={uploading} onClick={() => fileInputRef.current?.click()}>
          Upload document
        </Button>
      </motion.div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
        </Card>
      ) : documents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-8 w-8 text-[var(--text-tertiary)] mb-3" />
          <p className="font-medium text-[var(--text-primary)]">No documents yet</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Upload a PDF, DOCX, PPTX, TXT or Markdown file to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((d) => {
            const meta = STATUS_META[d.processing_status]
            const StatusIcon = meta.icon
            return (
              <motion.div key={d.id} variants={fadeUp}>
                <Card>
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-[var(--text-secondary)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[var(--text-primary)] truncate">{d.title}</h3>
                        <Badge variant={meta.variant} size="sm">
                          <StatusIcon
                            className={`h-3 w-3 mr-1 inline ${d.processing_status === 'processing' ? 'animate-spin' : ''}`}
                          />
                          {meta.label}
                        </Badge>
                        {d.owner_id ? (
                          <Badge size="sm">
                            <Lock className="h-3 w-3 mr-1 inline" />
                            Private
                          </Badge>
                        ) : (
                          <Badge size="sm">
                            <Users className="h-3 w-3 mr-1 inline" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] mt-1">
                        {d.file_name} · {formatBytes(d.file_size_bytes)} · {d.chunk_count} chunks ·{' '}
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                      {d.summary && (
                        <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-3">{d.summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" icon={Download} onClick={() => void handleDownload(d)} aria-label="Download" />
                      {canModify(d) && (
                        <>
                          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => void handleReprocess(d)} aria-label="Reprocess" />
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => void handleDelete(d)} aria-label="Delete" />
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
