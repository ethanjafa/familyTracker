// WhoseTurn for AI assistants (MCP): people connect Claude, ChatGPT and the like to their account
// and say "add book the dentist to my to-dos". Everything runs as the signed-in person, so the
// app's row-level security applies: they only reach their own family, and 🔒 personal items
// stay theirs. Changes show up in the app straight away through its realtime sync.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { pipeline } from '@supabase/middleware';
import { withOAuthProtectedResource, withSupabase } from '@supabase/server';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'zod';

import {
  addDays,
  asMealRoutine,
  cookPlan,
  DAY_NAMES,
  describeSchedule,
  mealSlotOf,
  onDay,
  type Plan,
  type Routine,
  type Schedule,
  weekday,
  weekStart,
} from './schedule.ts';

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] });

type Member = { user_id: string; name: string };

/** The signed-in person's family and its members. */
async function family(supabase: SupabaseClient, me: string) {
  const { data: mine, error } = await supabase
    .from('household_members')
    // `*` so this keeps working whether or not newer columns (the meal routines) exist yet.
    .select('household_id, households(*)')
    .eq('user_id', me)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!mine) throw new Error('You are not in a family yet. Open the WhoseTurn app to create or join one.');
  const { data: rows, error: e } = await supabase
    .from('household_members')
    .select('user_id, profiles(display_name)')
    .eq('household_id', mine.household_id);
  if (e) throw new Error(e.message);
  const members: Member[] = (rows ?? []).map((r: any) => ({ user_id: r.user_id, name: r.profiles?.display_name ?? '' }));
  const household = (mine as any).households ?? {};
  return {
    id: mine.household_id as string,
    name: household.name as string,
    members,
    // The "Make lunch" and "Cook dinner" routines: on the days the meal plan has a cook.
    lunch_routine_id: (household.lunch_routine_id ?? null) as string | null,
    dinner_routine_id: (household.dinner_routine_id ?? null) as string | null,
  };
}

const nameOf = (members: Member[], id: string | null) => members.find((m) => m.user_id === id)?.name ?? null;

/** The family's routines that aren't archived, with their category name. */
async function activeRoutines(supabase: SupabaseClient, householdId: string) {
  const { data, error } = await supabase
    .from('routines')
    .select('id, name, schedule, assignee_ids, day_assignees, start_date, private_to, routine_categories(name)')
    .eq('household_id', householdId)
    .is('archived_at', null)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ ...(r as Routine), category: r.routine_categories?.name ?? null }));
}

/** Changes made on the Assign tab between two days, keyed "routineId|day". */
async function plansBetween(supabase: SupabaseClient, householdId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('routine_plans')
    .select('routine_id, plan_date, planned, assignee_id')
    .eq('household_id', householdId)
    .gte('plan_date', from)
    .lte('plan_date', to);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p: any) => [`${p.routine_id}|${p.plan_date}`, p as Plan]));
}

/** Lunch and dinner between two days: the cook and the meal, keyed "slot|day". */
async function mealsBetween(supabase: SupabaseClient, householdId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('meal_plans')
    .select('plan_date, slot, cook_id, meals(name)')
    .eq('household_id', householdId)
    .gte('plan_date', from)
    .lte('plan_date', to);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((p: any) => [
      `${p.slot}|${p.plan_date}`,
      { cook_id: p.cook_id as string | null, meal: (p.meals?.name ?? null) as string | null },
    ]),
  );
}

/** "me", a first name or a full name → a member's id. */
function findMember(members: Member[], me: string, who: string) {
  const q = who.trim().toLowerCase();
  if (['me', 'myself', 'i'].includes(q)) return me;
  const match =
    members.find((m) => m.name.toLowerCase() === q) ?? members.find((m) => m.name.toLowerCase().startsWith(q));
  if (!match) throw new Error(`No one called "${who}" in this family. Members: ${members.map((m) => m.name).join(', ')}`);
  return match.user_id;
}

Deno.serve(
  pipeline([withOAuthProtectedResource(), withSupabase({ auth: 'user' })], async (req, { supabase, jwtClaims }) => {
    const me = jwtClaims?.sub as string;
    // Edge Functions are stateless, so each request gets its own server.
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'whoseturn', version: '0.1.0' });

      server.registerTool(
        'get_family',
        {
          description: 'The signed-in person’s WhoseTurn family: its name and members (use these names for owners).',
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        },
        async () => {
          const f = await family(supabase, me);
          return text({ family: f.name, members: f.members.map((m) => ({ name: m.name, is_me: m.user_id === me })) });
        },
      );

      server.registerTool(
        'list_todos',
        {
          description:
            'List the family’s to-dos (one-off tasks). Open ones by default. due_date is YYYY-MM-DD, or null for the backlog.',
          inputSchema: z.object({ include_done: z.boolean().default(false) }),
          annotations: { readOnlyHint: true },
        },
        async ({ include_done }) => {
          const f = await family(supabase, me);
          let q = supabase
            .from('project_items')
            .select('id, title, status, due_date, assignee_id, private_to, projects(name)')
            .eq('household_id', f.id)
            .order('due_date', { nullsFirst: false })
            .limit(200);
          if (!include_done) q = q.neq('status', 'done');
          const { data, error } = await q;
          if (error) throw new Error(error.message);
          const name = (id: string | null) => f.members.find((m) => m.user_id === id)?.name ?? null;
          return text(
            (data ?? []).map((t: any) => ({
              id: t.id,
              title: t.title,
              done: t.status === 'done',
              due_date: t.due_date,
              owner: name(t.assignee_id),
              personal: !!t.private_to,
              category: t.projects?.name ?? null,
            })),
          );
        },
      );

      server.registerTool(
        'add_todo',
        {
          description:
            'Add a to-do to WhoseTurn. due_date is the day it should be done (YYYY-MM-DD, in the person’s local time); leave it out to put it in the backlog. owner is a family member’s name or "me"; leave it out for no owner. personal: true hides it from the rest of the family (it is then always the person’s own). category is an existing to-do category name; a new one is created if it doesn’t exist.',
          inputSchema: z.object({
            title: z.string().min(1).max(200),
            due_date: DATE.optional(),
            owner: z.string().optional(),
            personal: z.boolean().default(false),
            category: z.string().max(60).optional(),
          }),
        },
        async ({ title, due_date, owner, personal, category }) => {
          const f = await family(supabase, me);
          const assignee = personal ? me : owner ? findMember(f.members, me, owner) : null;

          const { data: cats, error: ce } = await supabase
            .from('projects')
            .select('id, name, visibility')
            .eq('household_id', f.id)
            .order('created_at');
          if (ce) throw new Error(ce.message);
          const wanted = category?.trim().toLowerCase();
          let cat = wanted
            ? cats?.find((c) => c.name.toLowerCase() === wanted)
            : cats?.find((c) => c.visibility === 'family') ?? cats?.[0];
          if (!cat) {
            const { data, error } = await supabase
              .from('projects')
              .insert({ household_id: f.id, name: category?.trim() || 'To do', icon: '📝', visibility: 'family' })
              .select('id, name, visibility')
              .single();
            if (error) throw new Error(error.message);
            cat = data;
          }

          const { data, error } = await supabase
            .from('project_items')
            .insert({
              household_id: f.id,
              project_id: cat!.id,
              title: title.trim(),
              due_date: due_date ?? null,
              assignee_id: assignee,
              private_to: personal ? me : null,
            })
            .select('id, title, due_date')
            .single();
          if (error) throw new Error(error.message);
          return text({ added: data, category: cat!.name, owner: f.members.find((m) => m.user_id === assignee)?.name ?? null });
        },
      );

      server.registerTool(
        'complete_todo',
        {
          description: 'Mark a to-do as done (or not done again). Get its id from list_todos.',
          inputSchema: z.object({ id: z.string().uuid(), done: z.boolean().default(true) }),
          annotations: { idempotentHint: true },
        },
        async ({ id, done }) => {
          const { data, error } = await supabase
            .from('project_items')
            .update({ status: done ? 'done' : 'todo' })
            .eq('id', id)
            .select('id, title, status')
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!data) throw new Error('No such to-do in your family.');
          return text(data);
        },
      );

      server.registerTool(
        'list_groceries',
        {
          description: 'The family’s grocery list. status: need (shopping list), have, or backlog (usual items not needed now).',
          inputSchema: z.object({ status: z.enum(['need', 'have', 'backlog']).optional() }),
          annotations: { readOnlyHint: true },
        },
        async ({ status }) => {
          const f = await family(supabase, me);
          let q = supabase.from('grocery_items').select('name, status').eq('household_id', f.id).order('name');
          if (status) q = q.eq('status', status);
          const { data, error } = await q;
          if (error) throw new Error(error.message);
          return text(data);
        },
      );

      server.registerTool(
        'add_groceries',
        {
          description:
            'Put items on the family’s shopping list ("need"). Items already listed as have or backlog are moved to need; new names are added.',
          inputSchema: z.object({ names: z.array(z.string().min(1).max(80)).min(1).max(50) }),
          annotations: { idempotentHint: true },
        },
        async ({ names }) => {
          const f = await family(supabase, me);
          const key = (n: string) => n.trim().toLowerCase();
          const wanted = [...new Map(names.map((n) => [key(n), n.trim()])).entries()];
          const { data: existing, error } = await supabase
            .from('grocery_items')
            .select('id, name, status')
            .eq('household_id', f.id);
          if (error) throw new Error(error.message);
          const byName = new Map((existing ?? []).map((i) => [key(i.name), i]));
          const toInsert = wanted.filter(([k]) => !byName.has(k)).map(([, n]) => n);
          const toNeed = wanted.map(([k]) => byName.get(k)).filter((i) => i && i.status !== 'need').map((i) => i!.id);
          if (toInsert.length) {
            const { error: e } = await supabase
              .from('grocery_items')
              .insert(toInsert.map((name) => ({ household_id: f.id, name, status: 'need' })));
            if (e) throw new Error(e.message);
          }
          if (toNeed.length) {
            const { error: e } = await supabase.from('grocery_items').update({ status: 'need' }).in('id', toNeed);
            if (e) throw new Error(e.message);
          }
          return text({ added: toInsert, moved_to_need: toNeed.length, already_needed: wanted.length - toInsert.length - toNeed.length });
        },
      );

      server.registerTool(
        'list_routines',
        {
          description:
            'List the family’s routines (repeating tasks, like "empty the dishwasher"), with their schedule and usual owners.',
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true },
        },
        async () => {
          const f = await family(supabase, me);
          const routines = await activeRoutines(supabase, f.id);
          return text(
            routines.map((r) => ({
              id: r.id,
              name: r.name,
              schedule: mealSlotOf(f, r.id) ? 'On days with a cook (see get_week_plan)' : describeSchedule(r.schedule),
              owners: mealSlotOf(f, r.id) ? [] : r.assignee_ids.map((id) => nameOf(f.members, id)),
              personal: !!r.private_to,
              category: r.category,
            })),
          );
        },
      );

      server.registerTool(
        'add_routine',
        {
          description:
            'Add a routine (a task that repeats). days: the weekdays it happens on; leave out for every day. times_per_week instead of days for "3 times a week, any day". owner: a family member’s name or "me"; leave out for no usual owner (it can be assigned per day on the Assign tab). personal: true hides it from the rest of the family. category: an existing routine category name; created if missing.',
          inputSchema: z.object({
            name: z.string().min(1).max(120),
            days: z.array(z.enum(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])).min(1).max(7).optional(),
            times_per_week: z.number().int().min(1).max(7).optional(),
            owner: z.string().optional(),
            personal: z.boolean().default(false),
            category: z.string().max(60).optional(),
          }),
        },
        async ({ name, days, times_per_week, owner, personal, category }) => {
          const f = await family(supabase, me);
          const nums = days?.map((d) => DAY_NAMES.indexOf(d)).sort();
          const schedule: Schedule = times_per_week
            ? { type: 'weekly', times: times_per_week }
            : !nums || nums.length === 7
              ? { type: 'daily' }
              : { type: 'weekdays', days: nums };
          const assignee = personal ? me : owner ? findMember(f.members, me, owner) : null;

          const { data: cats, error: ce } = await supabase
            .from('routine_categories')
            .select('id, name, visibility')
            .eq('household_id', f.id)
            .order('sort_order')
            .order('created_at');
          if (ce) throw new Error(ce.message);
          const wanted = category?.trim().toLowerCase();
          let cat = wanted
            ? cats?.find((c) => c.name.toLowerCase() === wanted)
            : cats?.find((c) => c.visibility === 'family' && c.name !== 'Family planning') ?? cats?.[0];
          if (!cat) {
            const { data, error } = await supabase
              .from('routine_categories')
              .insert({ household_id: f.id, name: category?.trim() || 'Home', icon: '🏠', visibility: 'family' })
              .select('id, name, visibility')
              .single();
            if (error) throw new Error(error.message);
            cat = data;
          }

          const { data, error } = await supabase
            .from('routines')
            .insert({
              household_id: f.id,
              category_id: cat!.id,
              name: name.trim(),
              schedule,
              assignee_ids: assignee ? [assignee] : [],
              private_to: personal ? me : null,
            })
            .select('id, name')
            .single();
          if (error) throw new Error(error.message);
          return text({ added: data, schedule: describeSchedule(schedule), category: cat!.name, owner: nameOf(f.members, assignee) });
        },
      );

      server.registerTool(
        'get_week_plan',
        {
          description:
            'The Assign table for one week (Monday to Sunday): for each routine, who does it on each day ("nobody yet" = still to assign), the planned lunches and dinners with their cooks, plus to-dos due that week. "Make lunch" and "Cook dinner" are on the days that have a cook. Pass any date in the week (YYYY-MM-DD, the person’s local date).',
          inputSchema: z.object({ date: DATE }),
          annotations: { readOnlyHint: true },
        },
        async ({ date }) => {
          const f = await family(supabase, me);
          const from = weekStart(date);
          const week = Array.from({ length: 7 }, (_, i) => addDays(from, i));
          const routines = await activeRoutines(supabase, f.id);
          const plans = await plansBetween(supabase, f.id, from, week[6]);
          const meals = await mealsBetween(supabase, f.id, from, week[6]);
          const { data: todos, error } = await supabase
            .from('project_items')
            .select('title, status, due_date, planned_date, assignee_id')
            .eq('household_id', f.id)
            .neq('status', 'done');
          if (error) throw new Error(error.message);
          const label = (d: string) => `${DAY_NAMES[weekday(d)]} ${d}`;
          return text({
            week: `${from} to ${week[6]}`,
            routines: routines.map((r) => {
              // Lunch and dinner follow the meal plan's cooks; everything else its schedule and the Assign tab.
              const slot = mealSlotOf(f, r.id);
              const on = (d: string) =>
                slot ? onDay(asMealRoutine(r), d, cookPlan(meals.get(`${slot}|${d}`)?.cook_id)) : onDay(r, d, plans.get(`${r.id}|${d}`));
              return {
                id: r.id,
                name: r.name,
                days: Object.fromEntries(
                  week.flatMap((d) => {
                    const { planned, who } = on(d);
                    return planned ? [[label(d), who.length ? who.map((id) => nameOf(f.members, id)).join(', ') : 'nobody yet']] : [];
                  }),
                ),
              };
            }),
            meals: week.flatMap((d) =>
              (['lunch', 'dinner'] as const).flatMap((slot) => {
                const m = meals.get(`${slot}|${d}`);
                return m ? [{ day: label(d), slot, meal: m.meal, cook: nameOf(f.members, m.cook_id) }] : [];
              }),
            ),
            todos: (todos ?? [])
              .map((t: any) => ({ ...t, day: t.planned_date ?? t.due_date }))
              .filter((t) => t.day && t.day >= from && t.day <= week[6])
              .map((t) => ({ title: t.title, day: label(t.day), owner: nameOf(f.members, t.assignee_id) })),
          });
        },
      );

      server.registerTool(
        'assign_routine',
        {
          description:
            'Change one day of the week plan (like tapping a box on the Assign tab). who: a family member’s name or "me" to give them that day; "off" to take the routine off that day; "usual" to go back to its normal schedule and owner. For "Make lunch" and "Cook dinner" this sets who cooks that day ("off" or "usual" = nobody). Get routine ids from list_routines or get_week_plan.',
          inputSchema: z.object({ routine_id: z.string().uuid(), date: DATE, who: z.string().min(1) }),
          annotations: { idempotentHint: true },
        },
        async ({ routine_id, date, who }) => {
          const f = await family(supabase, me);
          const q = who.trim().toLowerCase();
          const slot = mealSlotOf(f, routine_id);
          if (slot) {
            // Who cooks lives with the meal plan, addressed by its day and slot.
            const where = { household_id: f.id, plan_date: date, slot };
            if (q === 'off' || q === 'usual') {
              const { error: e1 } = await supabase.from('meal_plans').update({ cook_id: null }).match(where);
              if (e1) throw new Error(e1.message);
              // A slot with no meal and no cook is just an empty row.
              const { error: e2 } = await supabase.from('meal_plans').delete().match(where).is('meal_id', null);
              if (e2) throw new Error(e2.message);
              return text({ routine_id, date: `${DAY_NAMES[weekday(date)]} ${date}`, cook: null });
            }
            const { error: e } = await supabase
              .from('meal_plans')
              .upsert({ ...where, cook_id: findMember(f.members, me, who) }, { onConflict: 'household_id,plan_date,slot' });
            if (e) throw new Error(e.message);
            return text({ routine_id, date: `${DAY_NAMES[weekday(date)]} ${date}`, cook: who });
          }
          const { error } =
            q === 'usual'
              ? await supabase.from('routine_plans').delete().eq('routine_id', routine_id).eq('plan_date', date)
              : await supabase.from('routine_plans').upsert(
                  {
                    routine_id,
                    household_id: f.id,
                    plan_date: date,
                    ...(q === 'off' ? { planned: false, assignee_id: null } : { planned: true, assignee_id: findMember(f.members, me, who) }),
                  },
                  { onConflict: 'routine_id,plan_date' },
                );
          if (error) throw new Error(error.message);
          return text({ routine_id, date: `${DAY_NAMES[weekday(date)]} ${date}`, now: q === 'off' || q === 'usual' ? q : who });
        },
      );

      server.registerTool(
        'complete_routine',
        {
          description: 'Tick a routine off for a day (done: false to un-tick). date is YYYY-MM-DD, the person’s local date.',
          inputSchema: z.object({ routine_id: z.string().uuid(), date: DATE, done: z.boolean().default(true) }),
          annotations: { idempotentHint: true },
        },
        async ({ routine_id, date, done }) => {
          const f = await family(supabase, me);
          const { error } = done
            ? await supabase
                .from('routine_logs')
                .upsert(
                  { routine_id, household_id: f.id, user_id: me, log_date: date, status: 'done' },
                  { onConflict: 'routine_id,log_date' },
                )
            : await supabase.from('routine_logs').delete().eq('routine_id', routine_id).eq('log_date', date);
          if (error) throw new Error(error.message);
          return text({ routine_id, date, done });
        },
      );

      return server;
    });

    return handler.fetch(req);
  }),
);
