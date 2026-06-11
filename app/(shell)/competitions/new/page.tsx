import { requireViewer } from "@/lib/auth/server";
import { BasicsForm } from "./basics-form";

/**
 * Round-51 — Competition creation, Figma-faithful "Create New Competition"
 * basics screen. Captures only the seven core fields shown in the design
 * (name, description, game, format, type, start date, prize). The remaining
 * setup happens after create in the 4-tab editor (Participants · Structure
 * · Schedule · Review & Publish).
 */
export default async function NewCompetitionPage() {
  // Anyone signed in can organize a competition. The viewer is the
  // organizerId on the new row, and per-entity CASL grants them manage
  // rights on it (same pattern as captaincy being per-team, not a global role).
  await requireViewer({ next: "/competitions/new" });
  return <BasicsForm />;
}
