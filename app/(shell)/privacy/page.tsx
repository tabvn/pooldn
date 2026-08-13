import { redirect } from "next/navigation";

// Round-74 — Privacy Policy now lives under the About section. Redirect the
// old canonical URL so existing/external links keep resolving.
export default function PrivacyRedirect() {
  redirect("/about/privacy");
}
