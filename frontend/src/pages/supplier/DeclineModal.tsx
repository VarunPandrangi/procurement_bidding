import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { cn } from '../../utils/cn'

interface DeclineModalProps {
  isOpen: boolean
  onClose: () => void
  onDeclined: () => void
  onDecline: (reason: string) => Promise<void>
}

const MIN_LENGTH = 20
const MAX_LENGTH = 500

export function DeclineModal({ isOpen, onClose, onDeclined, onDecline }: DeclineModalProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isValid = reason.trim().length >= MIN_LENGTH
  const charCount = reason.length

  const handleDecline = async () => {
    if (!isValid) return
    setIsSubmitting(true)
    try {
      await onDecline(reason.trim())
      onDeclined()
      onClose()
    } catch {
      // error handled by caller (toast)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    setReason('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Decline Participation" size="sm">
      <p className="text-sm text-text-secondary mb-4">
        Your reason will be recorded with your response.
      </p>

      {/* Reason textarea */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="decline-reason" className="text-sm font-medium text-text-primary">
          Reason for declining <span className="text-red">*</span>
        </label>
        <textarea
          id="decline-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Please explain why you are declining this enquiry..."
          className={cn(
            'w-full min-h-[100px] rounded-DEFAULT border px-3 py-2.5 text-sm text-text-primary resize-y',
            'transition-colors duration-150 outline-none',
            'placeholder:text-text-tertiary',
            'focus:border-blue focus:ring-2 focus:ring-blue/20',
            'border-grey-300'
          )}
          disabled={isSubmitting}
        />

        {/* Character counter */}
        <div className="flex justify-end">
          <span
            className={cn(
              'text-xs transition-colors duration-200',
              charCount > 0 && charCount < MIN_LENGTH
                ? 'text-yellow'
                : 'text-text-secondary'
            )}
          >
            {charCount}/{MAX_LENGTH}
            {charCount > 0 && charCount < MIN_LENGTH && (
              <> · Please enter at least {MIN_LENGTH} characters</>
            )}
          </span>
        </div>
      </div>

      {/* Decline button */}
      <Button
        variant="danger"
        size="lg"
        disabled={!isValid}
        isLoading={isSubmitting}
        onClick={handleDecline}
        className="w-full mt-4"
      >
        Decline Enquiry
      </Button>
    </Modal>
  )
}
