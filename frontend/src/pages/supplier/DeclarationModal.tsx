import { useState, useCallback } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { cn } from '../../utils/cn'

interface DeclarationModalProps {
  isOpen: boolean
  onClose: () => void
  onAccepted: () => void
  onAccept: (declarations: {
    declaration_rfq_terms: boolean
    declaration_no_collusion: boolean
    declaration_confidentiality: boolean
  }) => Promise<void>
}

const DECLARATIONS = [
  {
    title: 'Terms & Conditions',
    body: 'I have read, understood, and agree to be bound by all terms and conditions set out in this Request for Quotation, including the commercial terms, delivery requirements, and any special conditions specified by the buyer.',
  },
  {
    title: 'No Collusion',
    body: 'I declare that this quotation has been prepared independently and without consultation, communication, or agreement with any competitor regarding prices, methods, factors, or terms of the quotation. No attempt has been made or will be made to restrict competition.',
  },
  {
    title: 'Confidentiality',
    body: 'I acknowledge that all pricing information, bid details, and commercial data submitted through this platform are strictly confidential. I agree not to disclose, share, or communicate any such information to any third party, competitor, or unauthorized person.',
  },
] as const

export function DeclarationModal({ isOpen, onClose, onAccepted, onAccept }: DeclarationModalProps) {
  const [checked, setChecked] = useState([false, false, false])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justBecameReady, setJustBecameReady] = useState(false)

  const confirmedCount = checked.filter(Boolean).length
  const allConfirmed = confirmedCount === 3

  const toggleDeclaration = useCallback((index: number) => {
    setChecked((prev) => {
      const next = [...prev]
      next[index] = !next[index]

      // Check if this toggle completes all three
      const willBeAllConfirmed = next.every(Boolean)
      if (willBeAllConfirmed && !allConfirmed) {
        setJustBecameReady(true)
        setTimeout(() => setJustBecameReady(false), 400)
      }

      return next
    })
  }, [allConfirmed])

  const handleAccept = async () => {
    if (!allConfirmed) return
    setIsSubmitting(true)
    try {
      await onAccept({
        declaration_rfq_terms: checked[0],
        declaration_no_collusion: checked[1],
        declaration_confidentiality: checked[2],
      })
      onAccepted()
      onClose()
    } catch {
      // error handled by caller (toast)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    setChecked([false, false, false])
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Accept Participation" size="md">
      <p className="text-sm text-text-secondary mb-5">
        Read and confirm each declaration to proceed.
      </p>

      {/* Declaration cards */}
      <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto">
        {DECLARATIONS.map((decl, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggleDeclaration(i)}
            className={cn(
              'flex items-start gap-3 w-full text-left border rounded-md p-4 transition-all duration-150',
              checked[i]
                ? 'border-blue bg-blue-light/30'
                : 'border-grey-200 bg-white hover:border-grey-300'
            )}
          >
            {/* Custom checkbox */}
            <span
              className={cn(
                'flex-shrink-0 w-6 h-6 rounded-[6px] border-2 flex items-center justify-center transition-all duration-150 mt-0.5',
                checked[i]
                  ? 'bg-blue border-blue'
                  : 'bg-white border-grey-300'
              )}
              aria-hidden="true"
            >
              {checked[i] && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7.5L5.5 10L11 4"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>

            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-text-primary block">
                {decl.title}
              </span>
              <span className="text-[13px] text-grey-700 leading-relaxed block mt-0.5">
                {decl.body}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Progress tracker */}
      <div className="flex items-center gap-3 mt-5 mb-5">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors duration-200',
                checked[i] ? 'bg-blue' : 'bg-grey-300'
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            'text-[13px] font-medium transition-colors duration-200 flex items-center gap-1',
            allConfirmed ? 'text-green' : 'text-text-secondary'
          )}
        >
          {allConfirmed && <CheckCircle size={16} weight="fill" />}
          {confirmedCount} of 3 confirmed
        </span>
      </div>

      {/* Accept button */}
      <Button
        variant="primary"
        size="lg"
        disabled={!allConfirmed}
        isLoading={isSubmitting}
        onClick={handleAccept}
        className={cn(
          'w-full transition-all duration-150',
          !allConfirmed && 'opacity-[0.38] cursor-not-allowed',
          justBecameReady && 'animate-[pulseScale_300ms_ease-out]'
        )}
      >
        {allConfirmed ? 'Accept Participation' : 'Confirm all declarations to continue'}
      </Button>

      {/* Cancel link */}
      <div className="text-center mt-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="text-[13px] text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </Modal>
  )
}
