import { redirect } from "next/navigation";

// Round-74 — Terms of Service now lives under the About section. Redirect the
// old canonical URL so existing/external links keep resolving.
export default function TermsRedirect() {
  redirect("/about/terms");
}
