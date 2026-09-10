import { redirect } from "next/navigation";

// RETIRED (spec bug fix): this used to be the permanent, nav-less landing
// page for any patient without a clinic relationship yet — exactly the
// disconnected dead end Angel reported ("Welcome to MyCareDesk!" with only
// two buttons and no way to reach the rest of the portal). /portal (the
// dashboard) now shows this same "Get Started" content itself, WITH the
// normal PortalShell nav visible, for a brand-new patient. Nothing in the
// app links here anymore (login, finish-signup, and patient-signup all go
// straight to /portal), but this redirect stays so any stale bookmark or
// old link still lands somewhere useful instead of a dead end.
export default function PortalWelcomePage() {
  redirect("/portal");
}
