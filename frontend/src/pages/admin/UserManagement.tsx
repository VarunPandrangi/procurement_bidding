import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  MagnifyingGlass,
  UserPlus,
  DotsThreeVertical,
  WarningCircle,
  CheckCircle,
} from '@phosphor-icons/react'
import {
  getAdminUsers,
  createUser,
  deactivateUser,
  reactivateUser,
  type AdminUser,
  type CreateUserPayload,
} from '../../api/admin.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SlideOver } from '../../components/ui/SlideOver'
import { Avatar } from '../../components/ui/Avatar'
import { useToast } from '../../store/toastStore'

// ─── Password Strength ─────────────────────────────
function getPasswordStrength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  return { level: score, label: labels[score] }
}

const strengthColors = ['', 'bg-red', 'bg-yellow', 'bg-blue', 'bg-green']

function PasswordStrengthBar({ password }: { password: string }) {
  const { level, label } = getPasswordStrength(password)
  if (!password) return null
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((seg) => (
          <div
            key={seg}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              seg <= level ? strengthColors[level] : 'bg-grey-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${level <= 1 ? 'text-red' : level === 2 ? 'text-yellow' : level === 3 ? 'text-blue' : 'text-green'}`}>
        {label}
      </p>
    </div>
  )
}

// ─── Kebab Menu ─────────────────────────────────────
function KebabMenu({
  user,
  onDeactivate,
  onReactivate,
}: {
  user: AdminUser
  onDeactivate: () => void
  onReactivate: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-DEFAULT text-grey-500 hover:text-text-primary hover:bg-bg-subtle transition-colors"
        aria-label="Actions"
      >
        <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-lg shadow-dropdown border border-grey-200 py-1 w-44">
            {user.is_active ? (
              <button
                onClick={() => { setOpen(false); onDeactivate() }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red hover:bg-red-light transition-colors"
              >
                <WarningCircle size={16} aria-hidden="true" />
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => { setOpen(false); onReactivate() }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-green hover:bg-green-light transition-colors"
              >
                <CheckCircle size={16} aria-hidden="true" />
                Reactivate
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Format ─────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// ─── User Management ────────────────────────────────
export function UserManagement() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // Data
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create user
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    email: '',
    password: '',
    full_name: '',
    role: '',
  })
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User created')
      setShowCreate(false)
      setCreateForm({ email: '', password: '', full_name: '', role: '' })
      setCreateErrors({})
    },
    onError: (err: any) => {
      const resp = err?.response?.data
      if (err?.response?.status === 422 && resp?.errors) {
        const mapped: Record<string, string> = {}
        for (const e of resp.errors) {
          if (e.field) mapped[e.field] = e.message
        }
        setCreateErrors(mapped)
      } else if (err?.response?.status === 409) {
        setCreateErrors({ email: resp?.message || 'Email already exists' })
      } else {
        toast.error(resp?.message || 'Failed to create user')
      }
    },
  })

  // Deactivate / Reactivate
  const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'reactivate'; user: AdminUser } | null>(null)

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User deactivated')
      setConfirmAction(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to deactivate user')
      setConfirmAction(null)
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('User reactivated')
      setConfirmAction(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reactivate user')
      setConfirmAction(null)
    },
  })

  // Filtered users
  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()))
      const matchRole = !roleFilter || u.role === roleFilter
      const matchStatus =
        !statusFilter ||
        (statusFilter === 'active' && u.is_active) ||
        (statusFilter === 'inactive' && !u.is_active)
      return matchSearch && matchRole && matchStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const handleCreateSubmit = () => {
    const errors: Record<string, string> = {}
    if (!createForm.email) errors.email = 'Email is required'
    if (!createForm.password) errors.password = 'Password is required'
    if (!createForm.full_name) errors.full_name = 'Name is required'
    if (!createForm.role) errors.role = 'Role is required'
    if (createForm.role === 'SUPPLIER' && !createForm.company_name) {
      errors.company_name = 'Company name is required for suppliers'
    }
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors)
      return
    }
    setCreateErrors({})
    createMutation.mutate(createForm)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">User Management</h1>
        <Button onClick={() => setShowCreate(true)}>
          <UserPlus size={18} weight="bold" aria-hidden="true" />
          Create User
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by email or name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            <MagnifyingGlass
              size={16}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-text-secondary pointer-events-none"
              aria-hidden="true"
              style={{ position: 'relative', top: -30, left: 10 }}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: '', label: 'All Roles' },
                { value: 'ADMIN', label: 'Admin' },
                { value: 'BUYER', label: 'Buyer' },
                { value: 'SUPPLIER', label: 'Supplier' },
              ]}
              value={roleFilter}
              onChange={setRoleFilter}
              placeholder="All Roles"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              options={[
                { value: '', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="All Status"
            />
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-subtle border-b border-grey-200">
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">User</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Joined</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Code</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-grey-100 last:border-0">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton width={32} height={32} borderRadius={999} />
                        <div>
                          <Skeleton width={150} height={14} className="mb-1" />
                          <Skeleton width={100} height={12} />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><Skeleton width={60} height={20} borderRadius={999} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={60} height={20} borderRadius={999} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={80} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={50} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={24} height={24} borderRadius={4} /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <MagnifyingGlass size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" aria-hidden="true" />
                    <p className="text-base font-medium text-grey-800">No users match your filters</p>
                    <p className="text-sm text-text-secondary mt-1">Try adjusting your search term or clearing the filters.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.full_name} size="sm" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{user.email}</div>
                          <div className="text-sm text-text-secondary truncate">{user.full_name || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={user.role === 'ADMIN' ? 'ACTIVE' : user.role === 'BUYER' ? 'PUBLISHED' : 'PENDING'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={user.is_active ? 'ACCEPTED' : 'DECLINED'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      {user.supplier_code ? (
                        <span className="font-mono text-sm text-grey-700 bg-bg-subtle px-2 py-0.5 rounded">
                          {user.supplier_code}
                        </span>
                      ) : (
                        <span className="text-sm text-grey-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <KebabMenu
                        user={user}
                        onDeactivate={() => setConfirmAction({ type: 'deactivate', user })}
                        onReactivate={() => setConfirmAction({ type: 'reactivate', user })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deactivate / Reactivate Confirm */}
      <ConfirmDialog
        isOpen={confirmAction?.type === 'deactivate'}
        title={`Deactivate ${confirmAction?.user.email}?`}
        message="This user will be immediately signed out and unable to log in."
        detail="Their data and history will be preserved."
        confirmLabel="Deactivate user"
        confirmVariant="danger"
        onConfirm={async () => {
          if (confirmAction) await deactivateMutation.mutateAsync(confirmAction.user.id)
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        isOpen={confirmAction?.type === 'reactivate'}
        title={`Reactivate ${confirmAction?.user.email}?`}
        message="This user will be able to log in again immediately."
        confirmLabel="Reactivate user"
        confirmVariant="primary"
        onConfirm={async () => {
          if (confirmAction) await reactivateMutation.mutateAsync(confirmAction.user.id)
        }}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Create User Slide-Over */}
      <SlideOver
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setCreateErrors({}) }}
        title="New User"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateErrors({}) }}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} isLoading={createMutation.isPending}>
              Create User
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <Input
            label="Email"
            type="email"
            required
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            error={createErrors.email}
          />
          <Input
            label="Full Name"
            required
            value={createForm.full_name}
            onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
            error={createErrors.full_name}
          />
          <div>
            <Input
              label="Password"
              type="password"
              required
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              error={createErrors.password}
            />
            <PasswordStrengthBar password={createForm.password} />
          </div>
          <Select
            label="Role"
            required
            options={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'BUYER', label: 'Buyer' },
              { value: 'SUPPLIER', label: 'Supplier' },
            ]}
            value={createForm.role}
            onChange={(val) => setCreateForm({ ...createForm, role: val })}
            error={createErrors.role}
          />
          {createForm.role === 'SUPPLIER' && (
            <>
              <Input
                label="Company Name"
                required
                value={createForm.company_name || ''}
                onChange={(e) => setCreateForm({ ...createForm, company_name: e.target.value })}
                error={createErrors.company_name}
              />
              <Input
                label="Contact Name"
                value={createForm.contact_name || ''}
                onChange={(e) => setCreateForm({ ...createForm, contact_name: e.target.value })}
              />
            </>
          )}
        </div>
      </SlideOver>
    </div>
  )
}
