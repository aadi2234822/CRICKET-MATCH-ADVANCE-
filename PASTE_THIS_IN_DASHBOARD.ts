import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== bot logic =====
// Pure bot logic (no network code), so it can be tested without Telegram or Supabase.
type Row = {
  id: string; seq?: number; match_date: string; match_time?: string | null; series?: string; match: string;
  odi_t20?: string; operator?: string | null; stream_platforms?: string | null; status?: string | null;
  recorded?: string | null; uploaded?: string | null;
};
type Profile = { email: string; role: string; approved: boolean; can_view: boolean; can_status: boolean };
interface Db {
  byDate(date: string): Promise<Row[]>;
  bySeq(seq: number): Promise<Row | null>;
  pending(beforeDate: string): Promise<Row[]>;
  update(id: string, patch: Record<string, unknown>): Promise<boolean>;
  log(email: string, action: string, row: Row, details: Record<string, unknown>): Promise<void>;
  profile(email: string): Promise<Profile | null>;
  link(chatId: number): Promise<string | null>;
  saveLink(chatId: number, email: string): Promise<void>;
}
type Ctx = { chatId: number; db: Db; linkSecret: string; today: string; tomorrow: string };

const INACTIVE = ["Postponed", "Abandoned", "Cancelled"];
const ALL = ["Scheduled", "Recording", "Recorded", "Editing", "Uploaded", ...INACTIVE];

function effStatus(r: Row): string {
  if (r.status && r.status !== "Scheduled") return r.status;
  if (r.uploaded === "Done") return "Uploaded";
  if (r.recorded === "Done") return "Recorded";
  return "Scheduled";
}
function flags(st: string): Record<string, string> {
  if (st === "Uploaded") return { recorded: "Done", uploaded: "Done" };
  if (st === "Recorded" || st === "Editing") return { recorded: "Done", uploaded: "Pending" };
  if (st === "Scheduled" || st === "Recording") return { recorded: "Pending", uploaded: "Pending" };
  return {};
}
function fmtTime(t?: string | null): string {
  if (!t) return "--";
  const [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtDate(d: string): string {
  const x = new Date(d + "T00:00:00Z");
  return x.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
}
function icon(st: string): string {
  return ({ Uploaded: "✅", Recorded: "🎥", Editing: "✂️", Recording: "🔴", Scheduled: "🕒" } as Record<string, string>)[st] ?? "⛔";
}
function line(r: Row): string {
  const st = effStatus(r);
  return `#${r.seq ?? "?"} ${fmtTime(r.match_time)} - ${r.match}${r.series ? " (" + r.series + ")" : ""}\n   ${icon(st)} ${st} | Platform: ${r.stream_platforms || "-"}` +
    (r.operator ? ` | ${r.operator.split("@")[0]}` : "");
}
function list(title: string, rows: Row[]): string {
  if (!rows.length) return `${title}\nKoi match nahi.`;
  const shown = rows.slice(0, 30).map(line).join("\n");
  return `${title} (${rows.length})\n\n${shown}` + (rows.length > 30 ? `\n\n...aur ${rows.length - 30} matches` : "");
}
const HELP = `Cricket bot commands:
/today - aaj ke matches
/tomorrow - kal ke matches
/mine - mere matches (aaj aur kal)
/pending - purane matches jinka upload baaki hai
/rec 12 - match #12 recorded
/up 12 - match #12 uploaded
/status 12 Cancelled - koi bhi status (Scheduled, Recording, Recorded, Editing, Uploaded, Postponed, Abandoned, Cancelled)
/platform 12 YouTube - platform set karo
Seedha bhi likh sakte ho: "match 12 uploaded"
#number har match ke aage dikhta hai.`;

async function handleText(raw: string, ctx: Ctx): Promise<string> {
  const text = (raw || "").trim();
  if (!text) return HELP;
  const [cmd0, ...rest] = text.split(/\s+/);
  const cmd = cmd0.toLowerCase().replace(/@\w+$/, "");

  if (cmd === "/start" || cmd === "/help") {
    const email = await ctx.db.link(ctx.chatId);
    return (email ? `Linked: ${email}\n\n` : `Pehle link karo: /link SECRET aapka-app-email\n(Chat id: ${ctx.chatId})\n\n`) + HELP;
  }
  if (cmd === "/link") {
    const [secret, email] = rest;
    if (!secret || !email) return "Aise likho: /link SECRET aapka-app-email";
    if (secret !== ctx.linkSecret) return "Secret galat hai.";
    const p = await ctx.db.profile(email.toLowerCase());
    if (!p || !p.approved) return "Ye email app mein approved user nahi hai.";
    await ctx.db.saveLink(ctx.chatId, p.email);
    return `Link ho gaya: ${p.email}\n\n` + HELP;
  }

  const email = await ctx.db.link(ctx.chatId);
  if (!email) return "Ye chat linked nahi hai. Pehle: /link SECRET aapka-app-email";
  const prof = await ctx.db.profile(email);
  if (!prof || !prof.approved) return "Aapka app account approved nahi hai.";
  const canView = prof.role === "admin" || prof.can_view;
  const canStatus = prof.role === "admin" || prof.can_status;
  const active = (rs: Row[]) => rs.filter((r) => !INACTIVE.includes(effStatus(r)));

  if (["/today", "/tomorrow", "/mine", "/pending"].includes(cmd)) {
    if (!canView) return "Aapko matches dekhne ki permission nahi hai.";
    if (cmd === "/today") return list(`Aaj ke matches (${fmtDate(ctx.today)})`, await ctx.db.byDate(ctx.today));
    if (cmd === "/tomorrow") return list(`Kal ke matches (${fmtDate(ctx.tomorrow)})`, await ctx.db.byDate(ctx.tomorrow));
    if (cmd === "/mine") {
      const rows = [...await ctx.db.byDate(ctx.today), ...await ctx.db.byDate(ctx.tomorrow)].filter((r) => (r.operator || "").toLowerCase() === email.toLowerCase());
      return list("Mere matches (aaj + kal)", rows);
    }
    return list("Upload pending", active(await ctx.db.pending(ctx.today)));
  }

  // free text: "match 12 uploaded" / "12 recorded"
  let seqStr = "", action = "", arg = rest.join(" ");
  if (["/rec", "/up", "/status", "/platform"].includes(cmd)) { seqStr = rest[0] || ""; arg = rest.slice(1).join(" "); action = cmd; }
  else {
    const m = text.toLowerCase().match(/^(?:match\s*)?#?(\d+)\s+(recorded|uploaded|rec|up|done)\b/);
    if (!m) return "Samajh nahi aaya.\n\n" + HELP;
    seqStr = m[1]; action = m[2].startsWith("rec") ? "/rec" : "/up";
  }
  if (!canStatus) return "Aapko status badalne ki permission nahi hai.";
  const seq = parseInt(seqStr.replace("#", ""), 10);
  if (!seq) return "Match number likho, jaise /up 12";
  const r = await ctx.db.bySeq(seq);
  if (!r) return `Match #${seq} nahi mila.`;
  const before = effStatus(r);
  let patch: Record<string, unknown>; let msg: string;
  if (action === "/rec") { patch = { status: "Recorded", ...flags("Recorded") }; msg = "Recorded"; }
  else if (action === "/up") { patch = { status: "Uploaded", ...flags("Uploaded") }; msg = "Uploaded"; }
  else if (action === "/status") {
    const want = ALL.find((s) => s.toLowerCase() === arg.trim().toLowerCase());
    if (!want) return "Status ye ho sakte hain: " + ALL.join(", ");
    patch = { status: want, ...flags(want) }; msg = want;
  } else {
    const pl = arg.trim(); if (!pl) return "Platform likho, jaise /platform 12 YouTube";
    patch = { stream_platforms: pl.slice(0, 80) }; msg = "Platform: " + pl.slice(0, 80);
  }
  const ok = await ctx.db.update(r.id, patch);
  if (!ok) return "Update nahi hua. Dobara try karo.";
  await ctx.db.log(email, "telegram_bot", r, { from: before, patch });
  return `✅ #${seq} ${r.match}\n${before} → ${msg}`;
}

// ===== server =====
// Supabase Edge Function: Telegram bot webhook for Cricket Match Manager.
// Deploy:  supabase functions deploy telegram-bot --no-verify-jwt

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const HOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const LINK_SECRET = Deno.env.get("BOT_LINK_SECRET")!;
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const istDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + 5.5 * 3600e3 + offsetDays * 86400e3);
  return d.toISOString().slice(0, 10);
};
const cols = "id,seq,match_date,match_time,series,match,odi_t20,operator,stream_platforms,status,recorded,uploaded";
const db: Db = {
  async byDate(date) {
    const { data } = await sb.from("matches").select(cols).eq("match_date", date).order("match_time").order("seq");
    return (data ?? []) as Row[];
  },
  async bySeq(seq) {
    const { data } = await sb.from("matches").select(cols).eq("seq", seq).maybeSingle();
    return (data as Row) ?? null;
  },
  async pending(before) {
    const { data } = await sb.from("matches").select(cols).lt("match_date", before).neq("uploaded", "Done").order("match_date").limit(200);
    return (data ?? []) as Row[];
  },
  async update(id, patch) {
    const { data, error } = await sb.from("matches").update(patch).eq("id", id).select("id");
    return !error && !!data?.length;
  },
  async log(email, action, row, details) {
    await sb.from("activity_log").insert({ user_email: email, action, match_id: row.id, match_name: row.match, details });
  },
  async profile(email) {
    const { data } = await sb.from("profiles").select("email,role,approved,can_view,can_status").ilike("email", email).maybeSingle();
    return data ?? null;
  },
  async link(chatId) {
    const { data } = await sb.from("telegram_links").select("email").eq("chat_id", chatId).maybeSingle();
    return data?.email ?? null;
  },
  async saveLink(chatId, email) {
    await sb.from("telegram_links").upsert({ chat_id: chatId, email });
  },
};

async function send(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) }),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get("x-telegram-bot-api-secret-token") !== HOOK_SECRET) return new Response("forbidden", { status: 403 });
  try {
    const upd = await req.json();
    const msg = upd.message;
    if (msg?.text && msg.chat?.type === "private") {
      const reply = await handleText(msg.text, { chatId: msg.chat.id, db, linkSecret: LINK_SECRET, today: istDate(0), tomorrow: istDate(1) });
      await send(msg.chat.id, reply);
    }
  } catch (e) { console.error(e); }
  return new Response("ok");
});
