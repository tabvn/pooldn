import { redirect } from "next/navigation";

// Round-74 — Help moved under the About section. Redirect the old URL so
// existing links (e.g. the forgot-password page) keep resolving.
export default function HelpRedirect() {
  redirect("/about/help");
}
