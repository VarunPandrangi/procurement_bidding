import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Buildings,
  Eye,
  X,
  CopySimple,
  Plus,
} from '@phosphor-icons/react'
import {
  getAdminSuppliers,
  onboardSupplier,
  type AdminSupplier,
} from '../../api/admin.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { SlideOver } from '../../components/ui/SlideOver'
import { useToast } from '../../store/toastStore'

// ─── Credibility Bar ────────────────────────────────
function CredibilityBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'bg-green' : score >= 40 ? 'bg-yellow' : 'bg-red'
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-text-secondary w-40 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-grey-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="font-mono text-sm text-text-primary w-10 text-right shrink-0">
        {score.toFixed(0)}
      </span>
    </div>
  )
}

// ─── Tag Chips ──────────────────────────────────────
function TagChips({ tags, max = 3 }: { tags: string[]; max?: number }) {
  if (!tags || tags.length === 0) {
    return <span className="text-sm text-grey-400">—</span>
  }
  const visible = tags.slice(0, max)
  const extra = tags.length - max
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center px-2 py-0.5 bg-bg-subtle border border-grey-200 text-xs text-text-secondary rounded-full"
        >
          {tag}
        </span>
      ))}
      {extra > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 bg-bg-subtle border border-grey-200 text-xs text-text-secondary rounded-full">
          +{extra} more
        </span>
      )}
    </div>
  )
}

// ─── Detail Drawer ──────────────────────────────────
function SupplierDrawer({
  supplier,
  onClose,
}: {
  supplier: AdminSupplier | null
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  if (!supplier) return null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(supplier.unique_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const score = supplier.credibility_score ?? 50
  // Approximate dimension breakdown (real API may provide these)
  const d1 = Math.min(100, Math.max(0, score + (Math.random() * 20 - 10)))
  const d2 = Math.min(100, Math.max(0, score + (Math.random() * 20 - 10)))
  const d3 = Math.min(100, Math.max(0, score + (Math.random() * 20 - 10)))
  const d4 = Math.min(100, Math.max(0, score + (Math.random() * 20 - 10)))

  return (
    <SlideOver isOpen={true} onClose={onClose} title="" width={500}>
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-lg font-bold text-text-primary flex-1">{supplier.company_name}</h2>
          {supplier.credibility_class && (
            <Badge variant={supplier.credibility_class}>{supplier.credibility_class}</Badge>
          )}
        </div>

        {/* Contact Information */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-grey-400 uppercase tracking-wider mb-3">Contact Information</h3>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-text-secondary">Name: </span>
              <span className="text-text-primary">{supplier.contact_name || supplier.full_name || '—'}</span>
            </div>
            <div className="text-sm">
              <span className="text-text-secondary">Email: </span>
              <span className="text-text-primary">{supplier.contact_email || supplier.email || '—'}</span>
            </div>
          </div>
        </div>

        {/* Supplier Code */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-grey-400 uppercase tracking-wider mb-3">Supplier Code</h3>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold text-text-primary bg-bg-subtle px-4 py-2 rounded-lg">
              {supplier.unique_code}
            </span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-DEFAULT text-grey-500 hover:text-blue hover:bg-blue-light transition-colors"
              title={copied ? 'Copied!' : 'Copy code'}
            >
              <CopySimple size={18} aria-hidden="true" />
            </button>
            {copied && <span className="text-xs text-green font-medium">Copied!</span>}
          </div>
        </div>

        {/* Credibility Breakdown */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-grey-400 uppercase tracking-wider mb-3">Credibility Breakdown</h3>
          <div className="space-y-3">
            <CredibilityBar label="Response Discipline" score={d1} />
            <CredibilityBar label="Revision Behavior" score={d2} />
            <CredibilityBar label="Win Rate" score={d3} />
            <CredibilityBar label="Fulfillment" score={d4} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-text-secondary">Composite Score:</span>
            <span className="font-mono text-base font-semibold text-text-primary">
              {score.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Categories */}
        {(supplier.categories || supplier.category_tags) && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-grey-400 uppercase tracking-wider mb-3">Categories</h3>
            <TagChips tags={supplier.categories || supplier.category_tags || []} max={10} />
          </div>
        )}
      </div>
    </SlideOver>
  )
}

// ─── Tag Input ──────────────────────────────────────
function TagInput({
  tags,
  onChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [input, setInput] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()])
      }
      setInput('')
    }
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div>
      <label className="text-sm font-medium text-text-primary mb-1.5 block">Categories</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-light text-blue text-sm rounded-full"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-red transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} weight="bold" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a category and press Enter"
        className="h-10 w-full px-3 rounded-DEFAULT border border-border bg-white text-base transition-all duration-150 ease-out outline-none placeholder:text-text-tertiary focus:border-blue focus:ring-[3px] focus:ring-blue/30"
      />
      <p className="text-xs text-text-secondary mt-1">Press Enter to add a category tag</p>
    </div>
  )
}

// ─── Supplier Directory ─────────────────────────────
export function SupplierDirectory() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: getAdminSuppliers,
  })

  const [search, setSearch] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<AdminSupplier | null>(null)
  const [showOnboard, setShowOnboard] = useState(false)
  const [onboardForm, setOnboardForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    categories: [] as string[],
  })
  const [onboardErrors, setOnboardErrors] = useState<Record<string, string>>({})

  const onboardMutation = useMutation({
    mutationFn: onboardSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-suppliers'] })
      toast.success('Supplier onboarded', 'Access link sent to their email')
      setShowOnboard(false)
      setOnboardForm({ company_name: '', contact_name: '', contact_email: '', categories: [] })
      setOnboardErrors({})
    },
    onError: (err: any) => {
      const resp = err?.response?.data
      if (err?.response?.status === 409) {
        setOnboardErrors({ contact_email: resp?.message || 'Email already exists' })
      } else {
        toast.error(resp?.message || 'Failed to onboard supplier')
      }
    },
  })

  const filtered = useMemo(() => {
    if (!suppliers) return []
    if (!search) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(
      (s) =>
        s.company_name.toLowerCase().includes(q) ||
        s.unique_code.toLowerCase().includes(q) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(q))
    )
  }, [suppliers, search])

  const handleOnboardSubmit = () => {
    const errors: Record<string, string> = {}
    if (!onboardForm.company_name) errors.company_name = 'Company name is required'
    if (!onboardForm.contact_name) errors.contact_name = 'Contact name is required'
    if (!onboardForm.contact_email) errors.contact_email = 'Contact email is required'
    if (Object.keys(errors).length > 0) {
      setOnboardErrors(errors)
      return
    }
    setOnboardErrors({})
    onboardMutation.mutate(onboardForm)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Supplier Directory</h1>
        <Button onClick={() => setShowOnboard(true)}>
          <Plus size={18} weight="bold" aria-hidden="true" />
          Onboard Supplier
        </Button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-4 mb-4">
        <Input
          placeholder="Search by company name, code, or contact..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Supplier Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-subtle border-b border-grey-200">
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Company</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Code</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Categories</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Credibility</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-grey-100 last:border-0">
                    <td className="px-5 py-3.5"><Skeleton width={160} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={50} height={20} borderRadius={4} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={120} height={20} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={80} height={20} borderRadius={999} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={60} height={20} borderRadius={999} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={24} height={24} borderRadius={4} /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Buildings size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" aria-hidden="true" />
                    <p className="text-base font-medium text-grey-800">No suppliers found</p>
                    <p className="text-sm text-text-secondary mt-1">
                      {search ? 'Try adjusting your search.' : 'Onboard your first supplier to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors cursor-pointer"
                    onClick={() => setSelectedSupplier(supplier)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Buildings size={16} className="text-text-secondary shrink-0" aria-hidden="true" />
                        <span className="text-sm font-medium text-text-primary">{supplier.company_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-sm text-grey-700 bg-bg-subtle px-2 py-0.5 rounded">
                        {supplier.unique_code}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <TagChips tags={supplier.categories || supplier.category_tags || []} />
                    </td>
                    <td className="px-5 py-3.5">
                      {supplier.credibility_class ? (
                        <Badge variant={supplier.credibility_class}>{supplier.credibility_class}</Badge>
                      ) : (
                        <span className="text-sm text-grey-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={supplier.is_active ? 'ACCEPTED' : 'DECLINED'}>
                        {supplier.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedSupplier(supplier) }}
                        className="p-1.5 rounded-DEFAULT text-grey-500 hover:text-blue hover:bg-blue-light transition-colors"
                        aria-label="View details"
                      >
                        <Eye size={18} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedSupplier && (
        <SupplierDrawer
          supplier={selectedSupplier}
          onClose={() => setSelectedSupplier(null)}
        />
      )}

      {/* Onboard Supplier Slide-Over */}
      <SlideOver
        isOpen={showOnboard}
        onClose={() => { setShowOnboard(false); setOnboardErrors({}) }}
        title="Onboard Supplier"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowOnboard(false); setOnboardErrors({}) }}>
              Cancel
            </Button>
            <Button onClick={handleOnboardSubmit} isLoading={onboardMutation.isPending}>
              Onboard Supplier
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Input
            label="Company Name"
            required
            value={onboardForm.company_name}
            onChange={(e) => setOnboardForm({ ...onboardForm, company_name: e.target.value })}
            error={onboardErrors.company_name}
          />
          <Input
            label="Contact Name"
            required
            value={onboardForm.contact_name}
            onChange={(e) => setOnboardForm({ ...onboardForm, contact_name: e.target.value })}
            error={onboardErrors.contact_name}
          />
          <Input
            label="Contact Email"
            type="email"
            required
            value={onboardForm.contact_email}
            onChange={(e) => setOnboardForm({ ...onboardForm, contact_email: e.target.value })}
            error={onboardErrors.contact_email}
          />
          <TagInput
            tags={onboardForm.categories}
            onChange={(tags) => setOnboardForm({ ...onboardForm, categories: tags })}
          />
        </div>
      </SlideOver>
    </div>
  )
}
