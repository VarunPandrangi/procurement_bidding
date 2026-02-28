import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Gear,
  PencilSimple,
  Check,
  X,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  getSystemConfig,
  updateSystemConfig,
  type SystemConfig,
} from '../../api/admin.api'
import { Skeleton } from '../../components/ui/Skeleton'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../store/toastStore'

// ─── Format helpers ─────────────────────────────────
function formatTimestamp(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = d.getDate().toString().padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const year = d.getFullYear()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${day} ${mon} ${year} · ${hh}:${mm}`
}

// ─── System Configuration ───────────────────────────
export function SystemConfiguration() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: configs, isLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: getSystemConfig,
  })

  // Inline edit state
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmEdit, setConfirmEdit] = useState<{ key: string; oldValue: string; newValue: string; description: string } | null>(null)

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSystemConfig(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-config'] })
      toast.success('Configuration updated')
      setConfirmEdit(null)
      setEditingKey(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update configuration')
      setConfirmEdit(null)
    },
  })

  const startEdit = (config: SystemConfig) => {
    setEditingKey(config.key)
    setEditValue(config.value)
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const handleSave = (config: SystemConfig) => {
    if (editValue === config.value) {
      cancelEdit()
      return
    }
    setConfirmEdit({
      key: config.key,
      oldValue: config.value,
      newValue: editValue,
      description: config.description,
    })
  }

  const handleConfirmSave = async () => {
    if (!confirmEdit) return
    await updateMutation.mutateAsync({ key: confirmEdit.key, value: confirmEdit.newValue })
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">System Configuration</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage platform-wide settings and configuration values.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 bg-yellow/10 border border-yellow/30 rounded-lg p-4 mb-6">
        <WarningCircle size={20} weight="fill" className="text-yellow shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-text-primary">
            Changes take effect immediately
          </p>
          <p className="text-sm text-text-secondary mt-0.5">
            Modifying these values will impact platform behavior. All changes are recorded in the audit log.
          </p>
        </div>
      </div>

      {/* Config Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-subtle border-b border-grey-200">
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Key</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Description</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Value</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Last Updated</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Updated By</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-grey-100 last:border-0">
                    <td className="px-5 py-3.5"><Skeleton width={120} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={200} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={80} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={120} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={100} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={24} height={24} borderRadius={4} /></td>
                  </tr>
                ))
              ) : !configs || configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <Gear size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" aria-hidden="true" />
                    <p className="text-base font-medium text-grey-800">No configuration entries</p>
                    <p className="text-sm text-text-secondary mt-1">System configuration values will appear here.</p>
                  </td>
                </tr>
              ) : (
                configs.map((config) => {
                  const isEditing = editingKey === config.key
                  return (
                    <tr
                      key={config.key}
                      className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm text-text-primary font-medium">
                          {config.key}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary max-w-[250px]">
                        {config.description}
                      </td>
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(config)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              className="h-8 px-2 w-full min-w-[120px] max-w-[200px] font-mono text-sm border border-blue rounded-DEFAULT bg-white outline-none focus:ring-[3px] focus:ring-blue/30"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSave(config)}
                              className="p-1 rounded-DEFAULT text-green hover:bg-green-light transition-colors"
                              aria-label="Save"
                            >
                              <Check size={16} weight="bold" aria-hidden="true" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 rounded-DEFAULT text-grey-500 hover:text-red hover:bg-red-light transition-colors"
                              aria-label="Cancel"
                            >
                              <X size={16} weight="bold" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-sm text-text-primary bg-bg-subtle px-2 py-0.5 rounded">
                            {config.value}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-text-secondary whitespace-nowrap">
                        {formatTimestamp(config.updated_at)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {config.updated_by || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        {!isEditing && (
                          <button
                            onClick={() => startEdit(config)}
                            className="p-1.5 rounded-DEFAULT text-grey-500 hover:text-blue hover:bg-blue-light transition-colors"
                            aria-label={`Edit ${config.key}`}
                          >
                            <PencilSimple size={18} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmEdit}
        title="Update Configuration"
        message={`Are you sure you want to update "${confirmEdit?.key}"?`}
        detail={confirmEdit ? `${confirmEdit.oldValue} → ${confirmEdit.newValue}` : undefined}
        confirmLabel="Save Changes"
        confirmVariant="primary"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmEdit(null)}
      />
    </div>
  )
}
