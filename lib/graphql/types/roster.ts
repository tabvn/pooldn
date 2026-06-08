import { builder } from "../builder";

export const RosterConflict = builder
  .objectRef<{
    userId: string;
    userName: string;
    userUsername: string;
    teamId: string;
    teamName: string;
    status: string;
  }>("RosterConflict")
  .implement({
    description:
      "A player who is already rostered on another team in the same competition.",
    fields: (t) => ({
      userId: t.exposeID("userId"),
      userName: t.exposeString("userName"),
      userUsername: t.exposeString("userUsername"),
      teamId: t.exposeID("teamId"),
      teamName: t.exposeString("teamName"),
      status: t.exposeString("status"),
    }),
  });
