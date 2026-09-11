import { NextResponse } from "next/server";

// TEMPORARY diagnostic endpoint for the Find a Doctor crash investigation
// (Digest 800866611). Angel reported the exact same branded error screen
// (with "Reference: 800866611") after two rounds of fixes were committed
// and, per local git evidence, pushed — but this session has no Vercel
// project access, so there is no way to confirm from here whether Vercel
// has actually built and served either commit. This route reads Vercel's
// own build-time environment variables (populated automatically on every
// Vercel deployment, no configuration needed) and returns them as public,
// non-sensitive JSON — no auth required, since the whole point is to let
// this exact commit SHA be checked externally, including from this
// session via a plain fetch, without needing Vercel dashboard access at
// all. Remove once the Find a Doctor investigation is closed.
export async function GET() {
  return NextResponse.json({
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    checkedAt: new Date().toISOString(),
  });
}
