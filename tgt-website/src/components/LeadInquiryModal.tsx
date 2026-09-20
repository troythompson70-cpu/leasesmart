import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { submitAssessmentInquiry, type AssessmentInquiryPayload } from '../lib/intake'
import { track, type CtaEvent } from '../lib/track'

export type LeadKind = 'remote' | 'referral' | 'gates' | 'assessment'

type LeadInquiryModalProps = {
  kind: LeadKind
  onClose: () => void
}

const COPY: Record<
  LeadKind,
  {
    eyebrow: string
    title: string
    trackEvent: CtaEvent
    source: AssessmentInquiryPayload['source']
    prefill: string
    showCompany: boolean
    success: string
  }
> = {
  remote: {
    eyebrow: 'Remote help',
    title: 'Request remote help from TGT',
    trackEvent: 'remote_help_inquiry',
    source: 'tgt-website-remote-help',
    prefill:
      "I'd like remote computer help from TGT.\n\nName:\nPhone:\nBest time to call:\nIssue:",
    showCompany: false,
    success: 'Thank you — TGT received your remote-help request and will call you back.',
  },
  referral: {
    eyebrow: 'Referral',
    title: 'Refer a business to TGT',
    trackEvent: 'referral_click',
    source: 'tgt-website-referral',
    prefill: [
      'I want to refer a business to TGT.',
      '',
      'My name:',
      'My email:',
      'My phone:',
      '',
      'Business name:',
      'Contact name:',
      'Contact phone/email:',
      'What they need:',
    ].join('\n'),
    showCompany: true,
    success: 'Thank you — TGT received your referral.',
  },
  gates: {
    eyebrow: 'Ask Gates',
    title: 'Ask Gates a question',
    trackEvent: 'ask_gates_click',
    source: 'tgt-website-ask-gates',
    prefill: 'Question for Gates:\n',
    showCompany: false,
    success: 'Thank you — Gates / TGT received your question.',
  },
  assessment: {
    eyebrow: 'Business IT',
    title: 'Request a free IT assessment',
    trackEvent: 'business_assessment_click',
    source: 'tgt-website-assessment',
    prefill: 'What the business needs from TGT:\n',
    showCompany: true,
    success: 'Thank you — TGT received your assessment request and will call you back.',
  },
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function LeadInquiryModal({ kind, onClose }: LeadInquiryModalProps) {
  const copy = COPY[kind]
  const titleId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState(copy.prefill)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<SubmitState>('idle')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && status !== 'submitting') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, status])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)

    if (!trimmedName || !validEmail || !trimmedPhone) {
      setStatus('error')
      setError('Name, email, and phone are required.')
      return
    }

    setStatus('submitting')
    setError('')
    track(copy.trackEvent, { method: 'form' })

    const result = await submitAssessmentInquiry({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      company: copy.showCompany ? company : '',
      message: message.trim() || copy.prefill,
      source: copy.source,
    })

    if (!result.ok) {
      track(copy.trackEvent, { method: 'error' })
      setStatus('error')
      setError(result.error)
      return
    }

    track(copy.trackEvent, { method: result.method })
    setStatus('success')
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-950/70 p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (status !== 'submitting') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-2xl border border-slate-line bg-white p-5 shadow-[0_24px_80px_-20px_rgba(6,16,31,0.55)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h2 id={titleId} className="font-display text-2xl font-semibold text-navy-900">
              {copy.title}
            </h2>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-slate-muted hover:bg-slate-soft"
            onClick={onClose}
            aria-label="Close"
            disabled={status === 'submitting'}
          >
            Close
          </button>
        </div>

        {status === 'success' ? (
          <div className="mt-5 grid gap-3" role="status">
            <p className="text-sm leading-relaxed text-navy-900">{copy.success}</p>
            <button className="btn-primary w-full" type="button" onClick={onClose}>
              DONE
            </button>
          </div>
        ) : (
          <form className="mt-5 grid gap-3" onSubmit={(event) => void onSubmit(event)}>
            <label className="grid gap-1.5 text-sm font-medium text-navy-900">
              Name
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={status === 'submitting'}
              />
            </label>
            {copy.showCompany ? (
              <label className="grid gap-1.5 text-sm font-medium text-navy-900">
                Business name
                <input
                  className="field"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={status === 'submitting'}
                />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium text-navy-900">
              Email
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'submitting'}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-navy-900">
              Phone
              <input
                className="field"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                disabled={status === 'submitting'}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-navy-900">
              Details
              <textarea
                className="field min-h-28"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={status === 'submitting'}
              />
            </label>
            {error ? (
              <p className="text-sm text-red-600" role="status">
                {error}
              </p>
            ) : null}
            <button className="btn-primary w-full" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'SENDING…' : 'SEND'}
            </button>
            <p className="text-xs leading-relaxed text-slate-muted">
              Submits through TGT&apos;s protected intake. No email app is required.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
