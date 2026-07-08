# How to turn the letter site ON or OFF (the master switch)

**Who this is for:** the Owner. No coding, no Cloudflare, no app — just GitHub in
a browser (phone or computer).

The whole site has one master power switch: the file `admin/site-status.md`,
whose last line reads either `Status: on` or `Status: off`.

- **`on`**  → the letter is live as normal.
- **`off`** → every visitor sees the *"the letter has been burned"* notice
  instead. **Nothing is actually lost** — the letter, the code, the tracking and
  the log all stay exactly as they are behind the scenes. Flipping back to `on`
  restores everything.

> ⚠️ Use **this** switch, not Cloudflare. Editing the file is the clean, supported
> way to pause the site.

---

## Steps to flip the switch

1. **Open the file's editor** (sign in to GitHub if asked):
   👉 https://github.com/isaacphil/monlilcuz/edit/main/admin/site-status.md

2. **Find the last line:** `Status: on`

3. **Change the one word:**
   - To turn the site **OFF** → make it read `Status: off`
   - To turn the site **ON**  → make it read `Status: on`

   Change *only* that one word; leave everything else as-is.

4. **Save it:** click the green **Commit changes…** button (top-right), then
   click the green **Commit changes** button again to confirm. (Ignore the
   description boxes.)

5. **Wait ~1 minute**, then refresh the site. The change is live.

Flip it back and forth as often as you like.

---

## Notes

- Applies to `https://monlilcuz.pages.dev/`.
- Your private access log at `/log` keeps working even when the site is paused,
  so you can still check history while it's off.
