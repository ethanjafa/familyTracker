# WhoseTurn: who does what in your family this week

<img src="assets/brand/logo-preview.png" width="128" alt="WhoseTurn logo">

Routines, to-dos, meals and scorecards for the whole family, built with Expo (React Native) and Supabase.

- **Routines**: category → routine (e.g. *House cleanliness → Wash dishes*), every day, on certain days, N times a week or N times every 2 weeks, with owners. Optional default days can have a different owner per day (e.g. *Pick up baby*: Mon → one parent, Tue → the other), and the app suggests common categories and routines.
- **To do**: categories of to-dos (e.g. *Home repairs → Fix the tap*), each with an owner and a target date.
- **Personal items**: tag any routine or to-do 🔒 Personal and only you can see it (enforced by Row Level Security); it's automatically yours. Everything else is shared with the household.
- **Scorecards**: weekly and monthly scores per person or for the family, an 8-week trend, per-category breakdown, streaks, who did what, and rule-based feedback.
- **Assign** (was Plan): one table for this week or next. Rows are family routines, who makes lunch and cooks dinner, and to-dos; tap a box to change who's responsible (changes apply to that week only). Rows that still need someone are marked ⚠️. **Plan next week** checks off the family's weekly planning task. **Meals** picks lunches and dinners from a meal backlog (or 🎡 spin); **Groceries** is one household list where each item is **Need**, **Have** or **Backlog**, filled automatically from planned meals, with a **Store mode** for shopping.
- **Live sync**: changes appear on every family member's phone through Supabase Realtime.

## 1. Create the Supabase backend (one time)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor** and run each file in [supabase/migrations/](supabase/migrations/), oldest first:
   - [20261023000000_init.sql](supabase/migrations/20261023000000_init.sql): tables and security policies
   - [20261024000000_day_assignees.sql](supabase/migrations/20261024000000_day_assignees.sql): taking turns by day
   - [20261025000000_remove_member.sql](supabase/migrations/20261025000000_remove_member.sql): removing family members
   - [20261026000000_planning.sql](supabase/migrations/20261026000000_planning.sql): weekly planning, meals and groceries
   - [20261027000000_planning_day.sql](supabase/migrations/20261027000000_planning_day.sql): the family's planning day and its weekly task
   - [20261028000000_dinner_cooks.sql](supabase/migrations/20261028000000_dinner_cooks.sql): a cook for a day before its meal is chosen
   - [20261029000000_lunch.sql](supabase/migrations/20261029000000_lunch.sql): lunch as well as dinner in meal planning
   - [20261030000000_grocery_backlog.sql](supabase/migrations/20261030000000_grocery_backlog.sql): a backlog list in groceries
   - [20261031000000_private_items.sql](supabase/migrations/20261031000000_private_items.sql): 🔒 personal routines and to-dos, hidden from the rest of the family
   - [20261101000000_delete_account.sql](supabase/migrations/20261101000000_delete_account.sql): deleting your account from Settings (required by the app stores)
   - [20261102000000_switch_household.sql](supabase/migrations/20261102000000_switch_household.sql): joining another family from Settings
3. Go to **Authentication → URL Configuration → Redirect URLs** and add:
   - `exp://**` (Expo Go during development)
   - `whoseturn://**` (installed builds)
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

The first person signs in, creates the household, and on the **Settings** tab taps **Invite a family member** to share a 6-character code. The second person signs in and chooses **Join with code**.

> **Corporate network:** this machine has `NODE_OPTIONS=--use-system-ca` set so npm trusts the Windows certificate store.

## Project layout

```
src/app/                 screens (Expo Router)
  (tabs)/(today)         Today: what's due, one tap to check off
  (tabs)/plan            Assign: the week table: who does each routine, meal and to-do
  (tabs)/goals           Routines: routines (categories → routines) and to-dos (categories → to-dos)
  (tabs)/scorecard       Track: scores, trends, feedback
  (tabs)/settings        family members (invite/remove), profile
  *-form.tsx             create/edit modals
src/api/                 Supabase queries and mutations (TanStack Query)
src/lib/schedule.ts      when a routine is due
src/lib/scoring.ts       weighted completion scores and streaks
src/lib/insights.ts      feedback rules
src/hooks/use-realtime-sync.ts   live updates between family members
supabase/migrations/     database schema and security policies
```

## Scoring rules

- Score = check-ins ÷ expected check-ins. Every routine counts the same, and a routine is either done or not.
- Today only counts once it's logged, so an unfinished day never lowers your score.
- Times-a-week and times-every-2-weeks targets (e.g. "3× a week") are prorated over the days that have passed.
- Your personal score covers your personal routines plus family routines assigned to you. The family score covers all family routines.

## Shipping updates

- **Most changes** (screens, logic, text) go out over the air with EAS Update, with no store review. Installed apps pick them up the next time they open:
  ```bash
  npx eas-cli@latest update --channel production --environment production --message "What changed"
  ```
  Use `--channel preview --environment preview` for test builds.
- **Native changes** (new native modules, icon, name, permissions, Expo upgrades) need a new store build: `npx eas-cli@latest build --profile production`, then `npx eas-cli@latest submit`. The runtime version uses Expo's *fingerprint* policy, so updates only reach builds they're compatible with.

## Commands

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency health check
```

## Roadmap

- **Phase 5**: reminders (push notifications), a weekly family review ritual, chore rotation, kudos, vacation pauses, grace days for streaks.
- **Phase 6**: native Google/Apple sign-in buttons and store builds with EAS (`npx eas-cli@latest build`).
