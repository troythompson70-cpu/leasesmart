import { useState } from 'react'
import { CartClosed } from './components/CartClosed'
import { AnnouncementBar, Hero, SiteHeader } from './components/Hero'
import { LaptopInquiryModal } from './components/LaptopInquiryModal'
import { LeadInquiryModal, type LeadKind } from './components/LeadInquiryModal'
import { isCartPath, laptopCheckoutEnabled } from './lib/site-flags'
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
  const cartPath = isCartPath(window.location.pathname)

  if (cartPath && !laptopCheckoutEnabled) {
    return <CartClosed />
  }

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
