import { useState } from 'react'
import { AnnouncementBar, Hero, SiteHeader } from './components/Hero'
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

  return (
    <>
      <AnnouncementBar onLaptopClick={() => setLaptopOpen(true)} />
      <SiteHeader onLaptopClick={() => setLaptopOpen(true)} />
      <main>
        <Hero onLaptopClick={() => setLaptopOpen(true)} />
        <VideosSection />
        <LaptopPromo onInquire={() => setLaptopOpen(true)} />
        <MeetGates onAsk={() => setLeadKind('gates')} />
        <RemoteSupport onRequest={() => setLeadKind('remote')} />
        <ContentCategories />
        <ReferralProgram onRefer={() => setLeadKind('referral')} />
        <BusinessIt onAssess={() => setLeadKind('assessment')} />
        <BottomSignup />
      </main>
      <SiteFooter />
      {laptopOpen ? <LaptopInquiryModal onClose={() => setLaptopOpen(false)} /> : null}
      {leadKind ? (
        <LeadInquiryModal kind={leadKind} onClose={() => setLeadKind(null)} />
      ) : null}
    </>
  )
}

export default App
