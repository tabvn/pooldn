"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { MessageSquare, Send } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LocalDateTime } from "@/components/ui/local-datetime";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { errorText } from "@/lib/apollo/error-message";
import {
  ApplicationThreadQuery,
  MarkApplicationThreadReadMutation,
  PostApplicationMessageMutation,
} from "@/lib/graphql/operations/competition-mutations.operations";

/**
 * Round-77 — the conversation between an applicant and the competition
 * organizer, opened from either side's application card / row.
 *
 * The apply form's "Message to organizer" box writes the first entry, so this
 * is where that note finally surfaces — previously it was stored on the
 * application row and rendered nowhere, and the organizer only saw a generic
 * "X applied" ping with no way to read or answer it.
 *
 * Server-side the thread is readable only by its two parties (see
 * `viewerOwnsApplicationThread`), so a non-party opening this sheet gets an
 * empty list rather than someone else's conversation.
 */
export function ApplicationThread({
  applicationId,
  /** Who the viewer is talking to — used for the sheet's subtitle. */
  counterpartName,
  competitionName,
  triggerLabel = "Messages",
  triggerVariant = "secondary",
  /** Unread messages, shown as a badge on the trigger. Clears once the
   *  viewer opens the sheet. */
  unreadCount = 0,
  open: controlledOpen,
  onOpenChange,
}: {
  applicationId: string;
  counterpartName?: string;
  competitionName?: string;
  triggerLabel?: string | null;
  triggerVariant?: "primary" | "secondary" | "ghost";
  unreadCount?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const toast = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [body, setBody] = useState("");

  const { data, loading, refetch } = useQuery(ApplicationThreadQuery, {
    variables: { id: applicationId },
    // Only fetch once the sheet is actually open — the list can render dozens
    // of rows, and each one mounting a thread query would be wasteful.
    skip: !open,
    fetchPolicy: "cache-and-network",
  });
  const [post, { loading: sending }] = useMutation(
    PostApplicationMessageMutation,
  );
  const [markRead] = useMutation(MarkApplicationThreadReadMutation);

  const messages = data?.competitionApplication?.messages ?? [];

  // Opening the sheet IS reading the thread. Fire once the messages are on
  // screen (not merely on open) so the badge can't clear on a request that
  // never resolved. The mutation returns the application, so Apollo writes
  // the new unreadMessageCount straight into the list behind the sheet — no
  // refetch, and the badge disappears as you read.
  useEffect(() => {
    if (!open || loading) return;
    const app = data?.competitionApplication;
    if (!app || app.unreadMessageCount === 0) return;
    void markRead({ variables: { applicationId } }).catch(() => {
      // A failed read-receipt is not worth interrupting the reader for; the
      // badge simply stays until the next open.
    });
  }, [open, loading, data, applicationId, markRead]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    try {
      await post({ variables: { applicationId, body: text } });
      setBody("");
      await refetch();
    } catch (e) {
      toast.error(
        "Couldn't send",
        errorText(e, "Try again."),
      );
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {triggerLabel ? (
        <SheetTrigger
          render={
            <Button
              variant={triggerVariant}
              size="sm"
              data-testid={`open-application-thread-${applicationId}`}
            >
              <MessageSquare className="size-4" />
              {triggerLabel}
              {unreadCount > 0 ? (
                <span
                  className="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground"
                  aria-label={`${unreadCount} unread`}
                  data-testid={`application-thread-unread-${applicationId}`}
                >
                  {unreadCount}
                </span>
              ) : null}
            </Button>
          }
        />
      ) : null}
      <SheetContent side="right" testId="application-thread-sheet">
        <SheetHeader onClose={() => setOpen(false)}>
          <SheetTitle className="text-base font-semibold">Messages</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {counterpartName
              ? `Conversation with ${counterpartName}${
                  competitionName ? ` about ${competitionName}` : ""
                }.`
              : "Conversation about this application."}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="flex h-full flex-col gap-4">
            <ol
              className="min-h-0 flex-1 space-y-3 overflow-y-auto"
              data-testid="application-thread-messages"
            >
              {loading && messages.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </li>
              ) : messages.length === 0 ? (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  No messages yet — write the first one below.
                </li>
              ) : (
                messages.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-border bg-secondary/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        size="sm"
                        src={m.author.avatarUrl ?? undefined}
                        fallback={m.author.name}
                      />
                      <span className="text-sm font-medium">
                        {m.author.name}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        <LocalDateTime value={m.createdAt} variant="datetime" />
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
                  </li>
                ))
              )}
            </ol>
            <div className="shrink-0 space-y-2 border-t border-border pt-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Write a message…"
                className="block w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                data-testid="application-thread-input"
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  loading={sending}
                  disabled={!body.trim()}
                  onClick={send}
                  data-testid="application-thread-send"
                >
                  <Send className="size-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
