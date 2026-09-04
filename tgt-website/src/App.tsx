import { useState } from 'react'
import { AnnouncementBar, Hero, SiteHeader } from './components/Hero'
import { LaptopInquiryModal } from './components/LaptopInquiryModal'
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

  return (
    <>
      <AnnouncementBar onLaptopClick={() => setLaptopOpen(true)} />
      <SiteHeader onLaptopClick={() => setLaptopOpen(true)} />
      <main>
        <Hero onLaptopClick={() => setLaptopOpen(true)} />
        <LaptopPromo onInquire={() => setLaptopOpen(true)} />
        <VideosSection />
        <MeetGates />
        <RemoteSupport />
        <ContentCategories />
        <ReferralProgram />
        <BusinessIt />
        <BottomSignup />
      </main>
      <SiteFooter />
      <LaptopInquiryModal open={laptopOpen} onClose={() => setLaptopOpen(false)} />
    </>
  )
}

export default App
