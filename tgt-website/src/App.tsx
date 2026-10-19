import { useState } from 'react'
import { AnnouncementBar, Hero, SiteHeader } from './components/Hero'
import { CartPage, CheckoutPage, OrderResult } from './components/Cart'
import { LaptopInquiryModal } from './components/LaptopInquiryModal'
import { LeadInquiryModal, type LeadKind } from './components/LeadInquiryModal'
import {
  BottomSignup,
  BusinessIt,
  ContentCategories,
  LaptopPromo,
  MeetGates,
  ReferralProgram,
  RemoteSupport,
  SiteFooter,
  VideosSection,
} from './components/Sections'

function App() {
  const [laptopOpen, setLaptopOpen] = useState(false)
  const [leadKind, setLeadKind] = useState<LeadKind | null>(null)
  const path = window.location.pathname
  if (path === '/cart') return <CartPage />
  if (path === '/checkout') return <CheckoutPage />
  if (path === '/order/confirmed') return <OrderResult kind="confirmed" />
  if (path === '/order/cancelled') return <OrderResult kind="cancelled" />
  if (path === '/order/failed') return <OrderResult kind="failed" />

  return (
    <>
      <AnnouncementBar onLaptopClick={() => setLaptopOpen(true)} />
      <SiteHeader onLaptopClick={() => setLaptopOpen(true)} />
      <main>
        <Hero
          onLaptopClick={() => setLaptopOpen(true)}
          onHelp={() => setLeadKind('remote')}
        />
        <VideosSection />
        <LaptopPromo onInquire={() => setLaptopOpen(true)} />
        <MeetGates onAsk={() => setLeadKind('gates')} />
        <RemoteSupport onRequest={() => setLeadKind('remote')} />
        <ContentCategories />
        <ReferralProgram onRefer={() => setLeadKind('referral')} />
        <BusinessIt
          onAssess={() => setLeadKind('assessment')}
          onRemote={() => setLeadKind('remote')}
        />
        <BottomSignup />
      </main>
      <SiteFooter
        onContact={() => setLeadKind('contact')}
        onLaptop={() => setLaptopOpen(true)}
        onRemote={() => setLeadKind('remote')}
        onAssess={() => setLeadKind('assessment')}
      />
      {laptopOpen ? <LaptopInquiryModal onClose={() => setLaptopOpen(false)} /> : null}
      {leadKind ? (
        <LeadInquiryModal kind={leadKind} onClose={() => setLeadKind(null)} />
      ) : null}
    </>
  )
}

export default App
