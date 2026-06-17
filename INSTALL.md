# How to connect HuntFlow to Claude — a simple guide

This guide is for people who are **not programmers**. After setup, you'll be able to ask Claude things
like "show candidates for a vacancy" or "gather analytics for a vacancy", and Claude will pull the data
from your HuntFlow. The whole thing takes **10–15 minutes** and is done once.

---

## What you need
- A computer (Mac or Windows).
- The **Claude Desktop** app.
- Access to your **HuntFlow** account (to get a token).

---

## Step 1. Install Claude Desktop
1. Open **claude.ai/download**
2. Download the version for your computer and install it (like any regular app).
3. Launch it and sign in to your Claude account.

## Step 2. Install Node.js (this is the "engine", needed once)
1. Open **nodejs.org**
2. Download the **LTS** button (the recommended version).
3. Install by clicking "Next/Continue" to the end. Nothing to configure.

## Step 3. Get a HuntFlow token
A token is an access key. Without it, Claude cannot read your vacancies.
1. Go to **HuntFlow → Settings → API** (the tokens section).
2. Click **"Add token"**, give it a name → **Create**.
3. A **link** will appear, like `https://huntflow.ai/token_request/...`
4. **Open this link in a browser** (you must be signed in to HuntFlow) and click **"Receive"**.
   > ⚠️ Don't forward the link or open it "just to look" in advance — once opened, it works only once.
5. Copy the **long string of letters and digits** that appears — that is your token. **Don't show it to anyone.**

## Step 4. Add HuntFlow to the Claude settings
1. In Claude Desktop open **Settings**.
2. Go to the **Developer** section → click **Edit Config**. A text file opens.
3. Paste this block into it (if the file is empty — paste the whole thing):

```json
{
  "mcpServers": {
    "huntflow": {
      "command": "npx",
      "args": ["-y", "@gaivoronsky/huntflow-mcp"],
      "env": {
        "HUNTFLOW_TOKEN": "paste-your-token-here",
        "HUNTFLOW_BASE_URL": "https://api.huntflow.ai/v2"
      }
    }
  }
}
```

4. Replace `paste-your-token-here` with the token from Step 3 (paste it between the quotes).
5. **Save** the file (Cmd+S on Mac / Ctrl+S on Windows).

> If the file already has other services — just add the `"huntflow": { ... }` line
> inside the existing `"mcpServers"`, without removing the rest.

## Step 5. Restart Claude
Fully quit Claude Desktop (Mac: ⌘Q; Windows: exit the app) and open it again.
This is required — otherwise the changes won't be picked up.

## Step 6. Check that it works
Ask Claude, for example:
- "Show the list of accounts in HuntFlow"
- "Show open vacancies"

If Claude replies with data from HuntFlow — you're all set! 🎉

---

## What Claude can now do
- 📋 Vacancies: list, details, how many days in progress.
- 👤 Candidates: search, cards, resumes, which stages they are at.
- 🔄 Funnel: recruiting stages, rejection reasons.
- 💬 Candidate comments: read and add.
- ✍️ Candidate cards: create a card, attach it to a vacancy, upload a resume file.
- 📊 **Ready-made scenarios** (in Claude they are called "prompts"): vacancy analytics —
  days in progress, candidates with the customer, timing of CV submission to the client.

---

## If something doesn't work
- **Claude doesn't see HuntFlow** → make sure you fully restarted the app (Step 5).
- **Token error / 401** → the token may have expired (it lives ~7 days). Get a new one per Step 3 and paste it again.
- **Empty responses / 404 errors** → if your account is on the Russian HuntFlow, replace
  `https://api.huntflow.ai/v2` with `https://api.huntflow.ru/v2` in the settings.
- **It doesn't start at all** → make sure you installed Node.js (Step 2) and saved the settings file.

If it still doesn't work — show this file and the error text to whoever set it up, and they'll help quickly.
