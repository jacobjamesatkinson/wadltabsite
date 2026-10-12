# Competition policies (defaults)

These defaults are stored on each competition as JSON (`competitions.config`) and can be overridden by administrators. They are not silent inventiveness — they are documented choices.

## Format

- **two_team** debating (affirmative vs negative)
- Configurable adjudicator **panel size** (default `1`)

## Ranking

1. Primary: **wins**
2. Default tiebreakers (in order):
   - `speaker_points`
   - `margin` (reserved; used when margins are tracked on ballots)
   - `team_name`

When `bye.countsAsWin` is `true`, bye counts are added to wins for ranking. **Default: `false`** — a bye does not automatically count as a win.

## Bye allocation

- Prefer **lowest-ranked** eligible teams when the bracket is odd
- Prefer teams with **zero prior byes**
- A second bye is allowed only when no alternative exists (or when an administrator authorises it)
- Reason is always recorded (`automatic` vs manual)

## Soft pairing preferences

Optimised where feasible; never violate hard constraints to satisfy them:

- Power-pair similar win records
- Avoid rematches
- Avoid same-institution matchups
- Minimise pull-ups between win brackets
- Balance side allocation when enabled (`sides.balanceFairness`)

## Hard constraints (never violated by auto-generation)

- No team debates itself
- No team double-booked in the same timeslot
- No room double-booked in the same timeslot
- No adjudicator double-booked in the same timeslot
- Debate must have valid participants for publication
- Publication blocked while any hard violation remains

## Student access

- Private URLs use unguessable tokens stored as SHA-256 hashes
- Links can be revoked and regenerated
- `canEditSpeakers` is independent of draw view access
- Speaker edits require confirmation in the UI

## Postponements

Requests are recorded with status history. They **never** automatically mutate a published draw.
