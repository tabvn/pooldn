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
import "./types/community";
import "./types/structure";
import "./types/roster";
import "./types/score-submission";
import "./types/team-collab";
import "./types/search";
import "./types/security";

// Resolvers (split per domain).
import "./resolvers/viewer.queries";
import "./resolvers/user.queries";
import "./resolvers/user.mutations";
import "./resolvers/auth.mutations";
import "./resolvers/competition.queries";
import "./resolvers/competition.mutations";
import "./resolvers/team.queries";
import "./resolvers/team.mutations";
import "./resolvers/match.queries";
import "./resolvers/match.mutations";
import "./resolvers/venue.queries";
import "./resolvers/venue.mutations";
import "./resolvers/notification.queries";
import "./resolvers/community";
import "./resolvers/dashboard.queries";
import "./resolvers/follow";
import "./resolvers/roster.queries";
import "./resolvers/score-submission";
import "./resolvers/team-collab";
import "./resolvers/feedback";
import "./resolvers/search";
import "./resolvers/community-moderation";
import "./resolvers/notification-preferences";
import "./resolvers/subscriptions";
import "./resolvers/location.mutations";
import "./resolvers/admin-moderation";
import "./resolvers/security.queries";

export const schema = builder.toSchema();
