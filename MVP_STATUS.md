# Auto Beli MVP status

This document describes the revamped local MVP as of August 17, 2026.

## Intended flow

1. Import meal photos or a zip.
2. Group photos into meals from time and location metadata.
3. Match each meal to a nearby restaurant.
4. Review the restaurant match and category.
5. Name each photographed dish and mark favorite-dish photos.
6. Select the Beli reaction, companions, and exact Beli labels.
7. Enter raw thoughts and optionally generate an editable first draft in Ryan's style.
8. Add any favorite dishes that do not have a photo.
9. Launch iPhone Mirroring automation to enter the review in Beli.
10. Finish Beli's comparison flow on the phone.

## Working in the MVP

- Local photo and zip import, including preserved date and location metadata when the source file contains it.
- Meal clustering, restaurant matching, manual restaurant correction, and Beli category selection.
- Google Places lookup with the local quota guard already configured for this installation.
- Photo-to-dish descriptions without the previous fake `Menu` fallback.
- Per-photo favorite-dish controls in Auto Beli.
- Exact multi-select Beli labels, companions, notes, visit date, photos, and photo descriptions passed into the phone automation.
- An editable review first draft generated through the locally signed-in ChatGPT/Codex CLI. It does not require an OpenRouter key.
- A local style profile distilled from Ryan's ChatGPT review work and published top Beli reviews.
- Pause, retry, skip, cancel, photo recovery, and progress controls for the phone automation.

## Implemented but needs real-flow probing

- The automation now clicks Beli's per-photo favorite-dish circle after typing that photo's dish name. This is based on the current Beli layout and must be exercised across multiple photo counts and screen states.
- Additional favorite dishes are entered after photos so Beli can first derive favorites from marked photos. Beli's field is free-form, so multiple additional dishes are currently entered as comma-separated text; verify how the current Beli build converts that text into dish chips.
- Empty photo descriptions are preserved as empty instead of being mislabeled `Menu`. Confirm Beli permits saving every combination of described and undescribed photos.
- The generated review is grounded only in entered details, but it has not yet learned automatically from edits made after generation.
- Photo matching in the normal iPhone photo library is visual and can need the existing recovery controls when Photos ordering, cropping, iCloud loading, or synchronization changes. No dedicated Beli album is required.
- Labels and companions rely on Beli's visible text and search results. Renamed labels, duplicate member names, or layout changes can require a retry or manual completion.

## Not fully implemented

- Automatic internet review research. The existing ChatGPT/Codex sign-in can generate prose, but it does not expose ChatGPT browsing as a supported background API for this local app. The MVP deliberately does not invent or import public-review claims.
- Direct access to the ChatGPT `Reviews` folder. The app uses an abstract local style profile; it cannot silently sync that folder or its future conversations.
- Automatic style learning from the final version saved in Beli. Beli does not provide the app a final-review callback or supported local API.
- Final read-back validation. The automation confirms that Beli reaches its share page, but it does not re-open the published review and compare every field against Auto Beli.
- Automatic numeric scoring. Auto Beli selects liked, fine, or disliked; Beli's own comparison flow determines the final score.
- Stealth mode automation.
- Native Google Photos browsing. Google Photos images work after downloading/exporting the original files; browser drag behavior and exported metadata vary.
- Guaranteed drag-and-drop directly from iPhone Mirroring. Safari currently accepts the transfer more reliably than the embedded preview, and Apple controls whether the mirror exposes a real file payload.

## Best places to probe

1. A meal with three photos, two marked as favorites, and one blank description.
2. A meal with one photo favorite plus two comma-separated additional favorite dishes.
3. A review draft generated from detailed negative feedback and a disliked reaction.
4. A restaurant with a duplicate or similar name in the same neighborhood.
5. A review with several companions and labels near the bottom of Beli's label list.
6. Photo recovery after deliberately deselecting or failing to match one image.
7. The final Beli review to confirm notes, favorite dishes, labels, visit date, and photos all agree.
