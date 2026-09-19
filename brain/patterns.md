# Patterns

**Coding Conventions:**
- Vanilla TypeScript. No frameworks.
- Strict typing.

**Naming:**
- CSS Custom Properties (Tokens): `--color-bg`, `--color-text-primary`, `--font-mono`, `--spacing-md`.
- JS/TS: camelCase for variables/functions, PascalCase for components/classes (if any).

**CSS Token Rules:**
- Palette restricted to: `#000000`, `#FFFFFF`, `#A3A3A3`, `#262626`, `#171717`.
- Typography: `Geist Mono` (time), `Geist` (UI).
- Scale: Fluid typography for the main time digits using `clamp()`.

**Animation Patterns:**
- Digit roll: `transform: translateY(...)`, 300–400 ms, custom `cubic-bezier` soft ease-out, no bounce. Wrap logic to always roll in one direction.
- Centiseconds: update every frame, no roll.
- Button feedback: short 120-180 ms opacity/scale. No hover-lift.
- Completion pulse: subtle scale/opacity, ~1.4s loop, ease-in-out.
- Only animate `transform` and `opacity`. Use `will-change: transform` appropriately.
