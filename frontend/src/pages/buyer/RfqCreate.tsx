import { useState, useCallback } from 'react'
import { StepProgressIndicator } from '../../components/ui/StepProgressIndicator'
import { defaultFormData, type RfqFormData } from './rfqFormSchema'
import { StepItems } from './wizard/StepItems'
import { StepCommercialTerms } from './wizard/StepCommercialTerms'
import { StepBiddingRules } from './wizard/StepBiddingRules'
import { StepSuppliers } from './wizard/StepSuppliers'
import { StepReview } from './wizard/StepReview'

const STEPS = [
  { label: 'Items' },
  { label: 'Commercial Terms' },
  { label: 'Bidding Rules' },
  { label: 'Suppliers' },
  { label: 'Review' },
]

export function RfqCreate() {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [data, setData] = useState<RfqFormData>(defaultFormData)

  const handleChange = useCallback((partial: Partial<RfqFormData>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const handleNext = useCallback(() => {
    setCompletedSteps((prev) => prev.includes(currentStep) ? prev : [...prev, currentStep])
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }, [currentStep])

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }, [])

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary tracking-tight mb-4">New Enquiry</h1>

      <StepProgressIndicator
        steps={STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
      />

      <div className="mt-6">
        {currentStep === 0 && (
          <StepItems data={data} onChange={handleChange} onNext={handleNext} />
        )}
        {currentStep === 1 && (
          <StepCommercialTerms data={data} onChange={handleChange} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 2 && (
          <StepBiddingRules data={data} onChange={handleChange} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 3 && (
          <StepSuppliers data={data} onChange={handleChange} onNext={handleNext} onBack={handleBack} />
        )}
        {currentStep === 4 && (
          <StepReview data={data} onBack={handleBack} />
        )}
      </div>
    </div>
  )
}
