# PH Clinic OS — web foundation

Next.js (App Router) frontend wired to the `ph-clinic-saas` Supabase project
(multi-tenant schema: `tenants`, `user_profiles` + RLS, `roles`,
`permission_definitions`, `tenant_entitlements`, `audit_logs` — see the
architecture document for the full design).

This is the **foundation phase** only: a public catalog page (proves the
public RLS policies work), a login page, and a protected dashboard page
(proves tenant-scoped RLS works for a real logged-in user). No clinical
modules yet — those come in the phases after this.

## Local development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Deploying to Vercel

1. Push this folder to a GitHub repository.
2. In the Vercel dashboard: **Add New → Project → Import** the repository.
   Vercel auto-detects Next.js — no build config needed.
3. Under **Environment Variables**, add the two values from
   `.env.local.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. Every push to the connected branch redeploys automatically.

## Creating a test platform admin

There's no invitation flow yet (that's Phase 1 — see the roadmap). To try
the dashboard today:

1. In the Supabase dashboard → Authentication → Users → **Add user**,
   create a user with an email + password.
2. In the SQL editor, insert a matching profile:
   ```sql
   insert into public.user_profiles (id, tenant_id, role, full_name)
   values ('<the new user''s auth.users id>', null, 'platform_admin', 'Your Name');
   ```
3. Sign in at `/login` with that email/password, then visit `/dashboard`.

To test tenant isolation instead of platform-admin, create a `tenants` row
first and use its `id` as `tenant_id` with `role = 'clinic_admin'` — then
create a second tenant + user and confirm neither can see the other's data.
