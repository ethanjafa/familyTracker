# Dragon Boat: Family in Sync

<img src="assets/brand/logo-preview.png" width="128" alt="Dragon Boat logo">

Routines, projects and scorecards for the whole family, built with Expo (React Native) and Supabase.

- **Routines**: category → routine (e.g. *House cleanliness → Wash dishes*), with flexible schedules, a time of day, importance, and who's responsible. Family members can take turns by weekday (e.g. *Pick up baby*: Mon → one parent, Tue → the other), and the app suggests common categories and routines.
- **Projects**: project → steps (e.g. *Renovation → Laminate change*), with status, owner, due date, cost and budget.
- **Personal vs family**: personal items are visible only to you (enforced by Row Level Security); family items are shared with everyone in the household.
- **Scorecards**: weekly and monthly scores per person or for the family, an 8-week trend, per-category breakdown, streaks, who did what, and rule-based feedback.
- **Live sync**: changes appear on every family member's phone through Supabase Realtime.

## 1. Create the Supabase backend (one time)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor** and run each file in [supabase/migrations/](supabase/migrations/), oldest first:
   - [20261023000000_init.sql](supabase/migrations/20261023000000_init.sql): tables and security policies
   - [20261024000000_day_assignees.sql](supabase/migrations/20261024000000_day_assignees.sql): taking turns by day
3. Go to **Authentication → URL Configuration → Redirect URLs** and add:
   - `exp://**` (Expo Go during development)
   - `tracker://**` (installed builds)
4. Go to **Authentication → Sign In / Providers** and enable:
   - **Google**: in Google Cloud Console, create an OAuth client of type *Web application*. Add the callback URL that Supabase shows (`https://<ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI. Then paste the client ID and secret into Supabase.
   - **Apple**: needs an Apple Developer account. Create a *Services ID* and a *Sign in with Apple* key, then follow Supabase's "Login with Apple" guide for the web/OAuth flow.
5. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API** (the project URL and the publishable key).

## 2. Run it on your phones

```bash
npm install
npx expo start
```

Install **Expo Go** from the App Store or Play Store and scan the QR code (on iPhone, use the Camera app). Both phones need to be on the same Wi-Fi as your PC. Otherwise run `npx expo start --tunnel`.

The first person signs in, creates the household, and on the **Family** tab taps **Invite a family member** to share a 6-character code. The second person signs in and chooses **Join with code**.

> **Corporate network:** this machine has `NODE_OPTIONS=--use-system-ca` set so npm trusts the Windows certificate store.

## Project layout

```
src/app/                 screens (Expo Router)
  (tabs)/(today)         Today: what's due, one tap to check off
  (tabs)/routines        categories → routines
  (tabs)/projects        projects → steps
  (tabs)/scorecard       scores, trends, feedback
  (tabs)/family          members, invites, profile
  *-form.tsx             create/edit modals
src/api/                 Supabase queries and mutations (TanStack Query)
src/lib/schedule.ts      when a routine is due
src/lib/scoring.ts       weighted completion scores and streaks
src/lib/insights.ts      feedback rules
src/hooks/use-realtime-sync.ts   live updates between family members
supabase/migrations/     database schema and security policies
```

## Scoring rules

- Score = weighted check-ins ÷ weighted expected check-ins. The weights are *Nice to have* = 1, *Normal* = 2, *Must do* = 3.
- **Done** counts 1, **Partly done** counts 0.5. **Skip** is excused and doesn't count either way.
- Today only counts once it's logged, so an unfinished day never lowers your score.
- Weekly and monthly targets (e.g. "3× a week") are prorated over the days that have passed.
- Your personal score covers your personal routines plus family routines assigned to you. The family score covers all family routines.

## Commands

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency health check
```

## Roadmap

- **Phase 5**: reminders (push notifications), a weekly family review ritual, chore rotation, kudos, vacation pauses, grace days for streaks.
- **Phase 6**: native Google/Apple sign-in buttons and store builds with EAS (`npx eas-cli@latest build`).
