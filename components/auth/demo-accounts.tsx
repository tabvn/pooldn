"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useApolloClient, useMutation } from "@apollo/client/react";
import { LoginMutation } from "@/lib/graphql/operations/auth.operations";

const DEMO_ACCOUNTS = [
  { role: "SUPER_ADMIN", username: "toan", name: "Toan Nguyen" },
  { role: "ORGANIZER", username: "michael", name: "Michael Dibbson" },
  { role: "ORGANIZER", username: "alex", name: "Alex Reid" },
  { role: "TEAM_CAPTAIN", username: "thomas", name: "Thomas Bryan" },
  { role: "TEAM_CAPTAIN", username: "gen", name: "Gen Hoang" },
  { role: "TEAM_CAPTAIN", username: "hai", name: "Hai Le" },
  { role: "TEAM_CAPTAIN", username: "long", name: "Long Duong" },
  { role: "TEAM_CAPTAIN", username: "duc", name: "Duc Tran" },
  { role: "TEAM_CAPTAIN", username: "kenji", name: "Kenji Sato" },
  { role: "TEAM_CAPTAIN", username: "sofia", name: "Sofia Garcia" },
  { role: "TEAM_CAPTAIN", username: "raj", name: "Raj Patel" },
  { role: "PLAYER", username: "player1", name: "Linh Tran" },
  { role: "PLAYER", username: "player2", name: "An Pham" },
  { role: "VIEWER", username: "viewer", name: "Viewer Demo" },
] as const;

const DEMO_PASSWORD = "password123";

const roleColor: Record<string, string> = {
  SUPER_ADMIN: "bg-destructive/20 text-destructive",
  ORGANIZER: "bg-info/20 text-info",
  TEAM_CAPTAIN: "bg-primary/20 text-primary",
  PLAYER: "bg-success/20 text-success",
  VIEWER: "bg-secondary text-foreground/60",
};

export function DemoAccounts() {
  const router = useRouter();
  const client = useApolloClient();
  const searchParams = useSearchParams();
  const nextHref = searchParams.get("next") ?? "/";
  const [login, { loading }] = useMutation(LoginMutation);

  async function quickLogin(username: string) {
    const result = await login({
      variables: { input: { usernameOrEmail: username, password: DEMO_PASSWORD } },
    });
    if (result.data?.login) {
      // Clear any prior session's cache before loading the new identity.
      await client.clearStore();
      router.push(nextHref);
      router.refresh();
    }
  }

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Demo accounts
        </p>
        <span className="text-[10px] text-white/50">pw: {DEMO_PASSWORD}</span>
      </div>
      <p className="text-xs text-white/50">
        One-click login for each role (dev fixtures).
      </p>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.username}>
            <button
              type="button"
              disabled={loading}
              onClick={() => quickLogin(a.username)}
              data-testid={`demo-login-${a.username}`}
              className="flex w-full items-center justify-between rounded-md border border-white/10 bg-background/40 px-3 py-2 text-left hover:bg-background/70 disabled:opacity-50"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">
                  {a.name}
                </span>
                <span className="text-[11px] text-white/50">@{a.username}</span>
              </div>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleColor[a.role]}`}
              >
                {a.role.replace(/_/g, " ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
