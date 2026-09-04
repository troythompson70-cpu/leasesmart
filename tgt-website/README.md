# TGT Technologies — conversion homepage

Conversion-first rebuild of [tgttechnologies.com](https://tgttechnologies.com) that keeps the existing navy / brand-blue visual system and reorders the first screen for action.

## Homepage order

1. Labor Day announcement bar  
2. Hero + tips signup  
3. $280 AI-ready laptop promo  
4. Watch Gates videos  
5. Meet Gates  
6. Remote support  
7. Content categories  
8. Referral program  
9. Business IT / MSP  
10. Newsletter signup (repeat)  
11. Footer / contact  

## Local preview

```bash
cd tgt-website
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Deploy note

Production apex currently resolves through Cloudflare → `custom-domains.chatgpt.site`. This folder is the Cursor-owned source for the conversion homepage. Point hosting at `tgt-website/dist` (or this Vite app) when ready to replace the live SPA.

Campaign inbox for all CTAs: `info@tgttechnologies.com`.
