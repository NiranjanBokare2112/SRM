# Shreeram Medical

The official website for Shreeram Medical, a local medical store in Arag, Maharashtra. The site helps visitors learn about the store, browse healthcare product categories, check opening hours, contact the store, and get directions.

## Project Overview

- **Framework:** Next.js 16.3.1 with the App Router
- **Language:** TypeScript with strict compiler checks
- **UI:** React 19 and Tailwind CSS 4 through PostCSS
- **Icons:** `lucide-react`
- **Font:** Geist loaded through `next/font/google`
- **Rendering:** Static App Router pages with a shared layout and client-side mobile navigation
- **Local URL:** `http://localhost:3000`

## Quick Start

Install dependencies:

```bash
npm install
```

Create local environment configuration:

```bash
Copy-Item .env.example .env.local
```

Fill in the Supabase project URL and public anon key from the Supabase dashboard. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only and never expose it in browser code or a `NEXT_PUBLIC_*` variable.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Starts the Next.js development server with Turbopack. |
| `npm run lint` | Runs ESLint across the project. |
| `npm run build` | Creates and validates the optimized production build. |
| `npm run start` | Starts the compiled production server. |
| `npx tsc --noEmit` | Runs TypeScript checks without emitting files. |

## Repository Tree

```text
SRM/
├── app/
│   ├── about/
│   │   └── page.tsx          # About page route
│   ├── contact/
│   │   └── page.tsx          # Contact page route
│   ├── services/
│   │   └── page.tsx          # Full healthcare categories route
│   ├── favicon.ico           # Browser tab icon
│   ├── globals.css           # Brand tokens, global styles, components, and responsive rules
│   ├── layout.tsx             # Root layout, font, metadata, and Pharmacy structured data
│   ├── not-found.tsx          # Custom not-found page
│   ├── page.tsx               # Home page route
│   ├── robots.ts              # Robots metadata route
│   └── sitemap.ts             # Sitemap metadata route
├── components/
│   ├── brand/
│   │   └── BrandLogo.tsx      # Reusable graphical logo and HTML wordmark lockup
│   └── site.tsx               # Shared header, footer, sections, cards, and CTAs
├── lib/
│   └── business.ts            # Central business details and contact links
├── .env.example                # Safe template for local Supabase configuration
├── public/
│   ├── logo.jpeg              # Cropped graphical Shreeram Medical logo mark
│   ├── file.svg               # Static starter asset
│   ├── globe.svg              # Static starter asset
│   ├── logo-placeholder.svg   # Static placeholder asset
│   ├── next.svg               # Next.js starter asset
│   ├── vercel.svg             # Vercel starter asset
│   └── window.svg             # Static starter asset
├── eslint.config.mjs          # ESLint configuration
├── next.config.ts             # Next.js configuration
├── next-env.d.ts              # Next.js generated type declarations
├── package.json               # Dependencies and npm scripts
├── postcss.config.mjs         # Tailwind/PostCSS configuration
├── tsconfig.json              # Strict TypeScript and `@/*` path alias configuration
├── AGENTS.md                  # Next.js project instructions for coding agents
└── README.md                  # Project documentation
```

## Routes And Pages

### `/` - Home

The home page uses shared sections in this order:

1. **Hero:** Local positioning, store description, call, directions, and WhatsApp actions.
2. **Info strip:** Opening hours, service area, phone contact, and directions.
3. **About preview:** Short introduction with a link to `/about`.
4. **Category preview:** Three highlighted categories and a link to `/services`.
5. **Why choose us:** Local convenience, contact access, opening hours, and nearby healthcare messaging.
6. **Location card:** Address and Google Maps directions.
7. **Contact panel:** Phone, WhatsApp, and location actions.
8. **CTA section:** Final call and WhatsApp actions.

### `/about` - About

Explains the store's local role in Arag and presents the site's information-first approach. It includes a local healthcare visual, an availability note, and the shared CTA section.

### `/services` - Healthcare Categories

Displays the complete product category catalogue. The page contains an introductory section, a featured category card, seven supporting cards, a product availability CTA, and the shared final CTA.

The eight categories are:

1. **Medicines & Pharmacy Essentials** - Featured category for everyday medicines and pharmacy products.
2. **Veterinary Care** - Veterinary medicines and healthcare products for livestock and animals.
3. **Livestock Nutrition** - Calcium and nutritional products for cattle, buffaloes, and other livestock.
4. **Pet Food & Care** - Food and everyday care products for dogs, cats, and other pets.
5. **Baby Care & Nutrition** - Baby food and everyday essentials for infants and young children.
6. **Personal Care & Cosmetics** - Personal care, grooming, and everyday cosmetic products.
7. **First Aid & Medical Supplies** - Everyday first-aid and essential medical supplies.
8. **Healthcare & Daily Essentials** - Commonly needed pharmacy and healthcare products.

Descriptions are intentionally general. The site does not claim to diagnose, prescribe, guarantee outcomes, or provide professional veterinary consultation.

### `/contact` - Contact

Provides direct phone and WhatsApp actions, opening hours, the complete store address, Google Maps directions, a location card, a contact panel, and the final CTA.

### `/robots.txt` and `/sitemap.xml`

These routes are generated by `app/robots.ts` and `app/sitemap.ts` for search engine crawling and indexing support.

## Shared Components

Reusable visual sections are defined in [components/site.tsx](components/site.tsx):

- `Header` - Sticky responsive header with desktop navigation and mobile menu.
- `Hero` - Home page hero content and primary contact actions.
- `InfoStrip` - Compact store information row.
- `SectionHeading` - Consistent eyebrow, heading, and supporting copy treatment.
- `CategoryGrid` - Data-driven category layout with preview and full modes.
- `AboutPreview` - Home page introduction section.
- `WhyChoose` - Trust and convenience benefit cards.
- `VisitStoreCTA` - Product availability actions used on the Services page.
- `LocationCard` - Address and directions presentation.
- `ContactPanel` - Phone, WhatsApp, and location contact actions.
- `CTASection` - Reusable final call-to-action band.
- `Footer` - Shared navigation, address, hours, and copyright information.
- `FloatingActions` - Mobile-only fixed Call, WhatsApp, and Directions actions.
- `SiteShell` - Wraps each page with the shared header, main content, footer, and floating actions.

[components/brand/BrandLogo.tsx](components/brand/BrandLogo.tsx) provides the shared brand lockup used in the header and footer. It combines the graphical logo with the HTML wordmark.

## Brand System

Brand colors are centralized in `app/globals.css`:

| Token | Hex | Usage |
| --- | --- | --- |
| `--brand-blue` | `#1E93B6` | Primary actions, links, icons, and the `Medical` wordmark. |
| `--brand-green` | `#8DC641` | Accent actions, highlights, and the `Shreeram` wordmark. |
| `--brand-dark` | `#1F2933` | Main headings and dark text. |
| `--brand-light-blue` | `#EAF7FA` | Soft section and icon backgrounds. |
| `--brand-light-green` | `#F1F8E8` | Soft WhatsApp and supporting backgrounds. |
| `--background` | `#FFFFFF` | Main page and card background. |

### Logo Rules

- The only logo asset is `public/logo.jpeg`.
- The image contains only the graphical mark and must not be edited, recolored, cropped, or stretched.
- `BrandLogo` renders `Shreeram` and `Medical` separately in HTML/CSS.
- The complete logo lockup is one accessible link to the home page.
- The image uses meaningful alt text: `Shreeram Medical logo`.
- The mark is approximately 48px high on desktop, 40px on mobile, and smaller in the footer.

## Business Configuration

[lib/business.ts](lib/business.ts) is the single source of truth for:

- Business name and tagline
- Site URL
- Store description
- Phone display value and `tel:` link
- WhatsApp link and pre-filled message
- Store address and service area
- Opening hours
- Google Maps directions URL
- Logo asset path

Update business information there instead of duplicating contact details in route files or components.

## SEO And Structured Data

[app/layout.tsx](app/layout.tsx) defines root metadata, the title template, description, Open Graph values, locale, canonical URL, and Geist font. It also emits Schema.org `Pharmacy` JSON-LD using the centralized business configuration.

Page-specific metadata is defined in each route's `page.tsx` file. The public site origin is `https://shreerammedical.com`, configured centrally in `lib/business.ts`. Sitemap, robots, canonical, Open Graph and structured-data URLs use this origin, including in local builds.

Each public page has its own canonical and Open Graph URL. The sitemap omits `lastmod` until reliable page content modification dates are maintained. The private owner login is marked `noindex`.

## Styling And Responsive Behavior

- Tailwind utility classes handle most page-level spacing and layout.
- `app/globals.css` contains shared component styles, semantic color variables, hover states, cards, CTA bands, decorative visuals, and responsive breakpoints.
- Desktop navigation and contact actions appear from the 768px breakpoint upward.
- Mobile navigation uses the menu button in the header.
- Mobile floating actions remain available for Call, WhatsApp, and Directions.
- Service cards use stable heights and bottom-aligned chevrons to keep category rows visually consistent.
- Layouts are checked for horizontal overflow at narrow mobile widths.

## Quality Checks

Run the full local verification set before shipping changes:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

The production build statically generates the home, about, services, contact, not-found, robots, and sitemap routes.

## Deployment

Build the application with:

```bash
npm run build
```

Then run the production server with:

```bash
npm run start
```

After deploying, verify `/sitemap.xml` and `/robots.txt` on `https://shreerammedical.com` before submitting `sitemap.xml` in Google Search Console.
