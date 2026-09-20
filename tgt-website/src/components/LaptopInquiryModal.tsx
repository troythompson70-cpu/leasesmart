import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { laborDay, ninthEdition } from '../content'
import { submitLaptopInquiry } from '../lib/intake'
import { track } from '../lib/track'

type LaptopInquiryModalProps = {
  onClose: () => void
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function LaptopInquiryModal({ onClose }: LaptopInquiryModalProps) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState<string>(laborDay.inquiryPrefill)
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
    track('laptop_inquiry', { method: 'form' })

    const result = await submitLaptopInquiry({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      message: message.trim() || laborDay.inquiryPrefill,
      ninthEdition: true,
    })

    if (!result.ok) {
      track('laptop_inquiry', { method: 'error' })
      setStatus('error')
      setError(result.error)
      return
    }

    track('laptop_inquiry', { method: result.method })
    setStatus('success')
    setName('')
    setEmail('')
    setPhone('')
    setMessage(laborDay.inquiryPrefill)
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
            <p className="eyebrow">Laptop inquiry</p>
            <h2 id={titleId} className="font-display text-2xl font-semibold text-navy-900">
              I want the $280 laptop
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-navy-900">{ninthEdition}</p>
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
            <p className="text-sm leading-relaxed text-navy-900">
              Thank you — your laptop inquiry was sent. TGT will call you back. No email app
              required.
            </p>
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
              Message
              <textarea
                className="field min-h-24"
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
              {status === 'submitting' ? 'SENDING…' : 'SEND INQUIRY'}
            </button>
            <p className="text-xs leading-relaxed text-slate-muted">
              Submits through TGT&apos;s protected intake route. No email app is required. TGT will
              call you back.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
