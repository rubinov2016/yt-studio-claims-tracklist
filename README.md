# yt-studio-claims-tracklist

Chrome extension that turns the Content ID claims YouTube Studio shows under **Claim overview** into a timestamped tracklist – for one video or for every video on the channel whose title matches a filter.

```
0:09 City Theme - Vanessa-Mae
4:43 Jet - London Symphony Orchestra
9:09 A Little Romance Pt. 2 - Chris Hinze
```

Made for long mixes (10-hour compilations etc.) where Studio knows every claimed track and its position, but only shows them one claim at a time behind *View details*.

## How it works

The popup runs, inside your open Studio tab, the same internal calls the Claim overview page makes (`list_creator_received_claims`, `list_creator_videos`) using your existing session. No API key, no OAuth, no separate login, nothing leaves the browser. Nothing is injected into the Studio page UI.

## Install (unpacked)

1. Download / clone this repo.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the repo folder (the one with `manifest.json`).
3. Pin the icon (puzzle icon → pin).

Works in Chrome and other Chromium browsers supporting Manifest V3 (`chrome.scripting`).

## Use

1. Open https://studio.youtube.com in the active tab and sign in.
2. Click the extension icon.
3. Choose:
   - **This video** – when the active tab is a video page (`…/video/<id>/edit`, `…/claims`, …). Claims sorted by start time.
   - **All matching videos** – from any Studio page. The text box is a case-insensitive regex on video titles (default `10 hours`). Pages through the whole channel, then fetches claims video by video (~0.5 s each); output has one `### Title` section per video with the watch URL.
4. **Copy** or **Download .txt**.

Keep the popup open while it runs – clicking elsewhere closes the popup and aborts the job.

### Options

| Option | Effect |
|---|---|
| audio claims only | drops visual / other claim types |
| merge gap (s) | merges claims with the same title that overlap or sit within N seconds (several labels often claim the same track) |
| ≤ N chars (start time only) | drops end times (`0:09 Title - Artist`) and cuts at the last whole line that fits – for YouTube's 5000-character description limit; status shows how many lines were cut |

Unticking *≤ N chars* gives the long form: `0:09 – 4:41 - Title - Artist`.

## Notes and limits

- Times are the claim's *longest match* segment (what Studio shows as *Found in*), rounded to whole seconds – may differ by ±1 s from the UI.
- Only tracks Content ID recognised appear; gaps between lines are unclaimed segments.
- Artist comes only from the claim's artist metadata. Publishers, collecting societies and labels (UMPG, Sony Music Publishing, LatinAutor, TEOSTO…) are never shown as artist, so composition-only claims are title-only. "Metadata is hidden…" titles become `(hidden track)`.
- Studio's internal endpoints are undocumented and may change. If a Studio update breaks the extension, the request bodies live in `pageListClaims` / `pageListVideos` in `popup.js`.
- Read-only: the extension never disputes, edits or removes claims.

## Files

```
manifest.json   MV3 manifest (permissions: scripting, activeTab; host: studio.youtube.com)
popup.html      UI
popup.js        logic – page-side fetch functions + formatting
```

## License

MIT
