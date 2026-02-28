import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PencilSimple,
  PaperPlaneTilt,
  X,
  Play,
  Gavel,
  FileXls,
  FilePdf,
  Lock,
} from '@phosphor-icons/react'
import {
  getBuyerRfq,
  publishRfq,
  closeRfq,
  exportExcel,
  exportPdf,
  getFlags,
  type RfqDetail as RfqDetailType,
} from '../../api/rfq.api'
import { StatusTimeline } from '../../components/ui/StatusTimeline'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../store/toastStore'
import { formatDateTime } from '../../utils/format'
import { cn } from '../../utils/cn'
import { OverviewTab } from './detail/OverviewTab'
import { LiveRankingsTab } from './detail/LiveRankingsTab'
import { ComplianceFlagsTab } from './detail/ComplianceFlagsTab'
import { AuditLogTab } from './detail/AuditLogTab'

type Tab = 'overview' | 'rankings' | 'flags' | 'audit'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'rankings', label: 'Live Rankings' },
  { id: 'flags', label: 'Compliance Flags' },
  { id: 'audit', label: 'Audit Log' },
]

export function RfqDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [confirmAction, setConfirmAction] = useState<'publish' | 'close' | null>(null)

  const { data: rfq, isLoading } = useQuery({
    queryKey: ['buyer-rfq', id],
    queryFn: () => getBuyerRfq(id!),
    enabled: !!id,
  })

  const { data: flags } = useQuery({
    queryKey: ['rfq-flags', id],
    queryFn: () => getFlags(id!),
    enabled: !!id,
  })

  const activeFlagCount = flags?.filter((f) => f.is_active).length ?? 0

  const publishMutation = useMutation({
    mutationFn: () => publishRfq(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq', id] })
      toast.success('Enquiry published')
      setConfirmAction(null)
    },
    onError: () => toast.error('Failed to publish enquiry'),
  })

  const closeMutation = useMutation({
    mutationFn: () => closeRfq(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq', id] })
      toast.success('Enquiry closed')
      setConfirmAction(null)
    },
    onError: () => toast.error('Failed to close enquiry'),
  })

  async function handleExport(type: 'excel' | 'pdf') {
    try {
      const blob = type === 'excel' ? await exportExcel(id!) : await exportPdf(id!)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rfq?.rfq_number ?? 'export'}.${type === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(`Failed to export ${type.toUpperCase()}`)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton width="100%" height={120} borderRadius={8} />
        <Skeleton width="100%" height={48} borderRadius={8} />
        <Skeleton width="100%" height={300} borderRadius={8} />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="text-center py-20">
        <p className="text-base text-text-secondary">Enquiry not found.</p>
        <Link to="/buyer/rfqs" className="text-sm text-blue hover:text-blue-hover mt-2 inline-block">
          Back to Enquiries
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header Card */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-sm text-text-secondary">{rfq.rfq_number}</span>
              <Badge variant={rfq.status} />
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">{rfq.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {rfq.status === 'ACTIVE' && rfq.bid_close_at && (
              <CountdownTimer targetDate={rfq.bid_close_at} size="lg" />
            )}
            <ActionButtons
              rfq={rfq}
              onPublish={() => setConfirmAction('publish')}
              onClose={() => setConfirmAction('close')}
              onExportExcel={() => handleExport('excel')}
              onExportPdf={() => handleExport('pdf')}
              onNavigate={navigate}
            />
          </div>
        </div>

        <StatusTimeline currentStatus={rfq.status} variant="full" />

        {rfq.commercial_locked_at && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-yellow-light border-l-4 border-l-yellow rounded-DEFAULT text-sm">
            <Lock size={20} weight="fill" className="text-yellow flex-shrink-0" />
            <span className="text-text-primary">
              Commercial terms locked — {rfq.commercial_locked_by_supplier_code} accepted on {formatDateTime(rfq.commercial_locked_at)}
            </span>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card mb-6">
        <div className="flex border-b border-grey-200 sticky top-0 z-10 bg-white rounded-t-lg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-3 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-blue'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tab.label}
              {tab.id === 'flags' && activeFlagCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-light text-yellow">
                  {activeFlagCount}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue" />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && <OverviewTab rfq={rfq} />}
          {activeTab === 'rankings' && <LiveRankingsTab rfq={rfq} />}
          {activeTab === 'flags' && <ComplianceFlagsTab rfqId={rfq.id} />}
          {activeTab === 'audit' && <AuditLogTab rfqId={rfq.id} />}
        </div>
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={confirmAction === 'publish'}
        title="Publish this enquiry?"
        message={`This will notify ${rfq.suppliers.length} supplier${rfq.suppliers.length !== 1 ? 's' : ''} and open the bid window on ${rfq.bid_open_at ? new Date(rfq.bid_open_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'the scheduled date'}.`}
        detail="Commercial terms will lock once the first supplier accepts."
        confirmLabel="Publish"
        onConfirm={async () => { await publishMutation.mutateAsync() }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        isOpen={confirmAction === 'close'}
        title="Close this enquiry early?"
        message="No further bids will be accepted after closing. This cannot be undone."
        detail="All suppliers will be notified that the bid window has closed."
        confirmLabel="Close Enquiry"
        confirmVariant="danger"
        onConfirm={async () => { await closeMutation.mutateAsync() }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  )
}

function ActionButtons({ rfq, onPublish, onClose, onExportExcel, onExportPdf, onNavigate }: {
  rfq: RfqDetailType
  onPublish: () => void
  onClose: () => void
  onExportExcel: () => void
  onExportPdf: () => void
  onNavigate: (path: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {rfq.status === 'DRAFT' && (
        <>
          <Button variant="secondary" size="sm" onClick={() => onNavigate(`/buyer/rfqs/${rfq.id}`)}>
            <PencilSimple size={16} className="mr-1" /> Edit
          </Button>
          <Button size="sm" onClick={onPublish}>
            <PaperPlaneTilt size={16} className="mr-1" /> Publish
          </Button>
        </>
      )}
      {(rfq.status === 'PUBLISHED' || rfq.status === 'ACTIVE') && (
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X size={16} className="mr-1" /> Close Early
        </Button>
      )}
      {rfq.status === 'CLOSED' && (
        <>
          <Button variant="secondary" size="sm" onClick={() => onNavigate(`/buyer/rfqs/${rfq.id}/simulate`)}>
            <Play size={16} className="mr-1" /> Simulate
          </Button>
          <Button size="sm" onClick={() => onNavigate(`/buyer/rfqs/${rfq.id}/award`)}>
            <Gavel size={16} className="mr-1" /> Finalise
          </Button>
        </>
      )}
      {(rfq.status === 'CLOSED' || rfq.status === 'AWARDED') && (
        <>
          <Button variant="secondary" size="sm" onClick={onExportExcel}>
            <FileXls size={16} />
          </Button>
          <Button variant="secondary" size="sm" onClick={onExportPdf}>
            <FilePdf size={16} />
          </Button>
        </>
      )}
    </div>
  )
}
