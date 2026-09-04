import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { laborDay } from '../content'
import { openMailto } from '../lib/mailto'
import { track } from '../lib/track'

type LaptopInquiryModalProps = {
  open: boolean
  onClose: () => void
}

export function LaptopInquiryModal({ open, onClose }: LaptopInquiryModalProps) {
  const titleId = useId()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState<string>(laborDay.inquiryPrefill)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setMessage(laborDay.inquiryPrefill)
      setError('')
    }
  }, [open])

  if (!open) return null

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const trimmedPhone = phone.trim()
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)

    if (!trimmedName || !validEmail || !trimmedPhone) {
      setError('Name, email, and phone are required.')
      return
    }

    track('laptop_inquiry', { method: 'form' })
    openMailto({
      subject: 'Labor Day $280 AI-Ready Laptop inquiry',
      body: [
        message.trim() || laborDay.inquiryPrefill,
        '',
        `Name: ${trimmedName}`,
        `Email: ${trimmedEmail}`,
        `Phone: ${trimmedPhone}`,
      ].join('\n'),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-navy-950/70 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
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
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-slate-muted hover:bg-slate-soft"
            onClick={onClose}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1.5 text-sm font-medium text-navy-900">
            Name
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-navy-900">
            Email
            <input
              className="field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-navy-900">
            Message
            <textarea
              className="field min-h-24"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600" role="status">
              {error}
            </p>
          ) : null}
          <button className="btn-primary w-full" type="submit">
            SEND INQUIRY
          </button>
          <p className="text-xs leading-relaxed text-slate-muted">
            Opens your email to info@tgttechnologies.com. TGT will call you back.
          </p>
        </form>
      </div>
    </div>
  )
}
