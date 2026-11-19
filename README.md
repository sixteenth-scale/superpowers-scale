# Super Powers Scale Bench

Converts a DC *Who's Who* listed height into the millimetres needed to model and
print a custom action figure that stands correctly alongside the Kenner Super
Powers Collection.

**[Open the tool](https://sixteenth-scale.github.io/)**

## The scale

Anchored on Batman: his listed height is 6'2" (74 in) and the reference figure
measures 4-5/8 in (117.475 mm) to the crown of the cowl.

```
74 / 4.625 = 16.0 exactly
```

Super Powers is **1:16**. The whole conversion is one constant:

```
25.4 mm / 16 = 1.5875 mm per real-world inch
```

Vehicles, playsets, weapons and accessories all use that same multiplier. A
standard 6'8" interior door is 127.00 mm; get the doorway right and an interior
follows.

## The two head-height rules

**1. Measure to the crown of the skull. Nothing above it counts.** Cowl ears,
horns, helmet crests, fins, top hats and flame effects are not height. Batman's
6'2" is his height as a man; the ears sit proud of that. Model the body to the
target and let the topper rise above it. Compressing a figure to fit its ears
under the target is the usual reason a custom ends up visibly short on a shelf.

**2. Subtract for hair above the skull.** A listed height is effectively
measured to the top of the skull. Where a sculpt carries volume above that, back
off about a millimetre. At 1:16 one millimetre is sixteen real inches, so these
corrections stay small.

## Data

`characters.csv` is the database, one row per Who's Who printing. Where a later
printing lists a different height it becomes a second row rather than
overwriting the first -- Hawkman is listed at 6'6" in Who's Who #10, and an
errata in Update '87 #5 corrects it to 5'11".

The `confidence` column is deliberately honest:

| Value | Means |
|---|---|
| `canon` | Read off an actual Who's Who page |
| `web` | Corroborated across sources, but not off the page itself |
| `check` | Unverified. Treat as a starting point, not a measurement |
| `builder` | Set at the bench from a figure in hand |
| `disputed` | Sources contradict each other. **Do not print from these** |
| `estimate` | No Who's Who entry exists (Super Powers originals), scaled to match the line |

Corrections are welcome -- open an issue or a pull request against
`characters.csv`. A height read off a real page beats anything else in here.

`reference.csv` holds real-world dimensions for playset and vehicle work: doors,
ceilings, stairs, rails, counters, seat heights, vehicle lengths, weapon lengths.

## Color for Bambu Studio

Paints a figure -- or the parted-out pieces of one -- from reference art, on
the filaments you actually own, and saves a 3MF that opens in Bambu Studio
already painted.

1. **Model to color** -- a Bambu project (parted-out pieces are fine) or an STL.
2. **Whole figure** -- only when the model is parted out. Meshy paints this, and
   each piece is found on it wherever it sits on the plate.
3. **Reference art** -- 1 to 4 images, or a model that is already colored
   (a Meshy GLB, or a painted 3MF).

Colors are grouped into regions and each is snapped to the closest filament on
your shelf (CIEDE2000). A region with no close match is flagged, with the
nearest Bambu color offered. Click a region to change its filament, or paint
one patch. A Bambu project keeps its plate, settings and layout; only the paint
and the filament list change. Reopen a painted file to keep editing.

The filament list starts from Bambu's own color codes and hex values
(`filaments_color_codes.json` in BambuStudio). Add other brands by name and
color. Your Meshy key and filament list stay in your browser.

## The page

`index.html` is self-contained -- no images, no build step, no dependencies.
It works offline and straight off disk. External requests: Google Fonts (the
type falls back without it), and -- only when you color a model -- Meshy, with
your own key, and Bambu's color list on GitHub.

The color tool's source is in `dev/`; `python dev/build.py` inlines it into
`index.html`.
