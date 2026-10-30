// Pure bot logic (no network code), so it can be tested without Telegram or Supabase.
export type Row = {
  id: string; seq?: number; match_date: string; match_time?: string | null; series?: string; match: string;
  odi_t20?: string; operator?: string | null; stream_platforms?: string | null; status?: string | null;
  recorded?: string | null; uploaded?: string | null;
};
export type Profile = { email: string; role: string; approved: boolean; can_view: boolean; can_status: boolean };
export interface Db {
  byDate(date: string): Promise<Row[]>;
  bySeq(seq: number): Promise<Row | null>;
  pending(beforeDate: string): Promise<Row[]>;
  update(id: string, patch: Record<string, unknown>): Promise<boolean>;
  log(email: string, action: string, row: Row, details: Record<string, unknown>): Promise<void>;
  profile(email: string): Promise<Profile | null>;
  link(chatId: number): Promise<string | null>;
  saveLink(chatId: number, email: string): Promise<void>;
}
export type Ctx = { chatId: number; db: Db; linkSecret: string; today: string; tomorrow: string };

const INACTIVE = ["Postponed", "Abandoned", "Cancelled"];
const ALL = ["Scheduled", "Recording", "Recorded", "Editing", "Uploaded", ...INACTIVE];

export function effStatus(r: Row): string {
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
export function fmtTime(t?: string | null): string {
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
export const HELP = `Cricket bot commands:
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

export async function handleText(raw: string, ctx: Ctx): Promise<string> {
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
