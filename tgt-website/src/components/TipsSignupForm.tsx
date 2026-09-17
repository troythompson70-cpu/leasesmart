import { useState } from 'react'
import type { FormEvent } from 'react'
import { tipTopics, type TipTopicId } from '../content'
import { submitNewsletterSignup } from '../lib/intake'
import { track } from '../lib/track'

type TipsSignupFormProps = {
  id?: string
  compact?: boolean
  dark?: boolean
}

export function TipsSignupForm({
  id = 'signup',
  compact = false,
  dark = false,
}: TipsSignupFormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topics, setTopics] = useState<TipTopicId[]>([])
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')

  function toggleTopic(topic: TipTopicId) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic],
    )
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    track('signup_click', { location: id })

    const trimmedEmail = email.trim()
    const trimmedName = name.trim()
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)

    if (!trimmedName || !validEmail || topics.length === 0) {
      setStatus('error')
      setMessage('Add your name, a valid email, and at least one topic.')
      return
    }

    const topicLabels = tipTopics
      .filter((topic) => topics.includes(topic.id))
      .map((topic) => topic.label)
      .join(', ')

    track('signup_submit', {
      location: id,
      topics: topicLabels,
    })

    setStatus('submitting')
    setMessage('Submitting…')

    const result = await submitNewsletterSignup({
      name: trimmedName,
      email: trimmedEmail,
      topics,
      source: id === 'signup-bottom' ? 'tgt-website-newsletter-repeat' : 'tgt-website-newsletter',
    })

    if (!result.ok) {
      track('signup_error', { location: id })
      setStatus('error')
      setMessage(result.error)
      return
    }

    track('signup_success', { location: id, method: result.method })
    setStatus('ok')
    setMessage("Thank you — you're signed up for TGT Tips.")
    setName('')
    setEmail('')
    setTopics([])
  }

  const labelClass = dark ? 'text-blue-100' : 'text-navy-900'
  const helpClass = dark ? 'text-blue-100/75' : 'text-slate-muted'
  const chipIdle = dark
    ? 'border-white/25 bg-navy-950/40 text-white'
    : 'border-slate-line bg-white text-navy-900'
  const chipActive = 'border-brand-blue bg-brand-blue text-white'
  const busy = status === 'submitting'

  return (
    <form
      id={id}
      onSubmit={(event) => void onSubmit(event)}
      className={`rounded-2xl border p-5 shadow-[0_18px_50px_-24px_rgba(6,16,31,0.45)] sm:p-6 ${
        dark
          ? 'border-white/15 bg-white/10 backdrop-blur-md'
          : 'border-slate-line bg-white'
      } ${compact ? '' : 'mt-0'}`}
      data-cta="signup-form"
    >
      <p className={`font-mono text-[11px] uppercase tracking-[0.16em] ${dark ? 'text-blue-100' : 'text-brand-blue'}`}>
        Get TGT Tips Free
      </p>
      <h3 className={`mt-2 font-display text-2xl font-semibold ${labelClass}`}>
        Sign up in under a minute
      </h3>
      <p className={`mt-2 text-sm leading-relaxed ${helpClass}`}>
        No long form. Pick what you want and we send practical tips.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          <span className={labelClass}>Name</span>
          <input
            className="field"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          <span className={labelClass}>Email</span>
          <input
            className="field"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={busy}
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className={`text-sm font-medium ${labelClass}`}>
          Choose what you want
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {tipTopics.map((topic) => {
            const active = topics.includes(topic.id)
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                  active ? chipActive : chipIdle
                }`}
                aria-pressed={active}
                disabled={busy}
              >
                {topic.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <button className="btn-primary mt-5 w-full sm:w-auto" type="submit" disabled={busy}>
        {busy ? 'SIGNING UP…' : 'SIGN ME UP'}
      </button>

      {message ? (
        <p
          className={`mt-3 text-sm ${status === 'error' ? 'text-red-500' : helpClass}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <p className={`mt-3 text-xs leading-relaxed ${helpClass}`}>
        By selecting Sign Me Up, you agree to receive tips by email. Unsubscribe
        anytime. Submits through TGT&apos;s protected intake route — no email app required.
      </p>
    </form>
  )
}
