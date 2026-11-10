# Sign-up setup — collecting the names of people who follow the experiment

The form on the experiment page posts to a Google Apps Script that writes one row per
person into a Google Sheet you own, then returns the Discord invite. Until the script
is deployed the form is **not connected**: it shows an error instead of a false
"thank you", and `node _build/lint.mjs` reports `SIGNUP` as an outstanding gate.

## One-time setup (about five minutes)

1. Create a Google Sheet in the account that should own the list. Name it anything.
2. In the Sheet: **Extensions → Apps Script**. Delete the sample code and paste the whole
   of `_build/signup-apps-script.gs`. Save.
3. **Deploy → New deployment → type: Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone**
   Authorise it when asked (it needs permission to edit this one spreadsheet).
4. Copy the **Web app URL** — it ends in `/exec`.
5. Open that URL in a browser. You should see
   `{"ok":true,"service":"10xedge sign-up","accepts":"POST"}`.
6. Put the URL in `_build/figures.json` → `experiment.signup.endpoint`, set
   `experiment.signup.verified` to `true`, then run `node _build/build.mjs`.

## What lands in the Sheet

A tab called `Sign-ups` is created on the first submission:

| First signed up | Name | Email | Source | Last submitted | Submissions |
|---|---|---|---|---|---|

- One row per email address (lower-cased). Signing up again updates the name, the
  "last submitted" time and the count — it never adds a duplicate.
- The script refuses a missing name, a malformed email or an unticked consent box.
- A hidden field that only bots fill is answered with "ok" and writes nothing.
- A cell that would start with `=`, `+`, `-` or `@` is stored as text, so nobody can
  plant a formula in your sheet.
- Limits: 30 submissions a minute across all visitors, 20,000 rows in total.

## Test before publishing

Use a **copy** of the Sheet with its own deployment, so test rows never reach the real
list. Then check: a submission lands; the Discord button appears and is still there
after a reload; the same email again updates the row instead of adding one; turning the
deployment off shows the error message on the page.

## Things to know

- **Changing the script** needs *Deploy → Manage deployments → Edit → New version*.
  The `/exec` URL stays the same.
- **Changing the Discord invite**: edit `INVITE` at the top of the script and publish a
  new version. The invite is deliberately not in the page, so the page needs no rebuild.
- The gate is a courtesy gate, not a lock: the invite link works for anyone who is
  handed it. What the form buys you is the name and email of everyone who arrives
  through the page.
- The private preview of the page never posts here. Previews carry a stub.
- Removal requests: delete the row. The page tells people to email
  hd@ekantikcapital.com.
