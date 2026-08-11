# Fix apply page copy + licensing toggle

## Copy corrections (application page)

Three claims on `/apply` are wrong. Replace them everywhere they appear (hero subline and the value-prop pill strip):

| Current | New |
| --- | --- |
| Paid weekly / "commissions paid weekly" | Daily pay |
| Warm inbound leads | Unlimited leads |
| Free licensing & training | Discounted licensing & training |

Resulting hero subline: "Uncapped commissions with daily pay, unlimited leads, and discounted licensing and training. Three minutes to apply — no résumé required."

I'll also check the landing page and the two application-complete pages for the same three claims and correct them so the site doesn't contradict itself.

## "Are you currently licensed?" buttons

The two options are real buttons that set state on click, so the click handler itself looks wired. What's not confirmed is why it feels dead on mobile — the two likely causes are (a) something overlaying the buttons, or (b) the selected state being nearly invisible, since selection today only changes the border and text color slightly.

Step 1: reproduce on a mobile-sized viewport, tap each option, and confirm whether state changes.

Step 2: fix what the repro shows.
- If the tap isn't registering, remove whatever intercepts it (overlay/stacking issue) so the buttons receive the tap.
- If the tap registers but looks unchanged, make selection unmistakable: gold filled background, dark text, gold border, plus a check mark on the chosen option — and give the unselected option a visible hover/press state.

Either way the buttons get proper `aria-pressed` state and a comfortable tap target height.

## Technical notes

- Copy lives in `src/routes/apply.tsx` (hero paragraph around line 188, `VALUE_PROPS` constant at the bottom).
- The toggle is the `Field label="Are you currently licensed? *"` block in the same file; selected styling comes from the `apx-input` class plus conditional classes.
- Verification uses a headless browser run at a 440px-wide viewport against the local preview, with a screenshot before and after tapping each option.
- No backend, schema, or submission-logic changes — the `licensed` value already drives routing to the licensed/unlicensed success pages.
