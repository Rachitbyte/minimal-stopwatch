# UI/UX Design Brief

## Design Tokens

### Color Palette
- Background: `#000000`
- Text Primary: `#FFFFFF`
- Text Secondary: `#A3A3A3`
- Borders / Surfaces: `#262626`
- Raised Surface (e.g., modals): `#171717`

### Typography
- **Time Display:** `Geist Mono` (tabular figures, fixed-width cells, fluid `clamp()` sizing).
- **UI Elements:** `Geist` (sentence case, small).
- **Fallbacks:** System monospaces and sans-serifs.

### Motion
- **Digit Roll:** `transform: translateY()`, 300-400ms, soft custom `cubic-bezier` ease-out.
- **Button Feedback:** 120-180ms opacity/scale response on tap.
- **Countdown Pulse:** 1.4s loop, ease-in-out scale & opacity.
- **Reduced Motion:** Replace rolls/scales with simple opacity fades.

## Component Styles
- **Buttons:** Pill shape, 1px `#262626` border. Primary = White fill / Black text. Secondary = Transparent fill / White text / Border. One consistent border-radius.

## Layouts
- **Mobile Portrait:** Segmented control top -> Centered large time -> Controls bottom.
- **Landscape / Desktop:** Same logical flow, but time is scaled up, controls beside/below. Max content width.

## Wireframe (Mobile)
```text
+-----------------------+
|                       |
|  [ SW | CD | CLK ]    |
|                       |
|                       |
|                       |
|     00:12:30.45       |
|                       |
|                       |
|                       |
|                       |
|  ( Reset ) ( Start )  |
|                       |
+-----------------------+
```
