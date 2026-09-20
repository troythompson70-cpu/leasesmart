export const CONTACT_EMAIL = 'info@tgttechnologies.com'

export const tipTopics = [
  { id: 'iphone', label: 'iPhone' },
  { id: 'android', label: 'Android' },
  { id: 'ai', label: 'AI' },
  { id: 'scam', label: 'Scam Alerts' },
  { id: 'business', label: 'Business Tech' },
] as const

export type TipTopicId = (typeof tipTopics)[number]['id']

export const categoryStrip = [
  'iPhone Tips',
  'Android Tips',
  'AI Made Simple',
  'Scam Alerts',
  'Business IT',
] as const

export const laborDay = {
  bar: 'LABOR DAY TECH DEAL — AI-READY LAPTOPS $280 • LIMITED QUANTITY',
  title: 'LABOR DAY TECH DEAL',
  product: 'AI-READY TOUCHSCREEN LAPTOP — $280',
  readyFor: [
    'ChatGPT',
    'Claude',
    'Copilot',
    'Email',
    'Web',
    'Zoom/Teams',
    'Everyday productivity',
    'TGT remote support',
  ],
  cta: 'I WANT THE $280 LAPTOP',
  inquiryPrefill: "I'm interested in the $280 AI-Ready Laptop.",
} as const

/** Approved Ninth Edition copy. Intake flag is boolean `ninthEdition: true`. */
export const ninthEdition =
  'THE NINTH EDITION: The ultimate AI-hardened workstation for the modern MSP. Precision engineered for zero-latency intelligence and maximum throughput.' as const

/** Official TGT Technologies Inc YouTube channel that hosts the commercials. */
export const youtubeChannelUrl = 'https://www.youtube.com/@tgttechnologiesinc5537'

/**
 * Live TGT commercials from git + the official channel.
 * IDs verified via YouTube oembed (not invented placeholders).
 */
export const videos = [
  {
    id: 'commercial-1',
    tag: 'TGT Commercial',
    title: 'TGT Technologies Inc — 1st Commercial',
    youtubeId: 'We6DCKigVbY',
  },
  {
    id: 'commercial-2',
    tag: 'TGT Commercial',
    title: 'Come learn more about TGT Technologies Inc',
    youtubeId: 'nj36vr4q6M0',
  },
  {
    id: 'sixty-second',
    tag: '60-second pitch',
    title: 'Get to know TGT in a minute',
    youtubeId: 'NAmV_svHzNI',
  },
] as const

export const remoteHelpItems = [
  'Computer troubleshooting',
  'Email issues',
  'Windows problems',
  'Software setup',
  'AI setup',
  'Printer help',
  'Security questions',
] as const

export const mspServices = [
  {
    title: 'Managed IT',
    body: 'Day-to-day support, monitoring, and a real help desk for your team.',
    image: '/media/service-managed.jpg',
  },
  {
    title: 'Cybersecurity',
    body: 'Practical protection for endpoints, email, and everyday business risk.',
    image: '/media/service-security.jpg',
  },
  {
    title: 'Microsoft 365',
    body: 'Setup, administration, and cleanup so email and collaboration stay reliable.',
    image: '/media/service-network.jpg',
  },
  {
    title: 'Cloud & Hardware',
    body: 'Cloud productivity plus sourcing, setup, and replacement when equipment fails.',
    image: '/media/service-hardware.jpg',
  },
] as const

export const ga4MeasurementId = 'G-3WSD9VGVM6'
