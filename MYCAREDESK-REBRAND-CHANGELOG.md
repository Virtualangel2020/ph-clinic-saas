# MyCareDesk Rebrand — File Changelog

This archive (`mycaredesk-rebrand.zip`) contains every file changed for the
AngelClinic → MyCareDesk / Virtual Angel Systems rebrand. **184 files total**
(175 code files + 9 image/icon assets). All paths inside the zip are relative
to your repo root (`ph-clinic-saas`) — extract it directly over your existing
checkout to overwrite the changed files in place. Nothing outside this list
was touched.

## How to apply

1. Unzip `mycaredesk-rebrand.zip` into your repo root, allowing it to
   overwrite existing files (e.g. on Windows: extract and choose
   "Replace files in destination" when prompted).
2. Review the diff in GitHub Desktop as usual.
3. Commit and push yourself — I did not touch git.

## 1. Brand tokens (the foundation everything else reads from)

- `app/globals.css` — new `--brand-*` CSS custom properties, derived by
  pixel-sampling your actual logo file (not guessed):
  - `--brand-primary: #0b2d5c` (navy — structural color, sidebar/buttons/headings)
  - `--brand-primary-dark: #041b38` (deeper navy — gradients/hover)
  - `--brand-secondary: #049ca0` (teal — secondary actions/links/accents)
  - `--brand-accent: #2fd99e` (mint-green, from the logo's leaf)
  - plus background/surface/border/text tokens

## 2. Logo & icon assets (generated from your actual uploaded logo — no redrawing)

- `public/logo.png`, `logo-240.png`, `logo-64.png` — the icon mark, transparent, multiple sizes
- `public/favicon.ico` — multi-resolution (16/32/48px)
- `public/icons/apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — PWA icons
- `public/icons/icon-maskable-192.png`, `icon-maskable-512.png` — maskable variants with navy safe-zone padding
- `public/logo-full.png`, `logo-wordmark.png` — icon+wordmark lockups (with/without tagline)

Note: these were cropped/generated from the 612×408 image you uploaded. It
looked sharp on screen at every size I tested (down to the 30px nav icon),
but if you have a higher-resolution master file, send it over and I can
regenerate these for extra sharpness on very large uses (e.g. print).

## 3. Structural components (rebrand these once, and ~15+ screens update automatically)

- `components/brand-header.tsx` — the shared logo+wordmark+tagline lockup used on login, signup, portal login/verify/activate, admin layout, get-started, and more
- `components/public/site-nav.tsx` — public site header/nav
- `components/public/site-footer.tsx` — public site footer
- `components/emr/emr-shell.tsx` — the signed-in dashboard sidebar/shell (nav highlighting, badges, mobile overlay)

## 4. Public marketing site & auth screens

Homepage, `/pricing`, `/features`, `/about`, `/security`, `/request-demo`,
`/signup`, `/login`, `/get-started`, `/find-a-doctor` and related components —
navy/teal color system applied, "MyCareDesk" text and copy updated. Also
fixed two screens that used a generic unbranded blue (`#2563eb`) that
predated the rebrand and wasn't part of your original AngelClinic palette,
so my first color pass didn't catch it: the plain `/login` sign-in button and
several admin-only buttons/links (see section 7).

## 5. Patient Portal

`app/portal/*` — MyCareDesk-branded shell (login, verify, activate, book,
billing, results, messages, records). Per your spec, the clinic's own
identity still shows once a patient is inside their specific clinic's portal
context — this only rebrands the platform chrome around it.

## 6. Clinical documents — clinic branding preserved, NOT replaced

Per your explicit instruction, prescriptions/certificates/receipts/referral
letters keep the **clinic's own** logo and name, never MyCareDesk's. Two
related fixes:

- **7 files**: the fallback clinic name shown when a clinic hasn't set one
  yet was previously defaulting to `"MyCareDesk"` — that was wrong (it would
  make a document look like MyCareDesk itself is the clinic). Changed to a
  neutral `"Your Clinic"` fallback instead:
  `app/find-a-doctor/[id]/page.tsx`, `app/api/encounters/export-pdf/route.ts`,
  `app/api/billing/receipt-pdf/route.ts`, `app/dashboard/patients/actions.ts`,
  `lib/pdf/gather-medical-certificate-pdf-data.ts`,
  `lib/pdf/gather-encounter-pdf-data.ts`, `lib/pdf/gather-referral-pdf-data.ts`
- **4 PDF template files**: `lib/pdf/medical-certificate-document.tsx`,
  `encounter-pdf-document.tsx`, `receipt-document.tsx`,
  `referral-letter-document.tsx` — these use `@react-pdf/renderer`, which
  can't read CSS variables, so their header-accent color is the literal navy
  hex `#0b2d5c` (kept in sync with the CSS token by value).

## 7. Bug I introduced and caught before you ever saw it

My first automated color-replacement pass blindly swapped the old brand hex
codes for the new `var(--brand-*)` tokens everywhere they appeared — but CSS
variables don't resolve inside PDF renderer stylesheets, the Web App
Manifest, or the `<meta name="theme-color">` tag. I caught this on review
(before building/shipping) and fixed it in these 8 files by using the
literal hex value instead: the 4 PDF files above, `app/manifest.ts`,
`app/api/pwa/staff-manifest/route.ts`, `app/api/pwa/admin-manifest/route.ts`,
`app/layout.tsx`.

## 8. Semantic status colors — deliberately left alone

Per your instruction, I did not touch: green (success/confirmed/normal),
red (critical/error/cancelled), blue-info badges outside branding contexts,
and the amber/warning family (`#fff7e6` background, `#e6c66b` border,
`#7a5c12` text — used for "pending"/"needs attention" banners across ~20
files). I verified this by hand after the automated pass; none of those were
touched.

## 9. Generic off-brand blue buttons fixed (found during visual QA)

These 25 files used a generic blue (`#2563eb`) for buttons/links that
predated the AngelClinic palette entirely — so the original rebrand color
script had nothing to match against. Found only by actually rendering the
screens (per your instruction not to report completion without visual
verification) and switched to the navy `var(--brand-primary)` button system:
`app/login/page.tsx`, `app/portal/login/page.tsx`, `app/portal/verify/page.tsx`,
`app/portal/activate/page.tsx`, `app/signup/page.tsx`,
`app/auth/set-password/page.tsx`, `app/get-started/get-started-form.tsx`,
`components/request-access-form.tsx`, `app/dashboard/page.tsx`,
`app/dashboard/payments/page.tsx`, `app/dashboard/payments/collect-payment-widget.tsx`,
`app/dashboard/communications/page.tsx`, `app/dashboard/communications/compose-widget.tsx`,
`app/dashboard/settings/users/staff-invite-form.tsx`,
`app/dashboard/settings/providers/provider-credentials-form.tsx`,
`app/admin/page.tsx`, `app/admin/clients/page.tsx`,
`app/admin/clients/[id]/client-editor.tsx`, `app/admin/clients/[id]/billing-panel.tsx`,
`app/admin/clients/[id]/staff-panel.tsx`, `app/admin/promotions/promotion-form.tsx`,
`app/admin/faqs/faq-manager.tsx`, `app/admin/pricing/care-plan-manager.tsx`,
`app/admin/pricing/billing-settings-form.tsx`,
`app/admin/providers-directory/external-provider-manager.tsx`.

## Visually verified locally (screenshots)

Homepage (desktop + mobile), `/login`, `/portal/login`, `/signup`,
`/pricing`, `/features`, `/about`, `/security`, `/request-demo` — all
rendering correctly with the new branding, no leftover "AngelClinic" text,
no broken layout, no chunk-load errors.

**Not verifiable locally**: anything behind a real login (dashboard, admin,
patient portal interior screens, calendar, encounters, billing, analytics,
checkout). I don't have working session credentials in this sandbox. These
will render with the same `emr-shell`/`brand-header` components already
verified above, but I'd recommend a quick look yourself after you deploy, or
I can do a live-browser pass against your real demo login if you'd like.

## One thing I did NOT change — flagging for your call

Your demo tenant's clinic name in the database is still literally
`"AngelClinic Demo"`. I left it alone since it's your data, not platform
code — but if you want it renamed to fit the new brand (e.g. "MyCareDesk
Demo Clinic"), say the word and I'll update that one row.
