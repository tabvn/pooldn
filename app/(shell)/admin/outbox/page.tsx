import { requireViewer } from "@/lib/auth/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageTitle } from "@/components/layout/page-title";
import { LocalDateTime } from "@/components/ui/local-datetime";
// Round-47 — import from the slim outbox module (not email.service) so the
// RSC bundle for this page never pulls nodemailer into the static graph.
// Recurring fix for the "new admin route hangs on first compile" symptom.
import { getOutbox } from "@/lib/services/email-outbox";

export const dynamic = "force-dynamic";

/**
 * Round-45 — admin "where did my email go?" surface. Renders the
 * in-memory outbox of recent outbound emails (real + fallback). The
 * full HTML is shown so an admin can grab a reset / verify link
 * without checking the mailbox.
 *
 * Survives only the lifetime of the dev/prod process; that's fine —
 * this is a triage view, not a permanent log.
 */
export default async function OutboxPage() {
  await requireViewer({ next: "/admin/outbox", roles: ["SUPER_ADMIN"] });
  const entries = getOutbox();
  return (
    <div className="flex flex-col">
      <PageTitle
        title="Email outbox"
        eyebrow={<span>Admin · last 50 outbound</span>}
        description="In-memory ring buffer of recent emails. Shows the real send result and the message body so reset links are reachable even when SMTP is misbehaving."
      />
      <div className="p-4 md:p-8 max-w-5xl space-y-3">
        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No outbound mail yet this process.
            </CardContent>
          </Card>
        ) : (
          entries.map((e) => (
            <Card key={e.id} data-testid={`outbox-${e.id}`}>
              <CardContent className="space-y-2 py-3">
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-sm font-semibold">{e.subject}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      to {e.to}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={
                        e.status === "SENT"
                          ? "success"
                          : e.status === "FAILED"
                            ? "danger"
                            : "warning"
                      }
                      size="sm"
                    >
                      {e.status}
                    </Badge>
                    <LocalDateTime value={new Date(e.at).toISOString()} />
                  </div>
                </header>
                {e.note ? (
                  <p className="text-xs text-muted-foreground">{e.note}</p>
                ) : null}
                <details>
                  <summary className="cursor-pointer text-xs font-semibold text-primary">
                    Show body
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background/40 px-2 py-2 text-xs whitespace-pre-wrap break-words">
                    {e.text}
                  </pre>
                </details>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
