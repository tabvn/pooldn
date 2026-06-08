# PoolDN — Full Project Plan & Specification

> Pool (billiards) league & competition management platform.
> Generated from the PoolDN Figma design (MVP page).

## Tech Stack
- **Framework:** Next.js (App Router, RSC)
- **UI:** shadcn/ui, @base-ui/react, Tailwind CSS, TypeScript
- **ORM / DB:** Prisma + PostgreSQL
- **GraphQL Server:** graphql-yoga + @pothos/core + @pothos/plugin-prisma
- **GraphQL Client:** apollo client + @apollo/client-integration-nextjs
- **Codegen:** @graphql-codegen/cli (types & hooks from schema)
- **Forms:** react-hook-form (all forms) + zod (all validation)
- **Authorization:** CASL — @casl/ability, @casl/prisma, @casl/react
- **Local DB:** `postgresql://toan@localhost:5432/pooldn`

---

## 1. Product Overview

PoolDN manages the **full lifecycle of pool competitions**:

```
Create Competition
  -> Open for Applications  (teams apply)
  -> Applications Closed     (organizer approves roster)
  -> Ongoing                 (matchdays generated, results recorded)
  -> Completed               (winner, MVP, final standings)
```

Primary entities: **Users, Teams, Competitions, Applications, Matchdays, Matches, Frames, Standings, Venues, Notifications.**

Reference competition in design: **"Da Nang International Pool League"** — Round Robin / League, 10-ball, Teams, 5 teams, 5,000,000 VND prize.

---

## 2. User Roles & Permissions

| Role | Description |
|------|-------------|
| **SUPER_ADMIN** | Full platform control: all competitions, users, venues |
| **ORGANIZER** | Creates & manages own competitions, approves applications, manages matches |
| **TEAM_CAPTAIN** | Applies to competitions, manages team roster, records match results |
| **PLAYER** | Profile, joins teams, views competitions |
| **VIEWER** | Public read-only access |

### CASL Permission Matrix
| Subject | SUPER_ADMIN | ORGANIZER | TEAM_CAPTAIN | PLAYER | VIEWER |
|---------|-------------|-----------|--------------|--------|--------|
| Competition | CRUD all | CRUD own | Read | Read | Read |
| Application | CRUD all | Read/Update own comp | Create/Cancel own | Read | – |
| Team | CRUD all | Read | CRUD own | Read | Read |
| Match | CRUD all | CRUD own comp | Update result own | Read | Read |
| User | CRUD all | Read | Read | Update self | – |
| Venue | CRUD all | CRUD own | Read | Read | Read |

---

## 3. Screen-by-Screen Specification

### 3.0 App Shell (global layout)
**Sidebar (left):** logo "Pool DN" + Beta badge; nav **Poolhub, Teams, Venues, Community**; promo card "PoolDN Mobile App — Coming Soon"; footer **Suggest a Feature, Need Help?**
**Header (top):** location selector (e.g. "Da Nang, Vietnam"), notifications bell, user avatar + name dropdown (e.g. "Michael D.").
**Behavior:** sidebar active state highlights current section; header persists across all authenticated pages.

### 3.1 Authentication
**Login** — email + password, submit, link to register. zod: email valid, password min 8.
**Register** — name, username (unique), email, password, confirm. Default role PLAYER. zod on all fields.
> Account creation is performed by the user; OAuth/passwordless flows require explicit consent.

### 3.2 Poolhub (Dashboard / Competitions List)
- Grid/list of competition cards: banner, name, status badge, format, game type, dates, team count, prize.
- Filters: status (Open / Ongoing / Completed), city, game type.
- "Create Competition" CTA (ORGANIZER+). Card click -> competition detail.

### 3.3 Competition Creation Wizard (/competitions/new)
Multi-step form (react-hook-form + zod, parent holds state).

**Step 1 — Basics:** Name; Description (optional); Game Type (8/9/10-ball, Straight Pool); Type (Teams/Individual); Format (Round Robin / Single Elim / Double Elim / Swiss).

**Step 2 — Tournament Rules & Players:** Max/Min teams; Max/Min players per team; Race-to frames; "Are teams pre-built?" toggle (Pre-built / Solo players).

**Step 3 — Scheduling:** Scheduling Type (Fixed Date / Flexible / Auto-generated); Start date, End date, time windows; Save Schedule Settings.

**Step 4 — Prize & Scoring:** Prize pool + currency (default VND); Prize distribution (1st/2nd/3rd %); Points Win/Draw/Loss (default 3/1/0); Competition Start Date; **Create Competition** -> status DRAFT.

> Inline design note: after creating you still publish / open applications / invite teams.

### 3.4 Competition Detail — Tabbed Page (/competitions/[slug])
Header: name, status badge (Active/Completed), format chips (Round Robin / League, 10-ball), date range, team count, prize. Tabs: **Overview · Matchdays · Players · About**.

**Overview:** Winner team card (logo + "Winner!") + MVP player card; **League Standings** table columns `#, Team, P, W, D, L, PF, PD, Pts`. Legend: P=Played, W=Won, D=Drawn, L=Lost, PF=Points For, PA=Points Against, PD=Point Difference, Pts=Points. Leader row highlighted.

**Matchdays:** list of matchdays (1,2,3…) with date/time; each shows its matches (home vs away). Organizer: **Generate Matchdays** + "New Matchday". Empty state: "Season Calendar".

**Players:** Player MVP ranking table — Appearances, Singles, Doubles, Total, MVP; frames won/played; sortable; MVP badge on top player.

**About (Competition Details):** read-only panels — Competition Details (Name, Organizer, Description, Type, Format, Game Type, Start Date, Prize); Participants (Application deadline, Min teams, Teams per match); Schedule (When played, Games per opponent, Scheduling type, Matchdays); Structure (Match layout, Max frames per match, Race-to value).

### 3.5 Applications (Pre-Start) — /competitions/[slug]/applications
Organizer view. Sections: **Confirmed Teams** (Team, Captain, Home Venue, Roster status); **Applied/Pending** (Team, Captain, Home Venue, Media + Approve/Reject); **Invited** (with Invite More). Each row: avatar, team flag, status chip.

### 3.6 Matchday Generation (Pre-Start)
- "Season Calendar" empty state + explanation; **Generate Applications / Season** action; after generation matchdays list populated with auto-paired matches.

### 3.7 Team Captain Application Flow
**Public View — Apply as a Team:** competition page shows **Apply** button; "Ready to Compete?" CTA opens form.
**Apply form:** Team selector; Home Venue selector; Select Roster (checkbox list, primary + substitutes); optional invite player/register; **Submit Application**.
**Preview Application:** read-only roster summary before final submit; note: if captain didn't select roster it auto-sets; **Submit Application** confirm.

### 3.8 Match Flow — Captain View
- Captain sees assigned matches (Scheduled / In Progress).
- **Record Frame Results:** frame-by-frame input (frame number, home/away winner, player). Running score (home vs away frames).
- **Submit Result** -> match COMPLETED -> triggers standings recalculation.
- States: Scheduled -> In Progress -> Completed (also Cancelled / Postponed).

### 3.9 Competition Complete — Results
- Status badge **Completed**; Winner banner + MVP; final **League Standings** table; historical read-only access.

### 3.10 Teams
- Directory: searchable team cards (logo, name, captain, member count). Detail (/teams/[slug]): roster (members + roles), past/current competitions, captain controls (add/remove members, edit team).

### 3.11 Venues
- List filtered by city: name, address, table count, image. Detail (/venues/[id]): full info, matches hosted.

### 3.12 Community
- Feed/discussion placeholder (feature suggestions, news). MVP: simple list.

### 3.13 Notifications
- Triggered on: application approved/rejected, match scheduled, result recorded. Bell dropdown + unread badge; mark-as-read.

---

## 4. Prisma Schema (PostgreSQL)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum UserRole { SUPER_ADMIN ORGANIZER TEAM_CAPTAIN PLAYER VIEWER }
enum CompetitionStatus { DRAFT OPEN_FOR_APPLICATIONS APPLICATIONS_CLOSED ONGOING COMPLETED CANCELLED }
enum CompetitionFormat { ROUND_ROBIN SINGLE_ELIMINATION DOUBLE_ELIMINATION SWISS }
enum CompetitionType { TEAMS INDIVIDUAL }
enum GameType { EIGHT_BALL NINE_BALL TEN_BALL STRAIGHT_POOL }
enum ApplicationStatus { PENDING APPROVED REJECTED CANCELLED WAITLISTED }
enum MatchStatus { SCHEDULED IN_PROGRESS COMPLETED CANCELLED POSTPONED }
enum SchedulingType { FIXED_DATE FLEXIBLE AUTO_GENERATED }

model User {
  id String @id @default(cuid())
  email String @unique
  name String
  username String @unique
  passwordHash String
  avatarUrl String?
  bio String?
  phone String?
  nationality String?
  cityId String?
  city City? @relation(fields: [cityId], references: [id])
  role UserRole @default(PLAYER)
  emailVerified Boolean @default(false)
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  organizedCompetitions Competition[] @relation("OrganizedBy")
  teamMemberships TeamMember[]
  captainedTeams Team[] @relation("CaptainedBy")
  playerStats PlayerCompStat[]
  matchParticipations MatchParticipant[]
  notifications Notification[]
  sessions Session[]
  @@map("users")
}

model Session {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  token String @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@map("sessions")
}

model Country {
  id String @id @default(cuid())
  code String @unique
  name String
  cities City[]
  @@map("countries")
}

model City {
  id String @id @default(cuid())
  name String
  countryId String
  country Country @relation(fields: [countryId], references: [id])
  users User[]
  venues Venue[]
  competitions Competition[]
  @@map("cities")
}

model Venue {
  id String @id @default(cuid())
  name String
  address String
  cityId String
  city City @relation(fields: [cityId], references: [id])
  phone String?
  email String?
  website String?
  imageUrl String?
  tableCount Int?
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  matches Match[]
  @@map("venues")
}

model Team {
  id String @id @default(cuid())
  name String
  slug String @unique
  logoUrl String?
  description String?
  captainId String
  captain User @relation("CaptainedBy", fields: [captainId], references: [id])
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  members TeamMember[]
  applications CompetitionApplication[]
  homeMatches Match[] @relation("HomeTeam")
  awayMatches Match[] @relation("AwayTeam")
  standings Standing[]
  @@map("teams")
}

model TeamMember {
  id String @id @default(cuid())
  teamId String
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  userId String
  user User @relation(fields: [userId], references: [id])
  joinedAt DateTime @default(now())
  isActive Boolean @default(true)
  @@unique([teamId, userId])
  @@map("team_members")
}

model Competition {
  id String @id @default(cuid())
  slug String @unique
  name String
  description String?
  bannerUrl String?
  organizerId String
  organizer User @relation("OrganizedBy", fields: [organizerId], references: [id])
  cityId String?
  city City? @relation(fields: [cityId], references: [id])
  status CompetitionStatus @default(DRAFT)
  type CompetitionType @default(TEAMS)
  format CompetitionFormat @default(ROUND_ROBIN)
  gameType GameType @default(EIGHT_BALL)
  maxTeams Int?
  minTeams Int @default(2)
  maxPlayersPerTeam Int?
  minPlayersPerTeam Int @default(1)
  raceToFrames Int @default(5)
  framesPerMatchday Int?
  applicationDeadline DateTime?
  startDate DateTime?
  endDate DateTime?
  schedulingType SchedulingType @default(FLEXIBLE)
  prizePool Decimal? @db.Decimal(18,2)
  currency String @default("VND")
  prizeDistribution Json?
  pointsWin Int @default(3)
  pointsDraw Int @default(1)
  pointsLoss Int @default(0)
  isPublic Boolean @default(true)
  rulesUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  applications CompetitionApplication[]
  matchdays Matchday[]
  standings Standing[]
  playerStats PlayerCompStat[]
  @@map("competitions")
}

model CompetitionApplication {
  id String @id @default(cuid())
  competitionId String
  competition Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  teamId String
  team Team @relation(fields: [teamId], references: [id])
  status ApplicationStatus @default(PENDING)
  message String?
  reviewNote String?
  reviewedAt DateTime?
  submittedAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  applicationPlayers ApplicationPlayer[]
  @@unique([competitionId, teamId])
  @@map("competition_applications")
}

model ApplicationPlayer {
  id String @id @default(cuid())
  applicationId String
  application CompetitionApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  userId String
  name String
  role String?
  createdAt DateTime @default(now())
  @@map("application_players")
}

model Matchday {
  id String @id @default(cuid())
  competitionId String
  competition Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  number Int
  label String?
  scheduledDate DateTime?
  startTime String?
  endTime String?
  isGenerated Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  matches Match[]
  @@unique([competitionId, number])
  @@map("matchdays")
}

model Match {
  id String @id @default(cuid())
  matchdayId String
  matchday Matchday @relation(fields: [matchdayId], references: [id], onDelete: Cascade)
  venueId String?
  venue Venue? @relation(fields: [venueId], references: [id])
  homeTeamId String?
  homeTeam Team? @relation("HomeTeam", fields: [homeTeamId], references: [id])
  awayTeamId String?
  awayTeam Team? @relation("AwayTeam", fields: [awayTeamId], references: [id])
  status MatchStatus @default(SCHEDULED)
  scheduledAt DateTime?
  startedAt DateTime?
  completedAt DateTime?
  homeScore Int?
  awayScore Int?
  notes String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  frames MatchFrame[]
  participants MatchParticipant[]
  @@map("matches")
}

model MatchFrame {
  id String @id @default(cuid())
  matchId String
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
  frameNumber Int
  homeWon Boolean?
  homePlayer String?
  awayPlayer String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([matchId, frameNumber])
  @@map("match_frames")
}

model MatchParticipant {
  id String @id @default(cuid())
  matchId String
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
  userId String
  user User @relation(fields: [userId], references: [id])
  teamId String?
  framesWon Int @default(0)
  framesPlayed Int @default(0)
  createdAt DateTime @default(now())
  @@unique([matchId, userId])
  @@map("match_participants")
}

model Standing {
  id String @id @default(cuid())
  competitionId String
  competition Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  teamId String
  team Team @relation(fields: [teamId], references: [id])
  position Int?
  played Int @default(0)
  won Int @default(0)
  drawn Int @default(0)
  lost Int @default(0)
  pointsFor Int @default(0)
  pointsAgainst Int @default(0)
  pointDiff Int @default(0)
  points Int @default(0)
  updatedAt DateTime @updatedAt
  @@unique([competitionId, teamId])
  @@map("standings")
}

model PlayerCompStat {
  id String @id @default(cuid())
  competitionId String
  competition Competition @relation(fields: [competitionId], references: [id], onDelete: Cascade)
  userId String
  user User @relation(fields: [userId], references: [id])
  matchesPlayed Int @default(0)
  framesWon Int @default(0)
  framesPlayed Int @default(0)
  isMvp Boolean @default(false)
  @@unique([competitionId, userId])
  @@map("player_comp_stats")
}

model Notification {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  type String
  title String
  message String
  isRead Boolean @default(false)
  metadata Json?
  createdAt DateTime @default(now())
  @@map("notifications")
}
```

---

## 5. Project Structure

```
pooldn/
  prisma/ schema.prisma seed.ts migrations/
  src/
    app/
      layout.tsx
      (auth)/ login/ register/
      (app)/
        layout.tsx              # Sidebar + Header shell
        poolhub/page.tsx
        teams/ page.tsx [slug]/page.tsx
        venues/ page.tsx [id]/page.tsx
        community/page.tsx
        competitions/
          new/page.tsx          # creation wizard
          [slug]/
            layout.tsx          # header + tabs
            page.tsx
            applications/page.tsx
            matchdays/page.tsx [matchdayId]/page.tsx
            players/page.tsx
            about/page.tsx
            results/page.tsx
      api/graphql/route.ts       # graphql-yoga
    graphql/ builder.ts schema.ts types/ queries/ mutations/
    lib/ prisma.ts apollo-client.ts apollo-rsc-client.ts auth.ts
    casl/ ability.ts rules/ prisma-plugin.ts
    components/ ui/ layout/ competition/ match/ team/ player/
    hooks/ use-ability.ts use-current-user.ts
    generated/ graphql.ts
  codegen.ts .env package.json
```

---

## 6. GraphQL API Surface

**Queries:** me, competition(slug), competitions(filters), team(slug), teams, venues, matchday(id), notifications.

**Mutations:**
- Auth: login, register, logout
- Competition: createCompetition, updateCompetition, publishCompetition, closeApplications, startCompetition, completeCompetition, generateMatchdays
- Application: applyToCompetition, reviewApplication
- Match: recordMatchResult, updateMatchFrame
- Team: createTeam, updateTeam, addTeamMember, removeTeamMember

All resolvers use @pothos/plugin-prisma (prismaObject / prismaField) to avoid N+1. Authorization enforced via @casl/prisma accessibleBy(ability, action) injected into Prisma where.

---

## 7. CASL Ability Factory (sketch)

```ts
export function defineAbilityFor(user) {
  const { can, build } = new AbilityBuilder(PureAbility);
  if (user.role === "SUPER_ADMIN") can("manage", "all");
  if (user.role === "ORGANIZER") {
    can("manage", "Competition", { organizerId: user.id });
    can("manage", "Matchday", { competition: { organizerId: user.id } });
    can("manage", "Match", { matchday: { competition: { organizerId: user.id } } });
    can(["read","update"], "CompetitionApplication", { competition: { organizerId: user.id } });
  }
  if (user.role === "TEAM_CAPTAIN") {
    can("read", "Competition");
    can("create", "CompetitionApplication");
    can("cancel", "CompetitionApplication", { team: { captainId: user.id } });
    can("manage", "Team", { captainId: user.id });
    can("update", "Match", { OR: [
      { homeTeam: { captainId: user.id } },
      { awayTeam: { captainId: user.id } },
    ]});
  }
  if (user.role === "PLAYER") {
    can("read", ["Competition","Team"]);
    can("update", "User", { id: user.id });
  }
  can("read", "Competition", { isPublic: true });
  can("read", ["Team","Venue"]);
  return build();
}
```

---

## 8. Environment & Codegen

```bash
# .env
DATABASE_URL="postgresql://toan@localhost:5432/pooldn"
NEXTAUTH_SECRET="..."
NEXT_PUBLIC_GRAPHQL_URL="http://localhost:3000/api/graphql"
```

```ts
// codegen.ts
const config = {
  schema: "http://localhost:3000/api/graphql",
  documents: ["src/**/*.{ts,tsx,graphql}"],
  generates: { "src/generated/graphql.ts": {
    plugins: ["typescript","typescript-operations","typescript-react-apollo"],
    config: { withHooks: true, scalars: { DateTime: "string", Decimal: "string", JSON: "Record<string,unknown>" } }
  }},
};
export default config;
```

---

## 9. MVP Feature Checklist
- [ ] Auth: register / login / logout / session / roles
- [ ] User profile view & edit
- [ ] Poolhub dashboard + filters
- [ ] Competition creation wizard (4 steps)
- [ ] Competition lifecycle transitions (publish/close/start/complete)
- [ ] Competition tabs: Overview / Matchdays / Players / About
- [ ] Applications: apply / preview / approve / reject / invite
- [ ] Matchday generation + manual creation
- [ ] Match flow (captain) record frames + submit
- [ ] Standings auto-calculation (P/W/D/L/PF/PA/PD/Pts)
- [ ] Player MVP ranking
- [ ] Competition complete: winner + MVP + final table
- [ ] Teams directory + team detail + roster management
- [ ] Venues list + detail
- [ ] Community feed (basic)
- [ ] Notifications

---

## 10. Implementation Notes
- **Apollo + Yoga:** api/graphql/route.ts wraps the Pothos schema with graphql-yoga; client uses @apollo/client-integration-nextjs (ApolloNextAppProvider) for RSC.
- **Forms:** every form = react-hook-form + zod resolver, co-located schema; wizard shares state via FormProvider.
- **CASL + Prisma:** filter at DB level with accessibleBy to avoid leaking unauthorized rows.
- **Theme (Tailwind tokens):** dark UI — Mist (neutral), Primary (lime/yellow-green), Pink (accent), Teal (secondary), Amber (warning), Sky, Purple. Map to CSS variables for shadcn.
- **Codegen:** run graphql-codegen --watch; always use generated hooks (useCompetitionQuery, useRecordMatchResultMutation).
- **Standings recalculation:** run inside a Prisma transaction whenever a match is set to COMPLETED.
