# YT Studio Claims Tracklist (Chrome extension)

Turns the Content ID claims YouTube Studio shows under *Claim overview* into a tracklist:

```
0:00 – 5:01 - Spiritual Antiseptic (Minty Fresh Confidence Mix) - Hallucinogen
5:03 – 11:32 - Selena's Song - Koan
```

All controls are in the extension popup (toolbar icon). Nothing is drawn inside the Studio page.
The popup runs the same internal Studio calls the Claim overview page makes
(`list_creator_received_claims`, `list_creator_videos`) inside your Studio tab, with your existing session –
no API key, no separate login.

## Install (unpacked)
1. Unzip; keep `manifest.json`, `popup.html`, `popup.js` together in one folder.
2. Chrome → `chrome://extensions` → **Developer mode** on → **Load unpacked** → pick the folder.
   (If it was already loaded from the old version: click the ↻ reload icon on its card.)
3. Pin the icon (puzzle icon → pin) so it is visible on the toolbar.

## Use
1. Open https://studio.youtube.com in the active tab (any Studio page).
2. Click the extension icon → popup.
3. **This video** – works when the active tab is a video page (`…/video/<id>/edit`, `…/claims`, …). Claims sorted by start time.
   **All matching videos** – works from any Studio page. The text box is a case-insensitive regex on video titles (default `10 hours`). Pages through the whole channel, then fetches claims video by video (~0.5 s each); one `### Title` section per video.
4. **Copy** or **Download .txt**.

Keep the popup open while it runs – clicking elsewhere closes the popup and stops the job (what was collected so far is lost; rerun).

Options: **audio claims only** drops visual/other claim types; **merge gap** merges claims with the same title that overlap or sit within N seconds (several labels often claim the same track).

## Notes
- Times are the claim's *longest match* segment (`Found in` in Studio), rounded to whole seconds – may differ ±1 s from the UI.
- Only tracks Content ID recognised appear; gaps between lines are untracked segments.
- Artist is taken only from the claim's artist metadata; publishers, collecting societies and labels are never shown as artist (composition claims therefore have no artist). "Metadata is hidden…" titles become "(hidden track)".
- "≤ N chars (start time only)" mode drops end times and cuts the list at the last full line that fits – for the 5000-char YouTube description limit.
- Studio's internal endpoints are undocumented; if a Studio update breaks it, the request bodies live in `pageListClaims` / `pageListVideos` in `popup.js`.
