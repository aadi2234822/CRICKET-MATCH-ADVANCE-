CRICKET MATCH MANAGER - v27 (animations)
=============================================
Teen folder hain:

1) website/            -> sirf ye files apni hosting par upload karo (index.html, share.html, sw.js, manifest.json, icons).
2) supabase_sql/       -> ye files SIRF Supabase SQL Editor mein chalani hain. Inhe hosting par upload MAT karo.
                          08_PRIVATE_telegram_seed.sql mein aapka bot token hai - kisi ko mat bhejna.
3) github_keepalive/   -> optional: Supabase ko pause hone se bachane ka GitHub workflow (file ke andar steps likhe hain).

SUPABASE MEIN SQL KA ORDER (jo pehle chal chuka hai use dobara chalane se dikkat nahi, safe hai)
  01_add_status_column.sql
  02_add_v21_columns.sql
  03_add_camera_column.sql
  04_add_roles.sql
  05_add_v24_core.sql
  06_add_v24_automation.sql   (pehle Database > Extensions mein pg_cron aur pg_net ON karo)
  07_add_v24_alerts.sql
  08_PRIVATE_telegram_seed.sql   (token save + alerts ON)
Naya (khali) Supabase project ho to 00_fresh_install_all_in_one.sql chalao, phir seedha 06, 07, 08.
extra/ folder ke files purane hain, normally chahiye nahi.

V27 - ANIMATIONS (website/animations.css - ye nayi file bhi upload karo)
- Page badalne par smooth slide-up, menu button pop, header ka cricket ball uchhalta hai, login card zoom-in.
- Popup / undo bar / checklist box animate hote hain, countdown popup upar se aata hai aur uske digits halke blink karte hain.
- Overlap ka warning mark blink karta hai, upload-late ka alarm mark hilta hai, charts aur planner ki bars grow hoti hain.
- Phone mein "Reduce motion" on ho to animations apne aap band ho jaate hain.
- Saari animations sirf animations.css mein hain. Band karni ho to index.html se
  <link rel="stylesheet" href="animations.css"> wali line hata do. Acode mein is file ko seedha edit kar sakte ho.

V26 - NAYA KYA HAI (sirf website/ folder badla hai, SQL mein koi change nahi)
1) HAR SECTION KA ALAG PAGE: upar ek menu bar hai (side mein swipe karo):
   Home (dashboard) | Alerts | Matches | Add | Bulk | Fetch | Calendar | Planner | Stats | Users | Admin
   - Page ka link alag hota hai (jaise ...index.html#matches), phone ka back button bhi kaam karta hai.
   - Add / Bulk / Fetch tab sirf unko dikhte hain jinke paas add permission hai. Users aur Admin sirf admin ko.
   - Alerts tab par laal number = kitne matches ko dhyan chahiye. Users tab par laal number = approval ka wait karte users.
   - Match "Edit" dabane par app Add page par jaata hai, aur save karne ke baad Matches page par wapas aata hai.
2) LIVE COUNTDOWN POPUP (hh:mm:ss): match shuru hone se pehle screen ke upar popup aata hai, jaise 00:42:15, har second ghat'ta hai.
   - Match shuru hone par popup laal ho jata hai ("MATCH STARTED +00:00:12"), phone vibrate karta hai, aur 5 minute baad hat jata hai.
   - Alerts page par setting hai: popup ON/OFF aur kitni der pehle se dikhe (15 min se 6 ghante). Default 1 ghanta pehle.
   - Popup mein match ka naam, series, time, camera, operator aur live platform dikhta hai. X dabane par wo popup band ho jata hai.
   - Popup tabhi dikhta hai jab app khula ho (kisi bhi page par). App band ho to Telegram alert kaam aata hai.
   - Sirf Scheduled / Recording wale matches ka popup aata hai. "Reminders only for my matches" tick ho to sirf aapke matches ka.

TELEGRAM - AB BAS YE KARNA HAI
1. Telegram group mein bot @MyCricketAlertbot ko member ki tarah add karo (group mein "2 members" dikhna chahiye).
2. Group mein koi message bhejo, jaise /start@MyCricketAlertbot
3. App kholo > Admin tools > Telegram box > "Find chat ID automatically" dabao. 6 second baad "Chat ID saved" aana chahiye.
4. "Send test alert" dabao (Pre-match alerts box). Group mein test message aana chahiye.
Bas. Iske baad har match se 1 ghanta pehle (Admin tools mein badal sakte ho) group mein alert aayega.

NOTE
- Token aapne chat mein dikha diya tha. Safe rehna hai to BotFather mein /revoke karke naya token lo, phir app ke Telegram box mein
  naya token paste karke Save karo (08 file dobara chalane ki zaroorat nahi).
- Features ki puri list: website_README_features.txt
- Ye SQL aur code maine test nahi chalaye (test Postgres nahi tha). Pehle apne Supabase ki copy par try karo.
