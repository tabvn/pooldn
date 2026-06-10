import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

async function hash(p: string) {
  return bcrypt.hash(p, BCRYPT_ROUNDS);
}

async function main() {
  // ── Cleanup: remove anything left behind by E2E or mentor test runs ─────
  // Slugs that begin with `e2e-` or `mentor-` are throwaway fixtures from
  // Playwright / live-test sessions. Deleting them at the top of every seed
  // run keeps the demo Poolhub clean.
  const stale = await prisma.competition.findMany({
    where: {
      OR: [
        { slug: { startsWith: "e2e-" } },
        { slug: { startsWith: "mentor-" } },
      ],
    },
    select: { id: true, slug: true },
  });
  if (stale.length) {
    await prisma.competition.deleteMany({
      where: { id: { in: stale.map((s) => s.id) } },
    });
    console.log(
      `seed: cleaned ${stale.length} test competitions: ` +
        stale.map((s) => s.slug).join(", "),
    );
  }

  // ── Countries + cities ──────────────────────────────────────────────────
  const vietnam = await prisma.country.upsert({
    where: { code: "VN" },
    update: { name: "Vietnam" },
    create: { code: "VN", name: "Vietnam" },
  });
  const canada = await prisma.country.upsert({
    where: { code: "CA" },
    update: { name: "Canada" },
    create: { code: "CA", name: "Canada" },
  });

  const daNang = await prisma.city.upsert({
    where: { countryId_name: { countryId: vietnam.id, name: "Da Nang" } },
    update: {},
    create: { name: "Da Nang", countryId: vietnam.id },
  });
  const toronto = await prisma.city.upsert({
    where: { countryId_name: { countryId: canada.id, name: "Toronto" } },
    update: {},
    create: { name: "Toronto", countryId: canada.id },
  });

  // ── Venues ──────────────────────────────────────────────────────────────
  const poolParadise = await prisma.venue.upsert({
    where: { slug: "pool-paradise" },
    update: {},
    create: {
      slug: "pool-paradise",
      name: "Pool Paradise",
      address: "12 Bach Dang, Da Nang",
      cityId: daNang.id,
      tableCount: 8,
    },
  });
  const fillingStation = await prisma.venue.upsert({
    where: { slug: "filling-station" },
    update: {},
    create: {
      slug: "filling-station",
      name: "Filling Station",
      address: "47 Phan Chau Trinh, Da Nang",
      cityId: daNang.id,
      tableCount: 6,
    },
  });
  const sharkBar = await prisma.venue.upsert({
    where: { slug: "shark-bar" },
    update: {},
    create: {
      slug: "shark-bar",
      name: "Shark Bar",
      address: "88 Tran Phu, Da Nang",
      cityId: daNang.id,
      tableCount: 10,
    },
  });

  // ── Users (covers every role) ───────────────────────────────────────────
  const pw = await hash("password123");

  // Deterministic dicebear avatar from the username so the demo accounts
  // ship with a real image instead of initials. Real uploads via
  // /api/upload override this once the user picks a photo.
  const avatarFor = (username: string) =>
    `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

  const upsertUser = (input: {
    username: string;
    name: string;
    email: string;
    role:
      | "SUPER_ADMIN"
      | "ORGANIZER"
      | "TEAM_CAPTAIN"
      | "PLAYER"
      | "VIEWER";
    cityId?: string;
    nationality?: string;
  }) =>
    prisma.user.upsert({
      where: { username: input.username },
      update: {
        name: input.name,
        email: input.email,
        password: pw,
        role: input.role,
        cityId: input.cityId ?? null,
        nationality: input.nationality ?? null,
        avatarUrl: avatarFor(input.username),
      },
      create: {
        name: input.name,
        username: input.username,
        email: input.email,
        password: pw,
        role: input.role,
        cityId: input.cityId ?? null,
        nationality: input.nationality ?? null,
        avatarUrl: avatarFor(input.username),
      },
    });

  const toan = await upsertUser({
    username: "toan",
    name: "Toan Nguyen",
    email: "toan@thebay.city",
    role: "SUPER_ADMIN",
    cityId: daNang.id,
  });
  const bekazat = await upsertUser({
    username: "bekazat",
    name: "Bekazat",
    email: "bek@thebay.city",
    role: "SUPER_ADMIN",
    cityId: daNang.id,
  });
  void bekazat;
  const michael = await upsertUser({
    username: "michael",
    name: "Michael Dibbson",
    email: "michael@pooldn.local",
    role: "ORGANIZER",
    cityId: daNang.id,
  });
  const alex = await upsertUser({
    username: "alex",
    name: "Alex Reid",
    email: "alex@pooldn.local",
    role: "ORGANIZER",
    cityId: toronto.id,
    nationality: "CA",
  });
  const thomas = await upsertUser({
    username: "thomas",
    name: "Thomas Bryan",
    email: "thomas@pooldn.local",
    role: "TEAM_CAPTAIN",
    cityId: daNang.id,
    nationality: "CA",
  });
  const gen = await upsertUser({
    username: "gen",
    name: "Gen Hoang",
    email: "gen@pooldn.local",
    role: "TEAM_CAPTAIN",
    cityId: daNang.id,
  });
  const hai = await upsertUser({
    username: "hai",
    name: "Hai Le",
    email: "hai@pooldn.local",
    role: "TEAM_CAPTAIN",
    cityId: daNang.id,
  });
  const player1 = await upsertUser({
    username: "player1",
    name: "Linh Tran",
    email: "linh@pooldn.local",
    role: "PLAYER",
    cityId: daNang.id,
  });
  const player2 = await upsertUser({
    username: "player2",
    name: "An Pham",
    email: "an@pooldn.local",
    role: "PLAYER",
    cityId: daNang.id,
  });
  const player3 = await upsertUser({
    username: "player3",
    name: "Diep Vo",
    email: "diep@pooldn.local",
    role: "PLAYER",
    cityId: daNang.id,
  });
  await upsertUser({
    username: "viewer",
    name: "Viewer Demo",
    email: "viewer@pooldn.local",
    role: "VIEWER",
  });

  // ── Teams ───────────────────────────────────────────────────────────────
  const teamLogoFor = (slug: string) =>
    `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(slug)}&backgroundColor=d0f30d,9810fa,1c2280,0b4f4a&backgroundType=gradientLinear`;
  const upsertTeam = (input: {
    slug: string;
    name: string;
    captainId: string;
    cityId: string;
  }) =>
    prisma.team.upsert({
      where: { slug: input.slug },
      update: { logoUrl: teamLogoFor(input.slug), cityId: input.cityId },
      create: { ...input, logoUrl: teamLogoFor(input.slug) },
    });

  const genTeam = await upsertTeam({
    slug: "gen-filling-station",
    name: "Gen Filling Station",
    captainId: gen.id,
    cityId: daNang.id,
  });
  const tigers = await upsertTeam({
    slug: "da-nang-tigers",
    name: "Da Nang Tigers",
    captainId: thomas.id,
    cityId: daNang.id,
  });
  const haiCrew = await upsertTeam({
    slug: "hai-crew",
    name: "Hai's Crew",
    captainId: hai.id,
    cityId: daNang.id,
  });
  const sharks = await upsertTeam({
    slug: "pool-sharks",
    name: "Pool Sharks",
    captainId: gen.id,
    cityId: daNang.id,
  });

  // members
  const memberships: Array<[{ id: string }, { id: string }]> = [
    [genTeam, gen],
    [genTeam, player1],
    [genTeam, player2],
    [tigers, thomas],
    [tigers, player2],
    [tigers, player3],
    [haiCrew, hai],
    [haiCrew, player1],
    [haiCrew, player3],
    [sharks, gen],
  ];
  for (const [team, user] of memberships) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
      update: {},
      create: { teamId: team.id, userId: user.id },
    });
  }

  // ── Competitions ────────────────────────────────────────────────────────
  const bannerFor = (slug: string) =>
    `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(slug)}`;
  const completed = await prisma.competition.upsert({
    where: { slug: "da-nang-international-pool-league-2026" },
    update: { bannerUrl: bannerFor("da-nang-international-pool-league-2026") },
    create: {
      bannerUrl: bannerFor("da-nang-international-pool-league-2026"),
      slug: "da-nang-international-pool-league-2026",
      name: "Da Nang International Pool League",
      description:
        "Inaugural international 10-ball league hosted across Da Nang's premier venues.",
      organizerId: michael.id,
      cityId: daNang.id,
      status: "COMPLETED",
      type: "TEAMS",
      format: "ROUND_ROBIN",
      gameType: "TEN_BALL",
      maxTeams: 5,
      minTeams: 4,
      maxPlayersPerTeam: 6,
      minPlayersPerTeam: 3,
      raceToFrames: 5,
      startDate: new Date("2026-06-20"),
      endDate: new Date("2026-10-16"),
      prizePool: "5000000",
      currency: "VND",
    },
  });

  const ongoing = await prisma.competition.upsert({
    where: { slug: "da-nang-autumn-invitational-2026" },
    update: { bannerUrl: bannerFor("da-nang-autumn-invitational-2026") },
    create: {
      bannerUrl: bannerFor("da-nang-autumn-invitational-2026"),
      slug: "da-nang-autumn-invitational-2026",
      name: "Da Nang Autumn Invitational",
      description: "Quick-format 8-ball invitational across the autumn season.",
      organizerId: michael.id,
      cityId: daNang.id,
      status: "ONGOING",
      type: "TEAMS",
      format: "ROUND_ROBIN",
      gameType: "EIGHT_BALL",
      maxTeams: 4,
      minTeams: 3,
      raceToFrames: 4,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-11-30"),
      prizePool: "3000000",
      currency: "VND",
    },
  });

  // Round-9 / Round-18 — match structure used by About, Match Flow lineup
  // gating, and the live scoreboard. ONGOING gets 3 Singles + 10m break +
  // 2 Doubles + 5m break + 3 Singles (8 frames). COMPLETED gets the same
  // structure so its archived MatchFrames have real types attached.
  for (const compId of [ongoing.id, completed.id]) {
    await prisma.matchFormatBlock.deleteMany({
      where: { competitionId: compId },
    });
    await prisma.matchFormatBlock.createMany({
      data: [
        {
          competitionId: compId,
          order: 1,
          type: "SINGLES",
          games: 3,
          breakAfterMin: 10,
        },
        {
          competitionId: compId,
          order: 2,
          type: "DOUBLES",
          games: 2,
          breakAfterMin: 5,
        },
        {
          competitionId: compId,
          order: 3,
          type: "SINGLES",
          games: 3,
        },
      ],
    });
  }

  const open = await prisma.competition.upsert({
    where: { slug: "spring-open-2027" },
    update: {},
    create: {
      slug: "spring-open-2027",
      name: "Spring Open",
      description: "Open registration for spring 2027 team league.",
      organizerId: michael.id,
      cityId: daNang.id,
      status: "OPEN_FOR_APPLICATIONS",
      type: "TEAMS",
      format: "ROUND_ROBIN",
      gameType: "NINE_BALL",
      maxTeams: 8,
      minTeams: 4,
      raceToFrames: 5,
      startDate: new Date("2027-03-01"),
      endDate: new Date("2027-06-30"),
      applicationDeadline: new Date("2027-02-15"),
      prizePool: "8000000",
      currency: "VND",
    },
  });

  await prisma.competition.upsert({
    where: { slug: "toronto-bayside-cup-2027" },
    update: {},
    create: {
      slug: "toronto-bayside-cup-2027",
      name: "Toronto Bayside Cup",
      description: "Draft — not yet open.",
      organizerId: alex.id,
      cityId: toronto.id,
      status: "DRAFT",
      type: "TEAMS",
      format: "DOUBLE_ELIMINATION",
      gameType: "NINE_BALL",
      isPublic: false,
    },
  });

  // A competition in APPLICATIONS_CLOSED with enough approved teams to
  // immediately trigger generateMatchdays from the organizer's "Start" action
  // — used by E2E that drive the start-competition flow end-to-end, and as
  // a manual QA fixture so reviewers can press Start without first having to
  // close applications.
  const startable = await prisma.competition.upsert({
    where: { slug: "da-nang-winter-cup-2026" },
    update: { bannerUrl: bannerFor("da-nang-winter-cup-2026") },
    create: {
      bannerUrl: bannerFor("da-nang-winter-cup-2026"),
      slug: "da-nang-winter-cup-2026",
      name: "Da Nang Winter Cup",
      description:
        "Applications closed, roster locked. Ready to start — organizer just hits Start.",
      organizerId: michael.id,
      cityId: daNang.id,
      status: "APPLICATIONS_CLOSED",
      type: "TEAMS",
      format: "ROUND_ROBIN",
      gameType: "TEN_BALL",
      maxTeams: 4,
      minTeams: 3,
      raceToFrames: 5,
      startDate: new Date("2026-12-01"),
      endDate: new Date("2027-02-28"),
      applicationDeadline: new Date("2026-11-15"),
      prizePool: "4000000",
      currency: "VND",
    },
  });

  // Mirror the singles/doubles/singles structure used by ongoing so the start
  // action has a real match-format scaffold to thread through.
  await prisma.matchFormatBlock.deleteMany({
    where: { competitionId: startable.id },
  });
  await prisma.matchFormatBlock.createMany({
    data: [
      { competitionId: startable.id, order: 1, type: "SINGLES", games: 3, breakAfterMin: 10 },
      { competitionId: startable.id, order: 2, type: "DOUBLES", games: 2, breakAfterMin: 5 },
      { competitionId: startable.id, order: 3, type: "SINGLES", games: 3 },
    ],
  });

  // ── Applications ────────────────────────────────────────────────────────
  type AppStatus =
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "CANCELLED"
    | "WAITLISTED"
    | "INVITED";

  // Round-50 — seed applicationPlayers + CompetitionRoster alongside the
  // application row so the new "Application (players)" detail view and the
  // Players tab have something to show on a fresh DB.
  //
  // applicationPlayers carries every active team member (cross-team overlap
  // is tolerated at the seed level so each team's drawer shows a populated
  // roster — assertNoCrossTeamRoster would gate this in production, but
  // here we trade that invariant for a friendly demo state).
  //
  // CompetitionRoster respects its DB unique([competitionId, userId])
  // constraint: first-come APPROVED app for each user wins; later
  // APPROVED apps that share a user just skip the duplicate row.
  const rosteredInComp = new Map<string, Set<string>>();

  const upsertApp = async (
    competitionId: string,
    teamId: string,
    status: AppStatus,
    reviewNote?: string,
  ) => {
    const app = await prisma.competitionApplication.upsert({
      where: { competitionId_teamId: { competitionId, teamId } },
      update: { status, reviewNote: reviewNote ?? null },
      create: {
        competitionId,
        teamId,
        status,
        reviewNote: reviewNote ?? null,
        reviewedAt: status === "PENDING" ? null : new Date(),
      },
    });

    // Idempotent reseed: wipe both tables for this (app, team) so re-runs
    // always reflect the current memberships rather than stale unions.
    await prisma.applicationPlayer.deleteMany({
      where: { applicationId: app.id },
    });
    await prisma.competitionRoster.deleteMany({
      where: { competitionId, teamId },
    });

    // INVITED rows are organizer-seeded — the captain hasn't picked players
    // yet, so leave applicationPlayers + CompetitionRoster empty (mirrors
    // inviteTeamsToCompetition).
    if (status === "INVITED") return app;

    const members = await prisma.teamMember.findMany({
      where: { teamId, isActive: true },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    });

    if (members.length > 0) {
      await prisma.applicationPlayer.createMany({
        data: members.map((m) => ({
          applicationId: app.id,
          userId: m.userId,
          name: m.user.name,
        })),
      });
    }

    if (status === "APPROVED" && members.length > 0) {
      const taken =
        rosteredInComp.get(competitionId) ?? new Set<string>();
      const freshlyRostered = members.filter((m) => !taken.has(m.userId));
      for (const m of freshlyRostered) taken.add(m.userId);
      rosteredInComp.set(competitionId, taken);
      if (freshlyRostered.length > 0) {
        await prisma.competitionRoster.createMany({
          data: freshlyRostered.map((m) => ({
            competitionId,
            teamId,
            userId: m.userId,
          })),
        });
      }
    }

    return app;
  };

  // Round-50 — re-seeds keep stale CompetitionRoster + ApplicationPlayer
  // rows from prior runs (different team distributions, retired players,
  // etc.), which collide with the (competitionId, userId) unique
  // constraint when upsertApp tries to seed the fresh first-come
  // assignment. Wipe the seeded competitions clean BEFORE any upsertApp
  // call so the cache + idempotent rebuild lines up.
  const seededCompetitionIds = [
    completed.id,
    ongoing.id,
    startable.id,
    open.id,
  ];
  await prisma.competitionRoster.deleteMany({
    where: { competitionId: { in: seededCompetitionIds } },
  });
  await prisma.applicationPlayer.deleteMany({
    where: { application: { competitionId: { in: seededCompetitionIds } } },
  });

  // Completed comp — 2 approved (original participants)
  await upsertApp(completed.id, genTeam.id, "APPROVED");
  await upsertApp(completed.id, tigers.id, "APPROVED");

  // Ongoing comp — all approved
  await upsertApp(ongoing.id, genTeam.id, "APPROVED");
  await upsertApp(ongoing.id, tigers.id, "APPROVED");
  await upsertApp(ongoing.id, haiCrew.id, "APPROVED");
  await upsertApp(
    ongoing.id,
    sharks.id,
    "REJECTED",
    "Roster below minimum size",
  );

  // Startable comp — all approved, hits minTeams=3 so Start succeeds.
  await upsertApp(startable.id, genTeam.id, "APPROVED");
  await upsertApp(startable.id, tigers.id, "APPROVED");
  await upsertApp(startable.id, haiCrew.id, "APPROVED");

  // Open comp — mixed states (Hai's Crew intentionally NOT pre-applied so
  // the apply-approve-standings e2e can drive the full flow as hai).
  await upsertApp(open.id, genTeam.id, "PENDING");
  await upsertApp(open.id, tigers.id, "APPROVED");
  await upsertApp(open.id, sharks.id, "CANCELLED");
  await prisma.competitionApplication.deleteMany({
    where: { competitionId: open.id, teamId: haiCrew.id },
  });

  // ── Matchdays + matches for the ongoing competition ─────────────────────
  // Wipe the ongoing comp's matches + standings on every seed so re-runs
  // don't accumulate orphan pairings when the canonical fixtures change.
  await prisma.match.deleteMany({
    where: { matchday: { competitionId: ongoing.id } },
  });
  await prisma.standing.deleteMany({ where: { competitionId: ongoing.id } });

  const md1 = await prisma.matchday.upsert({
    where: { competitionId_number: { competitionId: ongoing.id, number: 1 } },
    update: {},
    create: {
      competitionId: ongoing.id,
      number: 1,
      label: "Week 1",
      scheduledDate: new Date("2026-09-05"),
      isGenerated: true,
    },
  });
  const md2 = await prisma.matchday.upsert({
    where: { competitionId_number: { competitionId: ongoing.id, number: 2 } },
    update: {},
    create: {
      competitionId: ongoing.id,
      number: 2,
      label: "Week 2",
      scheduledDate: new Date("2026-09-12"),
      isGenerated: true,
    },
  });
  const md3 = await prisma.matchday.upsert({
    where: { competitionId_number: { competitionId: ongoing.id, number: 3 } },
    update: {},
    create: {
      competitionId: ongoing.id,
      number: 3,
      label: "Week 3 (upcoming)",
      scheduledDate: new Date("2026-09-19"),
      isGenerated: true,
    },
  });

  async function upsertMatch(
    matchdayId: string,
    homeTeamId: string,
    awayTeamId: string,
    data: {
      venueId: string;
      status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
      homeScore?: number;
      awayScore?: number;
      scheduledAt: Date;
    },
  ) {
    const existing = await prisma.match.findFirst({
      where: { matchdayId, homeTeamId, awayTeamId },
    });
    if (existing) {
      return prisma.match.update({
        where: { id: existing.id },
        data: {
          venueId: data.venueId,
          status: data.status,
          homeScore: data.homeScore ?? null,
          awayScore: data.awayScore ?? null,
          scheduledAt: data.scheduledAt,
          completedAt: data.status === "COMPLETED" ? data.scheduledAt : null,
        },
      });
    }
    return prisma.match.create({
      data: {
        matchdayId,
        homeTeamId,
        awayTeamId,
        venueId: data.venueId,
        status: data.status,
        homeScore: data.homeScore ?? null,
        awayScore: data.awayScore ?? null,
        scheduledAt: data.scheduledAt,
        completedAt: data.status === "COMPLETED" ? data.scheduledAt : null,
      },
    });
  }

  // Ongoing comp has 3 approved teams (Gen, Tigers, Hai); Sharks was
  // REJECTED so no matches involve them. Each pair plays home + away.
  // Week 1 — completed
  await upsertMatch(md1.id, genTeam.id, tigers.id, {
    venueId: fillingStation.id,
    status: "COMPLETED",
    homeScore: 4,
    awayScore: 2,
    scheduledAt: new Date("2026-09-05T19:00:00Z"),
  });
  await upsertMatch(md1.id, haiCrew.id, genTeam.id, {
    venueId: poolParadise.id,
    status: "COMPLETED",
    homeScore: 4,
    awayScore: 3,
    scheduledAt: new Date("2026-09-05T19:00:00Z"),
  });

  // Week 2 — one completed, one in progress
  await upsertMatch(md2.id, tigers.id, haiCrew.id, {
    venueId: sharkBar.id,
    status: "COMPLETED",
    homeScore: 3,
    awayScore: 4,
    scheduledAt: new Date("2026-09-12T19:00:00Z"),
  });
  await upsertMatch(md2.id, genTeam.id, haiCrew.id, {
    venueId: fillingStation.id,
    status: "IN_PROGRESS",
    scheduledAt: new Date("2026-09-12T19:00:00Z"),
  });

  // Week 3 — both scheduled (return legs)
  await upsertMatch(md3.id, tigers.id, genTeam.id, {
    venueId: poolParadise.id,
    status: "SCHEDULED",
    scheduledAt: new Date("2026-09-19T19:00:00Z"),
  });
  await upsertMatch(md3.id, haiCrew.id, tigers.id, {
    venueId: sharkBar.id,
    status: "SCHEDULED",
    scheduledAt: new Date("2026-09-19T19:00:00Z"),
  });

  // ── One match in the completed competition (head-to-head reflected) ─────
  const completedMatchday = await prisma.matchday.upsert({
    where: {
      competitionId_number: { competitionId: completed.id, number: 1 },
    },
    update: {},
    create: {
      competitionId: completed.id,
      number: 1,
      label: "Final",
      scheduledDate: new Date("2026-10-16"),
      isGenerated: true,
    },
  });
  await upsertMatch(completedMatchday.id, genTeam.id, tigers.id, {
    venueId: fillingStation.id,
    status: "COMPLETED",
    homeScore: 5,
    awayScore: 3,
    scheduledAt: new Date("2026-10-16T19:00:00Z"),
  });

  // ── Standings (consistent with the seeded matches) ──────────────────────
  // Completed comp head-to-head: Gen 5-3 → Gen W (3 pts), Tigers L (0 pts)
  await upsertStanding(completed.id, genTeam.id, {
    position: 1,
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    pointsFor: 5,
    pointsAgainst: 3,
    pointDiff: 2,
    points: 3,
  });
  await upsertStanding(completed.id, tigers.id, {
    position: 2,
    played: 1,
    won: 0,
    drawn: 0,
    lost: 1,
    pointsFor: 3,
    pointsAgainst: 5,
    pointDiff: -2,
    points: 0,
  });

  // Ongoing comp standings — computed from Week 1 + Week 2 completed matches.
  // Three approved teams (Gen, Tigers, Hai). Sharks were REJECTED → not in
  // standings and not in any match.
  // Week 1 — Gen 4-2 Tigers; Hai 4-3 Gen.
  // Week 2 — Tigers 3-4 Hai (Hai won); Gen vs Hai still IN_PROGRESS.
  // → Hai 2W (+1 PD), Gen 1W 1L (+2 PD), Tigers 0W 2L (-3 PD)
  await upsertStanding(ongoing.id, haiCrew.id, {
    position: 1,
    played: 2,
    won: 2,
    drawn: 0,
    lost: 0,
    pointsFor: 8,
    pointsAgainst: 6,
    pointDiff: 2,
    points: 6,
  });
  await upsertStanding(ongoing.id, genTeam.id, {
    position: 2,
    played: 2,
    won: 1,
    drawn: 0,
    lost: 1,
    pointsFor: 7,
    pointsAgainst: 6,
    pointDiff: 1,
    points: 3,
  });
  await upsertStanding(ongoing.id, tigers.id, {
    position: 3,
    played: 2,
    won: 0,
    drawn: 0,
    lost: 2,
    pointsFor: 5,
    pointsAgainst: 8,
    pointDiff: -3,
    points: 0,
  });

  // Defensive: drop any standings + matches that involve non-approved
  // teams (e.g. Sharks were REJECTED but earlier seeds left rows behind).
  const ongoingApproved = await prisma.competitionApplication.findMany({
    where: { competitionId: ongoing.id, status: "APPROVED" },
    select: { teamId: true },
  });
  const ongoingApprovedIds = ongoingApproved.map((a) => a.teamId);
  await prisma.standing.deleteMany({
    where: {
      competitionId: ongoing.id,
      teamId: { notIn: ongoingApprovedIds },
    },
  });
  await prisma.match.deleteMany({
    where: {
      matchday: { competitionId: ongoing.id },
      OR: [
        { homeTeamId: { notIn: ongoingApprovedIds } },
        { awayTeamId: { notIn: ongoingApprovedIds } },
      ],
    },
  });

  // ── Player stats — MVPs + a spread ──────────────────────────────────────
  // Round-18: MVP = highest win% (frames won / frames played) on the
  // competition's COMPLETED roster. Gen wins the league head-to-head
  // (5/8 = 62.5%) so he carries the MVP flag.
  await upsertPlayerStat(completed.id, thomas.id, {
    isMvp: false,
    matchesPlayed: 1,
    framesWon: 4,
    framesPlayed: 8,
  });
  await upsertPlayerStat(completed.id, gen.id, {
    isMvp: true,
    matchesPlayed: 1,
    framesWon: 5,
    framesPlayed: 8,
  });
  await upsertPlayerStat(ongoing.id, gen.id, {
    isMvp: true,
    matchesPlayed: 2,
    framesWon: 6,
    framesPlayed: 8,
  });
  await upsertPlayerStat(ongoing.id, hai.id, {
    isMvp: false,
    matchesPlayed: 2,
    framesWon: 5,
    framesPlayed: 8,
  });
  await upsertPlayerStat(ongoing.id, player1.id, {
    isMvp: false,
    matchesPlayed: 2,
    framesWon: 3,
    framesPlayed: 6,
  });

  // ── Notifications ───────────────────────────────────────────────────────
  // Fresh-write each run so the typed/deeplink fields stay aligned.
  await prisma.notification.deleteMany({});
  await prisma.notification.createMany({
    data: [
      {
        userId: toan.id,
        type: "WELCOME",
        title: "Welcome to PoolDN",
        message: "Your league management workspace is ready.",
        entityType: "USER",
        entityId: toan.id,
        entitySlug: toan.username,
        groupKey: `welcome-${toan.id}`,
      },
      {
        userId: michael.id,
        type: "APPLICATION_SUBMITTED",
        title: "Gen Filling Station applied to Spring Open",
        message: "Review and decide on their application.",
        entityType: "APPLICATION",
        entityId: open.id,
        entitySlug: open.slug,
        groupKey: `app-${open.id}`,
      },
      {
        userId: gen.id,
        type: "APPLICATION_APPROVED",
        title: "Application approved",
        message: "Da Nang Tigers' application for Spring Open is approved.",
        entityType: "COMPETITION",
        entityId: open.id,
        entitySlug: open.slug,
        groupKey: `app-approved-${open.id}-${gen.id}`,
      },
      {
        userId: thomas.id,
        type: "MATCH_SCHEDULED",
        title: "Match scheduled — Week 3",
        message: "Tigers vs Hai's Crew, Friday at Pool Paradise.",
        entityType: "COMPETITION",
        entityId: ongoing.id,
        entitySlug: ongoing.slug,
        groupKey: `md3-${ongoing.id}`,
      },
      {
        userId: gen.id,
        type: "MATCH_RESULT_RECORDED",
        title: "Match result recorded",
        message: "Gen Filling Station beat Da Nang Tigers 4-2 in Week 1.",
        entityType: "COMPETITION",
        entityId: ongoing.id,
        entitySlug: ongoing.slug,
        groupKey: `md1-${ongoing.id}`,
        isRead: true,
      },
    ],
  });

  // ── Round-12 TASK 5 — extra players + invitations + score submissions ──
  // Make the fixture set rich enough to drive the role-walk e2e tests.
  const extraPlayers = await Promise.all(
    [
      { username: "tuan", name: "Tuan Le", email: "tuan@pooldn.local" },
      { username: "minh", name: "Minh Nguyen", email: "minh@pooldn.local" },
      { username: "bao", name: "Bao Pham", email: "bao@pooldn.local" },
      { username: "kim", name: "Kim Tran", email: "kim@pooldn.local" },
      { username: "lan", name: "Lan Hoang", email: "lan@pooldn.local" },
      { username: "phong", name: "Phong Vo", email: "phong@pooldn.local" },
      { username: "yen", name: "Yen Bui", email: "yen@pooldn.local" },
      { username: "duy", name: "Duy Dao", email: "duy@pooldn.local" },
    ].map((u) =>
      upsertUser({
        username: u.username,
        name: u.name,
        email: u.email,
        role: "PLAYER",
        cityId: daNang.id,
      }),
    ),
  );

  // Pending team invitation: Hai's Crew invites Tuan.
  await prisma.teamInvitation.upsert({
    where: { token: "seed-invite-tuan-haicrew" },
    update: {},
    create: {
      token: "seed-invite-tuan-haicrew",
      teamId: haiCrew.id,
      invitedById: hai.id,
      invitedUserId: extraPlayers[0]!.id,
      message: "We could use your break shot on Friday — join us?",
    },
  });

  // Pending join request: Minh wants to join Gen Filling Station.
  await prisma.teamJoinRequest.upsert({
    where: {
      teamId_userId: { teamId: genTeam.id, userId: extraPlayers[1]!.id },
    },
    update: { status: "PENDING", reviewedAt: null, reviewedById: null },
    create: {
      teamId: genTeam.id,
      userId: extraPlayers[1]!.id,
      message: "Looking to compete in the autumn league.",
    },
  });

  // Score submissions: an auto-approved pair on a completed match, and a
  // conflict awaiting organizer review on another.
  const completedMatch = await prisma.match.findFirst({
    where: {
      matchday: { competitionId: ongoing.id },
      status: "COMPLETED",
    },
    include: {
      homeTeam: { select: { id: true, captainId: true } },
      awayTeam: { select: { id: true, captainId: true } },
    },
  });
  if (completedMatch?.homeTeam && completedMatch?.awayTeam) {
    await prisma.matchScoreSubmission.deleteMany({
      where: { matchId: completedMatch.id },
    });
    await prisma.matchScoreSubmission.createMany({
      data: [
        {
          matchId: completedMatch.id,
          submittedById: completedMatch.homeTeam.captainId,
          forTeamId: completedMatch.homeTeam.id,
          homeScore: completedMatch.homeScore ?? 0,
          awayScore: completedMatch.awayScore ?? 0,
          status: "AUTO_APPROVED",
          reviewedAt: completedMatch.completedAt ?? new Date(),
        },
        {
          matchId: completedMatch.id,
          submittedById: completedMatch.awayTeam.captainId,
          forTeamId: completedMatch.awayTeam.id,
          homeScore: completedMatch.homeScore ?? 0,
          awayScore: completedMatch.awayScore ?? 0,
          status: "AUTO_APPROVED",
          reviewedAt: completedMatch.completedAt ?? new Date(),
        },
      ],
    });
  }
  const inProgressMatch = await prisma.match.findFirst({
    where: {
      matchday: { competitionId: ongoing.id },
      status: "IN_PROGRESS",
    },
    include: {
      homeTeam: { select: { id: true, captainId: true } },
      awayTeam: { select: { id: true, captainId: true } },
    },
  });
  if (inProgressMatch?.homeTeam && inProgressMatch?.awayTeam) {
    await prisma.matchScoreSubmission.deleteMany({
      where: { matchId: inProgressMatch.id },
    });
    await prisma.matchScoreSubmission.createMany({
      data: [
        {
          matchId: inProgressMatch.id,
          submittedById: inProgressMatch.homeTeam.captainId,
          forTeamId: inProgressMatch.homeTeam.id,
          homeScore: 4,
          awayScore: 1,
          status: "CONFLICT",
        },
        {
          matchId: inProgressMatch.id,
          submittedById: inProgressMatch.awayTeam.captainId,
          forTeamId: inProgressMatch.awayTeam.id,
          homeScore: 3,
          awayScore: 2,
          status: "CONFLICT",
        },
      ],
    });
  }

  // Round-14 — scaffold per-match MatchFrame rows from the competition
  // structure for ONGOING + COMPLETED comps so the lineup screen + About
  // tab + scoreboard have real frames + block types to render.
  const { scaffoldMatchFramesFromStructure } = await import(
    "../lib/services/match-frame-scaffold"
  );
  const framedMatches = await prisma.match.findMany({
    where: {
      matchday: {
        competitionId: { in: [ongoing.id, completed.id] },
      },
    },
    select: { id: true },
  });
  for (const m of framedMatches) {
    await scaffoldMatchFramesFromStructure(prisma, m.id);
  }

  // Round-31 — turn the COMPLETED competition into a full all-play-all
  // round-robin so the recap card has real depth (multiple matchdays, all
  // teams in standings, MVP derived from frames across the whole season).
  //
  // Approves Hai's Crew + Pool Sharks (in addition to Gen + Tigers) and
  // generates 3 matchdays of 2 matches each (4 teams → 6 matches). Each
  // match's frame results are picked deterministically per the score so
  // recomputeMvp produces stable "top scorer" lists.
  {
    await upsertApp(completed.id, haiCrew.id, "APPROVED");
    await upsertApp(completed.id, sharks.id, "APPROVED");

    // Drop everything we previously hand-rolled — start the round-robin
    // from a clean slate so re-seeds don't accumulate cruft.
    await prisma.match.deleteMany({
      where: { matchday: { competitionId: completed.id } },
    });
    await prisma.standing.deleteMany({
      where: { competitionId: completed.id },
    });
    await prisma.matchday.deleteMany({
      where: { competitionId: completed.id },
    });

    // Round-robin schedule for 4 teams across 3 matchdays.
    const teams = [genTeam, tigers, haiCrew, sharks];
    type Pair = [typeof genTeam, typeof genTeam];
    const rounds: Pair[][] = [
      // R1
      [
        [genTeam, tigers],
        [haiCrew, sharks],
      ],
      // R2
      [
        [genTeam, haiCrew],
        [tigers, sharks],
      ],
      // R3
      [
        [genTeam, sharks],
        [tigers, haiCrew],
      ],
    ];

    // Pre-defined scores keyed by `${homeIdx}-${awayIdx}` (team order in
    // `teams` above). Crafted so Hai's Crew finishes top, Gen second, and
    // every team plays 3 matches.
    const scores: Record<string, [number, number]> = {
      "0-1": [5, 3], // Gen 5-3 Tigers
      "2-3": [5, 2], // Hai 5-2 Sharks
      "0-2": [3, 5], // Gen 3-5 Hai
      "1-3": [5, 4], // Tigers 5-4 Sharks
      "0-3": [5, 1], // Gen 5-1 Sharks
      "1-2": [2, 5], // Tigers 2-5 Hai
    };

    let matchdayNumber = 0;
    for (const round of rounds) {
      matchdayNumber += 1;
      const matchday = await prisma.matchday.create({
        data: {
          competitionId: completed.id,
          number: matchdayNumber,
          label: `Week ${matchdayNumber}`,
          scheduledDate: new Date(`2026-10-${10 + matchdayNumber}`),
          isGenerated: true,
        },
      });
      for (const [home, away] of round) {
        const hi = teams.indexOf(home);
        const ai = teams.indexOf(away);
        const key = `${hi}-${ai}`;
        const [hs, as] = scores[key]!;
        const match = await prisma.match.create({
          data: {
            matchdayId: matchday.id,
            homeTeamId: home.id,
            awayTeamId: away.id,
            venueId: fillingStation.id,
            status: "COMPLETED",
            homeScore: hs,
            awayScore: as,
            scheduledAt: new Date(
              `2026-10-${10 + matchdayNumber}T19:00:00Z`,
            ),
            completedAt: new Date(
              `2026-10-${10 + matchdayNumber}T21:30:00Z`,
            ),
            completionMode: "AUTO_AGREED",
          },
        });
        // Create frames matching the score so recomputeMvp has data.
        const totalFrames = hs + as;
        const homeRoster = await prisma.teamMember.findMany({
          where: { teamId: home.id, isActive: true },
          select: { userId: true },
          take: 4,
        });
        const awayRoster = await prisma.teamMember.findMany({
          where: { teamId: away.id, isActive: true },
          select: { userId: true },
          take: 4,
        });
        for (let i = 0; i < totalFrames; i++) {
          const homeWon = i < hs;
          const hp = homeRoster[i % Math.max(1, homeRoster.length)]?.userId ?? null;
          const ap = awayRoster[i % Math.max(1, awayRoster.length)]?.userId ?? null;
          await prisma.matchFrame.create({
            data: {
              matchId: match.id,
              frameNumber: i + 1,
              homeWon,
              homePlayerId: hp,
              awayPlayerId: ap,
            },
          });
        }
      }
    }
  }

  // Round-31 — aggregate playerCompStat for the COMPLETED comp directly
  // from the frames we just created. recomputeMvp reads from this table,
  // so without this step the MVP flag would lag behind the actual play.
  {
    const frames = await prisma.matchFrame.findMany({
      where: {
        match: { matchday: { competitionId: completed.id }, status: "COMPLETED" },
        OR: [{ homePlayerId: { not: null } }, { awayPlayerId: { not: null } }],
      },
      select: {
        homePlayerId: true,
        awayPlayerId: true,
        homeWon: true,
        matchId: true,
      },
    });
    type Agg = {
      framesPlayed: number;
      framesWon: number;
      matches: Set<string>;
    };
    const tally = new Map<string, Agg>();
    function bump(userId: string, won: boolean, matchId: string) {
      const a = tally.get(userId) ?? {
        framesPlayed: 0,
        framesWon: 0,
        matches: new Set<string>(),
      };
      a.framesPlayed += 1;
      if (won) a.framesWon += 1;
      a.matches.add(matchId);
      tally.set(userId, a);
    }
    for (const f of frames) {
      if (f.homePlayerId) bump(f.homePlayerId, f.homeWon === true, f.matchId);
      if (f.awayPlayerId) bump(f.awayPlayerId, f.homeWon === false, f.matchId);
    }
    // Reset all stats for the completed comp before re-aggregating.
    await prisma.playerCompStat.deleteMany({
      where: { competitionId: completed.id },
    });
    for (const [userId, agg] of tally) {
      await prisma.playerCompStat.create({
        data: {
          competitionId: completed.id,
          userId,
          framesPlayed: agg.framesPlayed,
          framesWon: agg.framesWon,
          matchesPlayed: agg.matches.size,
          isMvp: false,
        },
      });
    }
  }

  // Round-18 — derive MVP from highest frames-won % on the COMPLETED comp.
  const { recomputeMvp, recomputeStandings } = await import(
    "../lib/services/standings.service"
  );
  // Now that the completed comp has a real round-robin, derive standings
  // from the actual matches instead of the hand-rolled placeholders.
  await recomputeStandings(prisma, completed.id);
  await recomputeMvp(prisma, completed.id);
  await recomputeMvp(prisma, ongoing.id);

  // Round-22 — backfill player ratings deterministically so /rankings has a
  // populated board on a fresh seed. Hash the username into [800, 1900] and
  // derive level from the rating (1000 → 3, 1500 → 8).
  const allPlayers = await prisma.user.findMany({
    where: { role: { in: ["PLAYER", "TEAM_CAPTAIN"] } },
    select: { id: true, username: true },
  });
  const { levelFromRating } = await import("../lib/services/rating.service");
  for (const u of allPlayers) {
    let h = 0;
    for (let i = 0; i < u.username.length; i++) {
      h = (h * 31 + u.username.charCodeAt(i)) | 0;
    }
    const rating = 800 + (Math.abs(h) % 1100); // 800–1899
    await prisma.user.update({
      where: { id: u.id },
      data: { rating, level: levelFromRating(rating) },
    });
  }

  // Round-41 — seed submittable score-submission fixtures on the ONGOING
  // competition so the audit/conflict/admin-override paths are testable
  // out of the box. We DO NOT pre-complete these — they're left in states
  // that exercise the dual-confirmation flow.
  const matches = await prisma.match.findMany({
    where: { matchday: { competitionId: ongoing.id }, status: "SCHEDULED" },
    include: {
      homeTeam: { select: { id: true, captainId: true, name: true } },
      awayTeam: { select: { id: true, captainId: true, name: true } },
    },
    take: 3,
  });
  // Match #1: leave clean (both captains can submit AUTO_AGREED in tests).
  // Match #2: one captain has already submitted → next test submitting a
  //           different score yields CONFLICT immediately.
  // Match #3: pre-create both captain submissions in CONFLICT so the
  //           organizer's review queue (/admin/score-submissions) loads
  //           with data.
  if (matches[1]?.homeTeam?.captainId && matches[1].homeTeamId) {
    await prisma.matchScoreSubmission.upsert({
      where: {
        matchId_submittedById: {
          matchId: matches[1].id,
          submittedById: matches[1].homeTeam.captainId,
        },
      },
      create: {
        matchId: matches[1].id,
        submittedById: matches[1].homeTeam.captainId,
        forTeamId: matches[1].homeTeamId,
        homeScore: 5,
        awayScore: 3,
        status: "PENDING",
        note: "We won on the deciding 8-ball.",
      },
      update: {},
    });
  }
  if (
    matches[2]?.homeTeam?.captainId &&
    matches[2]?.awayTeam?.captainId &&
    matches[2].homeTeamId &&
    matches[2].awayTeamId
  ) {
    await prisma.matchScoreSubmission.upsert({
      where: {
        matchId_submittedById: {
          matchId: matches[2].id,
          submittedById: matches[2].homeTeam.captainId,
        },
      },
      create: {
        matchId: matches[2].id,
        submittedById: matches[2].homeTeam.captainId,
        forTeamId: matches[2].homeTeamId,
        homeScore: 5,
        awayScore: 2,
        status: "CONFLICT",
        note: "Final frame called as our win.",
      },
      update: { status: "CONFLICT" },
    });
    await prisma.matchScoreSubmission.upsert({
      where: {
        matchId_submittedById: {
          matchId: matches[2].id,
          submittedById: matches[2].awayTeam.captainId,
        },
      },
      create: {
        matchId: matches[2].id,
        submittedById: matches[2].awayTeam.captainId,
        forTeamId: matches[2].awayTeamId,
        homeScore: 3,
        awayScore: 5,
        status: "CONFLICT",
        note: "Disputed — we sank the 8-ball legally.",
      },
      update: { status: "CONFLICT" },
    });
  }

  // Round-31 — community posts so the feed isn't empty.
  const da = allPlayers.slice(0, 4);
  if (da.length >= 2) {
    // Round-47 — every seeded community post is scoped to Da Nang so the
    // default header city filter (Da Nang) has content out of the box.
    await prisma.communityPost.createMany({
      data: [
        {
          authorId: da[0]!.id,
          cityId: daNang.id,
          body: "Anyone up for a #ladder this weekend? 🎱",
          tags: ["ladder"],
        },
        {
          authorId: da[1]!.id,
          cityId: daNang.id,
          body: "Big shoutout to @" + da[0]!.username + " for the clutch win.",
        },
        {
          authorId: da[0]!.id,
          cityId: daNang.id,
          body: "League standings looking spicy. Final stretch incoming.",
        },
      ],
      skipDuplicates: true,
    });
    // Backfill any older seeded posts that pre-date the cityId column.
    await prisma.communityPost.updateMany({
      where: { cityId: null },
      data: { cityId: daNang.id },
    });
  }

  // Round-31 — admin feedback rows in mixed statuses.
  if (allPlayers.length >= 2) {
    await prisma.feedback.createMany({
      data: [
        {
          userId: allPlayers[0]!.id,
          type: "BUG",
          subject: "Mobile bottom nav covers Post button",
          message:
            "On the community page the bottom nav overlays my Post button.",
          status: "NEW",
        },
        {
          userId: allPlayers[1]!.id,
          type: "FEATURE",
          subject: "Add doubles ladder mode",
          message:
            "Would love a doubles ladder option in addition to round-robin.",
          status: "REVIEWING",
        },
        {
          userId: allPlayers[0]!.id,
          type: "OTHER",
          subject: "Stripe payouts question",
          message: "When are prize payouts processed after a comp completes?",
          status: "RESOLVED",
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log("\n📍 Score-submission fixtures (Round 41):");
  if (matches[0]) {
    console.log(
      `   AUTO-AGREE candidate: /matches/${matches[0].id}  ` +
        `(both captains: @${(await prisma.user.findUnique({ where: { id: matches[0].homeTeam!.captainId } }))?.username}, ` +
        `@${(await prisma.user.findUnique({ where: { id: matches[0].awayTeam!.captainId } }))?.username})`,
    );
  }
  if (matches[1]) {
    console.log(
      `   CONFLICT candidate (home already submitted 5-3): /matches/${matches[1].id}  ` +
        `(submit a different score as @${(await prisma.user.findUnique({ where: { id: matches[1].awayTeam!.captainId } }))?.username})`,
    );
  }
  if (matches[2]) {
    console.log(
      `   CONFLICT (review queue): /matches/${matches[2].id}  → organize via @michael at /admin/score-submissions`,
    );
  }
  console.log("   Admin override fixture: same CONFLICT match — sign in as @toan (SUPER_ADMIN) and resolve.\n");

  console.log("seed: users=" + (await prisma.user.count()));
  console.log("seed: teams=" + (await prisma.team.count()));
  console.log("seed: members=" + (await prisma.teamMember.count()));
  console.log("seed: competitions=" + (await prisma.competition.count()));
  console.log(
    "seed: applications=" + (await prisma.competitionApplication.count()),
  );
  console.log("seed: matchdays=" + (await prisma.matchday.count()));
  console.log("seed: matches=" + (await prisma.match.count()));
  console.log("seed: standings=" + (await prisma.standing.count()));
  console.log("seed: notifications=" + (await prisma.notification.count()));
  console.log("seed: invitations=" + (await prisma.teamInvitation.count()));
  console.log(
    "seed: joinRequests=" + (await prisma.teamJoinRequest.count()),
  );
  console.log(
    "seed: scoreSubmissions=" +
      (await prisma.matchScoreSubmission.count()),
  );
}

async function upsertStanding(
  competitionId: string,
  teamId: string,
  s: {
    position: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    pointsFor: number;
    pointsAgainst: number;
    pointDiff: number;
    points: number;
  },
) {
  return prisma.standing.upsert({
    where: { competitionId_teamId: { competitionId, teamId } },
    update: s,
    create: { competitionId, teamId, ...s },
  });
}

async function upsertPlayerStat(
  competitionId: string,
  userId: string,
  s: {
    isMvp: boolean;
    matchesPlayed: number;
    framesWon: number;
    framesPlayed: number;
  },
) {
  return prisma.playerCompStat.upsert({
    where: { competitionId_userId: { competitionId, userId } },
    update: s,
    create: { competitionId, userId, ...s },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
