import { laborDay, videos, remoteHelpItems, mspServices, categoryStrip } from '../content'
import { openMailto } from '../lib/mailto'
import { track } from '../lib/track'
import { TipsSignupForm } from './TipsSignupForm'

export function LaptopPromo({ onInquire }: { onInquire: () => void }) {
  return (
    <section id="laptop" className="section-pad border-b border-slate-line bg-slate-soft">
      <div className="wrap grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div>
          <p className="eyebrow">Limited inventory</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            {laborDay.title}
          </h2>
          <p className="mt-3 font-display text-2xl font-semibold text-brand-blue sm:text-3xl">
            {laborDay.product}
          </p>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-muted">
            Compact. Lightweight. Ready for the tools people actually use — with TGT
            remote support available when you need help.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {laborDay.readyFor.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-slate-line bg-white px-3 py-2.5 text-sm font-semibold text-navy-900"
              >
                {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn-primary mt-8"
            onClick={() => {
              track('laptop_inquiry', { method: 'promo_block' })
              onInquire()
            }}
            data-cta="laptop-promo"
          >
            {laborDay.cta}
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-line bg-navy-900 shadow-[0_18px_50px_-24px_rgba(6,16,31,0.45)]">
          <img
            src="/media/service-hardware.jpg"
            alt="AI-ready touchscreen laptop for everyday productivity"
            className="aspect-[4/3] w-full object-cover opacity-95"
            loading="lazy"
          />
          <div className="p-5 text-white">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-blue-200">
              Weekend deal
            </p>
            <p className="mt-2 font-display text-xl font-semibold">
              $280 AI-Ready Touchscreen Laptop
            </p>
            <p className="mt-2 text-sm text-blue-50/80">
              Limited quantity. Ask TGT — we call you back.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function VideosSection() {
  return (
    <section id="videos" className="section-pad bg-white">
      <div className="wrap">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Watch Gates</p>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
              Short videos. Real answers.
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-muted">
              Motion and personality up front — not buried under corporate copy.
            </p>
          </div>
          <a
            href="https://www.youtube.com/@TGTTechnologies"
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
            data-cta="watch-more"
          >
            WATCH MORE
          </a>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {videos.map((video) => (
            <article
              key={video.id}
              className="overflow-hidden rounded-2xl border border-slate-line bg-slate-soft/60 shadow-[0_10px_30px_-18px_rgba(6,16,31,0.35)]"
            >
              <div className="relative aspect-video bg-navy-900">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}`}
                  title={video.title}
                  className="absolute inset-0 h-full w-full"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onLoad={() => track('video_play', { video: video.id })}
                />
              </div>
              <div className="p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-blue">
                  {video.tag}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-navy-900">
                  {video.title}
                </h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function MeetGates() {
  return (
    <section id="gates" className="section-pad border-y border-slate-line bg-slate-soft">
      <div className="wrap grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="overflow-hidden rounded-2xl border border-slate-line shadow-[0_18px_50px_-24px_rgba(6,16,31,0.45)]">
          <img
            src="/media/about.jpg"
            alt="Tee Gates — founder of TGT Technologies"
            className="aspect-[4/5] w-full object-cover object-top"
            loading="lazy"
          />
        </div>
        <div>
          <p className="eyebrow">Meet Gates</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            Real tech tips. Real answers. No jargon.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-muted">
            Technology changes fast. Gates breaks it down so you can actually use it.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="mailto:info@tgttechnologies.com?subject=Ask%20Gates"
              className="btn-primary"
              onClick={() => track('ask_gates_click')}
              data-cta="ask-gates"
            >
              ASK GATES
            </a>
            <a
              href="#signup"
              className="btn-outline"
              onClick={() => track('signup_click', { location: 'gates' })}
              data-cta="gates-tips"
            >
              GET FREE TIPS
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export function RemoteSupport() {
  return (
    <section id="remote-help" className="section-pad bg-navy-900 text-white">
      <div className="wrap grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="eyebrow !text-blue-200 before:!bg-brand-blue-light">Revenue offer</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            COMPUTER ACTING UP?
          </h2>
          <p className="mt-3 text-lg text-blue-50/85">TGT can help remotely.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {remoteHelpItems.map((item) => (
              <li
                key={item}
                className="rounded-lg border border-white/10 bg-navy-950/40 px-3 py-2.5 text-sm text-white/90"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-blue-200">
            Remote help available
          </p>
          <button
            type="button"
            className="btn-primary mt-5"
            onClick={() => {
              track('remote_help_inquiry')
              openMailto({
                subject: 'Request remote help',
                body: "I'd like remote computer help from TGT.\n\nName:\nPhone:\nBest time to call:\nIssue:",
              })
            }}
            data-cta="remote-help"
          >
            REQUEST REMOTE HELP
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <img
            src="/media/support.jpg"
            alt="TGT technician providing remote and hands-on technology support"
            className="aspect-[4/3] w-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}

export function ContentCategories() {
  return (
    <section id="categories" className="section-pad bg-white">
      <div className="wrap">
        <p className="eyebrow">Content discovery</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
          Find the help you need
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-muted">
          Browse the topics people ask about most — then get tips, watch a video, or
          request help.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {categoryStrip.map((item) => (
            <a
              key={item}
              href="#signup"
              className="rounded-xl border border-slate-line bg-slate-soft px-4 py-5 text-center font-display text-lg font-semibold text-navy-900 transition hover:border-brand-blue/40 hover:bg-white"
              onClick={() => track('signup_click', { location: 'categories', topic: item })}
            >
              {item}
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ReferralProgram() {
  return (
    <section id="referral" className="section-pad border-y border-slate-line bg-slate-soft">
      <div className="wrap max-w-3xl text-center">
        <p className="eyebrow">Lead generation</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
          KNOW A BUSINESS THAT NEEDS IT HELP?
        </h2>
        <p className="mt-3 font-display text-2xl font-semibold text-brand-blue">
          REFER THEM TO TGT. GET PAID.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-muted">
          If TGT signs the business, qualifying referrals can earn $200–$1,000.
        </p>
        <button
          type="button"
          className="btn-primary mt-8"
          onClick={() => {
            track('referral_click')
            openMailto({
              subject: 'Business referral to TGT',
              body: [
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
            })
          }}
          data-cta="referral"
        >
          MAKE A REFERRAL
        </button>
      </div>
    </section>
  )
}

export function BusinessIt() {
  return (
    <section id="business-it" className="section-pad bg-white">
      <div className="wrap">
        <p className="eyebrow">For businesses</p>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
          Managed IT when you need a real department
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-muted">
          After the consumer offers, here is the higher-ticket MSP path — managed IT,
          cybersecurity, Microsoft 365, cloud, assessments, and ongoing support.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {mspServices.map((service) => (
            <article
              key={service.title}
              className="overflow-hidden rounded-2xl border border-slate-line bg-slate-soft/50"
            >
              <img
                src={service.image}
                alt={service.title}
                className="aspect-[16/10] w-full object-cover"
                loading="lazy"
              />
              <div className="p-5">
                <h3 className="font-display text-xl font-semibold text-navy-900">
                  {service.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-muted">{service.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <a
            href="mailto:info@tgttechnologies.com?subject=Free%20IT%20Assessment"
            className="btn-primary"
            onClick={() => track('business_assessment_click')}
            data-cta="business-assessment"
          >
            GET A FREE IT ASSESSMENT
          </a>
          <a href="#remote-help" className="btn-outline">
            REQUEST REMOTE HELP
          </a>
        </div>
      </div>
    </section>
  )
}

export function BottomSignup() {
  return (
    <section id="newsletter" className="section-pad border-t border-slate-line bg-slate-soft">
      <div className="wrap grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Stay on the list</p>
          <h2 className="font-display text-3xl font-semibold tracking-tight text-navy-900 sm:text-4xl">
            Get TGT Tips again — yes, signup appears twice
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-muted">
            Short reads. Powerful habits. iPhone, Android, AI, scam alerts, and business
            tech — without the noise.
          </p>
        </div>
        <TipsSignupForm id="signup-bottom" />
      </div>
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-navy-950 text-white">
      <div className="wrap grid gap-8 py-12 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <img
            src="/media/tgt-logo-2026.svg"
            alt="TGT Technologies"
            className="h-10 w-auto brightness-0 invert"
          />
          <p className="mt-4 max-w-md text-sm leading-relaxed text-blue-50/75">
            Tech made simple. AI made useful. Practical help for people and businesses
            across New York, New Jersey, and Connecticut.
          </p>
        </div>
        <div className="grid gap-2 text-sm">
          <a className="font-semibold hover:text-blue-200" href="mailto:info@tgttechnologies.com">
            info@tgttechnologies.com
          </a>
          <a className="hover:text-blue-200" href="#signup">
            Sign up for tips
          </a>
          <a className="hover:text-blue-200" href="#laptop">
            $280 AI-ready laptop
          </a>
          <a className="hover:text-blue-200" href="#remote-help">
            Request remote help
          </a>
          <a className="hover:text-blue-200" href="#business-it">
            Business IT / MSP
          </a>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="wrap flex flex-col gap-2 py-5 text-xs text-blue-100/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} TGT Technologies Inc.</p>
          <p>Campaign inbox: info@tgttechnologies.com</p>
        </div>
      </div>
    </footer>
  )
}
