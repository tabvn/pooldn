import { builder } from "./builder";

// Types — order matters only insofar as enums must be registered before
// fields that reference them, which `./types/enums` handles.
import "./types/enums";
import "./types/user";
import "./types/geo";
import "./types/team";
import "./types/competition";
import "./types/match";
import "./types/standing";
import "./types/notification";
import "./types/structure";
import "./types/roster";
import "./types/score-submission";
import "./types/team-collab";
import "./types/security";

// Resolvers (split per domain).
import "./resolvers/viewer.queries";
import "./resolvers/user.queries";
import "./resolvers/user.mutations";
import "./resolvers/auth.mutations";
import "./resolvers/competition.queries";
import "./resolvers/competition.mutations";
import "./resolvers/league-import";
import "./resolvers/claim";
import "./resolvers/schedule-preview";
import "./resolvers/team.queries";
import "./resolvers/team.mutations";
import "./resolvers/match.queries";
import "./resolvers/match.mutations";
import "./resolvers/venue.queries";
import "./resolvers/venue.mutations";
import "./resolvers/notification.queries";
import "./resolvers/dashboard.queries";
import "./resolvers/viewer-relations";
import "./resolvers/roster.queries";
import "./resolvers/score-submission";
import "./resolvers/team-collab";
import "./resolvers/feedback";
import "./resolvers/notification-preferences";
import "./resolvers/subscriptions";
import "./resolvers/location.mutations";
import "./resolvers/admin-moderation";
import "./resolvers/security.queries";

export const schema = builder.toSchema();
