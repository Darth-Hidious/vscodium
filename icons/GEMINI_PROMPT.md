# PRISM Desktop Logo — Gemini SVG Prompt

Use this prompt with Google Gemini to generate the animated SVG logo.

---

## Prompt

Create an animated SVG logo for "PRISM Desktop", a materials science IDE by MARC27. The design is inspired by Pink Floyd's "The Dark Side of the Moon" album art — a triangular prism dispersing white light into a spectrum — but modernized, minimal, and suitable as a software application icon.

### Design Specifications

**The Prism:**
- A clean, geometric equilateral triangle (the prism), outlined with a thin stroke
- The triangle should have a very subtle translucent fill — almost glass-like, with a faint blue-white gradient to suggest optical glass
- Positioned center-left in the composition
- No solid fill — it should feel transparent and scientific

**The Light Beam (incoming):**
- A single thin white beam enters from the left edge, hitting the left face of the prism
- The beam should be crisp and bright white with a subtle glow/bloom effect

**The Dispersion (outgoing):**
- On the right side of the prism, the white beam fans out into a full visible spectrum
- Colors spread at increasing angles: violet, indigo, blue, cyan, green, yellow, orange, red
- Each spectral line should be a thin beam radiating outward at slightly different angles
- The beams should spread wider as they travel right, creating a fan/cone shape
- Each color beam should have a soft glow matching its color

**Animation (CSS keyframes, smooth and looping):**

1. **Phase 1 — Beam Entry (0% to 30%):** The white beam draws in from left to right, like a laser turning on. It travels across the dark space and hits the prism face. Ease-in timing.

2. **Phase 2 — Prism Activation (30% to 45%):** When the beam hits the prism, the triangle subtly brightens/pulses — a brief flash suggesting refraction is happening inside. The prism's edges glow faintly.

3. **Phase 3 — Dispersion (45% to 80%):** The spectral beams emerge from the right face of the prism, fanning out one by one from violet to red. Each beam draws outward with a slight stagger (50ms between each). The beams should have a gentle shimmer/pulse as they extend.

4. **Phase 4 — Steady State (80% to 95%):** All beams are fully extended. A subtle continuous shimmer runs along the spectral beams — a traveling highlight that moves left-to-right along each beam, staggered. This creates a "flowing light" effect.

5. **Phase 5 — Fade and Reset (95% to 100%):** Everything gently fades out, then the loop restarts seamlessly.

**Total animation duration:** 4 seconds, infinite loop.

### Style Rules

- **Background:** Transparent (this goes on a dark background in the app, so design for dark mode)
- **Vignette:** Add a subtle radial gradient overlay — edges darken to transparent, center stays clear. This creates the vignette/cinematic feel when placed on a dark surface
- **Line style:** Clean vector lines, no hand-drawn feel. Scientific precision
- **Color palette for spectrum:** Use actual visible light wavelength colors:
  - Violet: #8B00FF
  - Indigo: #4B0082  
  - Blue: #0000FF
  - Cyan: #00BFFF
  - Green: #00FF00
  - Yellow: #FFD700
  - Orange: #FF8C00
  - Red: #FF0000
- **Glow effects:** Use SVG filters (feGaussianBlur + feComposite) for the bloom/glow on beams
- **Size:** 512x512 viewBox, scalable
- **No text** in the SVG — the logo is icon-only

### Technical Requirements

- Pure SVG with embedded CSS animations (no JavaScript)
- Use `<animate>`, `<animateTransform>`, or CSS `@keyframes` — whichever produces smoother results
- All animations should use `ease-in-out` or `cubic-bezier` timing for organic feel
- The SVG must be self-contained (no external dependencies)
- Optimize for crisp rendering at sizes from 16x16 (favicon) to 512x512 (splash screen)
- At small sizes (16-32px), the animation can be disabled — just show the static dispersed state

### Reference

Think of it as: "What if the Dark Side of the Moon album cover was redesigned by Dieter Rams as a software icon, then animated by a physicist who loves clean CSS transitions."

### Deliverables

1. **prism-logo-animated.svg** — Full animated version (512x512)
2. **prism-logo-static.svg** — Static version showing fully dispersed state (for favicons, small icons)
3. **prism-logo-dark.svg** — Version with a built-in dark circular background (for places without dark mode)

---

## Usage in PRISM Desktop

- **App icon (macOS/Windows/Linux):** Static version, exported to .icns/.ico/.png
- **Splash screen:** Animated version, plays once on app launch
- **About dialog:** Animated version, looping
- **Loading states:** Animated version, looping
- **Favicon:** Static version at 16x16 / 32x32
