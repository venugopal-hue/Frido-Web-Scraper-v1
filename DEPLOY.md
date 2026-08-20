# Deploying

Local is enough for the hackathon submission, but a live URL means judges can
try it without watching the video first.

Three pieces deploy separately: the dashboard (static-ish, Vercel), the API
(long-running, needs a disk), and the bot (long-running, no HTTP).

> **You run these steps.** They need your accounts and your secrets — nothing
> here should be pasted into a chat window.

---

## 1. Backend API → Railway

The API shells out to the `bdata` CLI and writes SQLite, so it needs a real
container with a persistent volume, not a serverless function.

```bash
npm i -g @railway/cli
railway login
cd backend
railway init
railway up
```

Then in the Railway dashboard:

**Add a volume** — mount path `/data`. Without it the database is wiped on every
redeploy, and the diff engine has no previous snapshot to compare against, so
alerts silently never fire.

**Set variables:**

| Variable | Value |
|---|---|
| `BRIGHTDATA_API_KEY` | your key — the container cannot run `bdata login` interactively |
| `COLLECTOR_ID` | `c_mt11rkfr1irkjzsb9` |
| `PACKS_COLLECTOR_ID` | `c_mt15pipw2hu94v7ehy` |
| `TELEGRAM_BOT_TOKEN` | from @BotFather — the API sends the alerts, not the bot |
| `ADMIN_TOKEN` | any long random string; see the warning below |
| `DB_PATH` | `/data/scrapeverse.db` |
| `ENABLE_SCHEDULER` | `true` |
| `CRON_SCHEDULE` | `0 */6 * * *` |

⚠️ **Set `ADMIN_TOKEN` before going public.** `/api/refresh` and `/api/heal`
spend Bright Data credit, and with no token configured the check is skipped
entirely — that is fine on localhost and not fine on the open internet.

Note the public URL Railway assigns, e.g. `https://scrape-verse.up.railway.app`.

## 2. Dashboard → Vercel

```bash
npm i -g vercel
cd dashboard
vercel
```

Set one environment variable in the Vercel project:

| Variable | Value |
|---|---|
| `API_BASE_URL` | your Railway URL |

`next.config.mjs` proxies `/api/*` to that origin, so the browser only ever
talks to the Vercel domain — no CORS configuration and no API URL baked into
the client bundle.

Redeploy after setting it: `vercel --prod`.

## 3. Telegram bot → Railway worker

The bot uses long polling, so it needs a always-on process but no public port.
Deploy it as a second Railway service from the same repo with root
directory `telegram-bot`:

| Variable | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | same token |
| `API_BASE_URL` | your Railway API URL |
| `ADMIN_TOKEN` | must match the API's |
| `TELEGRAM_ADMIN_CHAT_IDS` | your chat ID |

**Only ever run one bot instance.** Telegram allows a single long-polling
consumer per token; a second one (including one still running on your laptop)
causes both to drop updates with a 409.

---

## After deploying

```bash
# seed the catalogue
curl -X POST https://<your-api>/api/refresh \
  -H "x-admin-token: <your ADMIN_TOKEN>" \
  -H "Content-Type: application/json" -d '{}'
```

Then check `/api/status` returns `healthy`, open the Vercel URL, and send
`/status` to the bot.

## Costs

Bright Data credit is the real cost — a full catalogue scrape is 8 chunked
runs plus ~146 image lookups. At `0 */6 * * *` that is 4 scrapes a day. Watch
it with:

```bash
bdata budget
```

Raise `CRON_SCHEDULE` to `0 */12 * * *` or set `MAX_CATEGORIES` to trim runs if
the credit is going faster than you expected.
