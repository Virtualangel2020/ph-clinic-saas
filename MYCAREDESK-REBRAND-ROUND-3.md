# MyCareDesk Rebrand — Round 3 (small delivery, real fixes)

Your screenshot this time was genuinely useful — the window title now reads "MyCareDesk — Smart Clinic. Better Care.", which confirms the last delivery actually deployed. That let me see something real: the "MyCareDesk" wordmark in the Super Admin header was nearly invisible, its navy/teal text blending into the medium-blue header background. You called this out exactly right ("fonts should be clear and not overlapped by other colors").

## What was wrong

`BrandHeader` (the shared logo+wordmark component used on login, signup, portal, and Super Admin) was built with navy/teal text designed for a white background — every other place it's used sits on a white card, so it looked fine there. But `app/admin/layout.tsx` places it on the dark blue-teal header bar, and navy-on-medium-blue has almost no contrast. Same root issue affected a few other spots that also put teal text on that same medium-blue surface: the public site's sticky nav bar (active link, "Request a Demo" button, hamburger icon, mobile menu links) and the "Install Admin app" button.

## What I changed

`components/brand-header.tsx` — added a `variant` prop. Every existing usage (14 screens: login, signup, portal, get-started, dashboard, billing, etc.) is unaffected since the default is unchanged. `app/admin/layout.tsx` now passes `variant="dark"`, which switches the wordmark to off-white with a mint-green "Care" — clearly readable against the header now (checked: 6.4:1 for the white text, 3.8:1 for the mint, both meeting WCAG for this text size).

`components/emr/emr-shell.tsx`, `components/public/site-nav.tsx`, `components/public/site-footer.tsx` — the "Care" in their own wordmarks switched from teal to the same mint accent, for the same reason (teal against these medium-blue surfaces was only ~2:1 contrast, unreadable). `site-nav.tsx` also had a hardcoded old-navy color (`rgba(11,45,92,...)`) on its sticky header that my token-based lightening pass couldn't catch since it wasn't written as `var(--brand-primary)` — updated to the new lighter blue so the nav bar actually matches the rest of the page instead of staying dark. Its active-link color, "Request a Demo" button, hamburger icon, and mobile menu links all had the same teal-on-medium-blue problem — all switched to mint.

`components/install-pwa-button.tsx` — same fix, it's only ever used inside the Super Admin header.

## I also found two things outside the code entirely

Your `site_content` database table had actual saved override text — not just fallback copy in the code — reading "Hey, Doc! Welcome to AngelClinic" and "Want to See AngelClinic in Action?" This is content editable from Site Content in your Super Admin panel, so no code fix would ever touch it. Updated directly in the database, live immediately, no deploy needed: now reads "Welcome to MyCareDesk" and "Want to See MyCareDesk in Action?"

Two feature descriptions (Email Communications, Provider Messaging) also had "AngelClinic" baked into their stored text in the `features` table — same situation, same fix, also live now.

## About the window title bar icon

I checked every icon file in the codebase — favicon.ico, all the PWA icons, the maskable variants — and they're all correctly your new MyCareDesk mark (the cross + leaf). None are old. At 16px in a window title bar, any detailed icon looks soft, but it is the right file. If it still looks off after this deploys, tell me specifically what looks wrong about it (wrong image entirely vs. just small/blurry) and I'll dig further.

## This delivery

Just 6 files this time (all listed above) — small and targeted. Same process: extract into your repo, review, commit and push yourself.
