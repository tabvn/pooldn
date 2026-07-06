import { builder } from "../builder";

builder.prismaObject("Team", {
  fields: (t) => ({
    id: t.exposeID("id"),
    name: t.exposeString("name"),
    slug: t.exposeString("slug"),
    logoUrl: t.exposeString("logoUrl", { nullable: true }),
    description: t.exposeString("description", { nullable: true }),
    captain: t.relation("captain"),
    city: t.relation("city", { nullable: true }),
    homeVenue: t.relation("homeVenue", { nullable: true }),
    // Active roster only — members who left (leaveTeam soft-deletes with
    // isActive=false) must drop off the roster, the member count, and the
    // "am I a member?" check that gates the Leave button.
    members: t.relation("members", {
      query: () => ({
        where: { isActive: true },
        orderBy: { joinedAt: "asc" },
      }),
    }),
    isActive: t.exposeBoolean("isActive"),
    bannedAt: t.expose("bannedAt", { type: "DateTime", nullable: true }),
    banReason: t.exposeString("banReason", { nullable: true }),
    createdAt: t.expose("createdAt", { type: "DateTime" }),
    // Competitions this team has applied to (any status) — used by team-landing
    // page to list "team's competitions".
    applications: t.relation("applications", {
      query: () => ({ orderBy: { submittedAt: "desc" } }),
    }),
    // Recent matches (both sides) — ordered by scheduledAt desc, capped to
    // the latest entries via the team-landing query's slice.
    homeMatches: t.relation("homeMatches", {
      query: () => ({ orderBy: { scheduledAt: "desc" }, take: 10 }),
    }),
    awayMatches: t.relation("awayMatches", {
      query: () => ({ orderBy: { scheduledAt: "desc" }, take: 10 }),
    }),
  }),
});

builder.prismaObject("TeamMember", {
  fields: (t) => ({
    id: t.exposeID("id"),
    team: t.relation("team"),
    user: t.relation("user"),
    joinedAt: t.expose("joinedAt", { type: "DateTime" }),
    isActive: t.exposeBoolean("isActive"),
  }),
});

export const CreateTeamInput = builder.inputType("CreateTeamInput", {
  fields: (t) => ({
    name: t.string({ required: true }),
    slug: t.string({ required: true }),
    logoUrl: t.string(),
    description: t.string(),
    cityId: t.id(),
    homeVenueId: t.id(),
    // Round-35 — usernames/emails to invite as ROSTER_INVITE on creation.
    // Captain is added automatically; this list is opt-in.
    invites: t.stringList(),
  }),
});
