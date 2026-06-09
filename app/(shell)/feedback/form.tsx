"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CreateFeedbackMutation } from "@/lib/graphql/operations/feedback.operations";
import { ViewerQuery } from "@/lib/graphql/operations/competition.operations";

type FeedbackKind = "BUG" | "FEATURE" | "OTHER";

export function FeedbackForm() {
  const toast = useToast();
  const viewerQ = useQuery(ViewerQuery, { errorPolicy: "ignore" });
  const viewer = viewerQ.data?.viewer ?? null;
  const [type, setType] = useState<FeedbackKind>("FEATURE");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [submit, { loading }] = useMutation(CreateFeedbackMutation);

  if (done) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <CheckCircle2 className="size-6 text-success" />
          <div>
            <div className="text-sm font-semibold">Thanks for the note!</div>
            <p className="text-xs text-muted-foreground">
              We've logged it in the admin inbox. We don't promise to ship every
              idea, but we read every message.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send us a message</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!subject.trim() || !body.trim()) return;
            try {
              await submit({
                variables: {
                  type,
                  subject: subject.trim(),
                  message: body.trim(),
                  contactEmail: viewer ? null : email.trim() || null,
                },
              });
              toast.success("Feedback sent — thanks!");
              setDone(true);
            } catch (err) {
              toast.error("Couldn't send", err);
            }
          }}
        >
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as FeedbackKind)}
              options={[
                { value: "FEATURE", label: "Feature request" },
                { value: "BUG", label: "Bug report" },
                { value: "OTHER", label: "Other" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              maxLength={200}
              placeholder="A short summary"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Details</Label>
            <textarea
              id="body"
              rows={6}
              maxLength={4000}
              placeholder="What you'd like us to know — bug, idea, ask…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {!viewer ? (
            <div className="space-y-1.5">
              <Label htmlFor="contact">Your email (optional)</Label>
              <Input
                id="contact"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional — we'll only use it to reply.
              </p>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              loading={loading}
              iconBefore={<Send className="size-4" />}
              disabled={!subject.trim() || !body.trim()}
            >
              Send feedback
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
