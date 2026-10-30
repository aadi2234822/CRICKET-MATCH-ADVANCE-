// Supabase Edge Function: Telegram bot webhook for Cricket Match Manager.
// Deploy:  supabase functions deploy telegram-bot --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleText, type Db, type Row } from "./bot.ts";

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
