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

export const videos = [
  {
    id: 'tip-iphone',
    tag: 'Latest Tech Tip',
    title: 'Your iPhone can do this?',
    youtubeId: 'nj36vr4q6M0',
  },
  {
    id: 'scam-alert',
    tag: 'Scam Alert',
    title: "Don't click this text.",
    youtubeId: 'We6DCKigVbY',
  },
  {
    id: 'ai-simple',
    tag: 'AI Made Simple',
    title: '3 things to ask ChatGPT today.',
    youtubeId: 'nj36vr4q6M0',
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
