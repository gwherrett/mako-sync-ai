# Mako-Sync Design Brief

## Document Information
- **Version**: 1.0
- **Last Updated**: December 5, 2025
- **Project**: mako-sync

---

## 1. Brand Identity

### 1.1 Concept
Mako-Sync draws inspiration from two sources:
- **The Mako Shark**: Speed, precision, and sleek power - representing efficient music library synchronization
- **Montreal Expos**: Classic baseball heritage with iconic blue and red color scheme

### 1.2 Brand Personality
- **Professional**: Tool for serious music collectors and DJs
- **Efficient**: Quick, purposeful interactions
- **Trustworthy**: Reliable data handling and sync operations
- **Modern**: Contemporary dark UI with crisp typography

### 1.3 Logo
- Primary logo: Mako shark silhouette
- Located at: `src/assets/new-mako-shark-logo.png`
- Usage: Header branding, favicon consideration

---

## 2. Color System

### 2.1 Primary Palette (Expos-Inspired)

| Token | HSL Value | Hex Equivalent | Usage |
|-------|-----------|----------------|-------|
| `--expos-blue` | 218 100% 32% | #003DA5 | Primary brand, buttons, links |
| `--expos-blue-light` | 218 100% 45% | #0052E6 | Hover states, gradients |
| `--expos-red` | 355 85% 52% | #E4002B | Accent, secondary actions, alerts |
| `--expos-dark` | 218 80% 10% | #051028 | Background |
| `--expos-dark-elevated` | 218 70% 15% | #0A1F3D | Cards, elevated surfaces |

### 2.2 Semantic Tokens

```css
/* Core */
--background: 218 80% 10%;      /* Deep navy - main background */
--foreground: 0 0% 98%;          /* Near white - primary text */

/* Surfaces */
--card: 218 70% 15%;             /* Elevated card background */
--popover: 218 70% 15%;          /* Dropdown/modal background */

/* Interactive */
--primary: 218 100% 32%;         /* Expos blue - primary actions */
--secondary: 355 85% 52%;        /* Expos red - secondary actions */
--accent: 355 85% 52%;           /* Expos red - highlights */

/* States */
--muted: 218 50% 25%;            /* Disabled/inactive backgrounds */
--muted-foreground: 218 20% 65%; /* Secondary text */
--destructive: 0 84% 45%;        /* Error states */

/* Borders & Inputs */
--border: 218 50% 25%;           /* Subtle borders */
--input: 218 50% 25%;            /* Input field borders */
--ring: 218 100% 32%;            /* Focus rings */
```

### 2.3 Gradient Definitions

```css
/* Primary brand gradient - blue to red diagonal */
.expos-gradient {
  background: linear-gradient(135deg, hsl(var(--expos-blue)) 0%, hsl(var(--expos-red)) 100%);
}

/* Blue gradient - for primary CTAs */
.expos-blue-gradient {
  background: linear-gradient(135deg, hsl(var(--expos-blue)) 0%, hsl(var(--expos-blue-light)) 100%);
}

/* Red gradient - for accent elements */
.expos-red-gradient {
  background: linear-gradient(135deg, hsl(var(--expos-red)) 0%, #ff4444 100%);
}

/* Spotify integration indicator */
.spotify-gradient {
  background: linear-gradient(135deg, #1DB954 0%, #1ED760 100%);
}
```

### 2.4 Glass Effect

```css
.glass-card {
  background: rgba(0, 61, 165, 0.15);  /* Blue-tinted glass */
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 61, 165, 0.3);
}
```

---

## 3. Typography

### 3.1 Font Family
- **Primary**: Inter (Google Fonts)
- **Fallback**: system-ui, -apple-system, sans-serif
- **Weights Used**: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)

### 3.2 Type Scale
Following Tailwind CSS defaults with shadcn/ui component conventions:

| Element | Class | Size | Weight |
|---------|-------|------|--------|
| H1 | `text-4xl` | 36px | 700 |
| H2 | `text-2xl` | 24px | 600 |
| H3 | `text-xl` | 20px | 600 |
| H4 | `text-lg` | 18px | 500 |
| Body | `text-base` | 16px | 400 |
| Small | `text-sm` | 14px | 400 |
| Caption | `text-xs` | 12px | 400 |

### 3.3 Text Colors
- **Primary text**: `text-foreground` (near white)
- **Secondary text**: `text-muted-foreground` (muted blue-gray)
- **On primary surfaces**: `text-primary-foreground`
- **Links**: `text-primary` with `hover:underline`

---

## 4. Spacing & Layout

### 4.1 Border Radius
```css
--radius: 0.5rem;  /* 8px base */
/* Variants */
border-radius-lg: var(--radius);           /* 8px */
border-radius-md: calc(var(--radius) - 2px); /* 6px */
border-radius-sm: calc(var(--radius) - 4px); /* 4px */
```

### 4.2 Container
- Max width: 1400px (`2xl` breakpoint)
- Horizontal padding: 2rem (32px)
- Center aligned

### 4.3 Spacing Scale
Following Tailwind defaults (4px base unit):
- `gap-1`: 4px
- `gap-2`: 8px
- `gap-4`: 16px
- `gap-6`: 24px
- `gap-8`: 32px

---

## 5. Component Patterns

### 5.1 Buttons

**Variants:**
| Variant | Usage | Styling |
|---------|-------|---------|
| `default` | Primary actions | Blue background, white text |
| `secondary` | Secondary actions | Red background, white text |
| `outline` | Tertiary actions | Border only, transparent bg |
| `ghost` | Minimal emphasis | No border, hover shows accent |
| `destructive` | Dangerous actions | Red/destructive color |
| `link` | Inline links | Underlined text |

**Sizes:**
- `default`: h-10, px-4
- `sm`: h-9, px-3
- `lg`: h-11, px-8
- `icon`: h-10, w-10 (square)

### 5.2 Cards
- Background: `bg-card` (elevated surface)
- Border: `border-border` (subtle)
- Border radius: `rounded-lg`
- Shadow: None (rely on color contrast)

### 5.3 Tables
- Header: `bg-muted` background
- Rows: Alternating or hover states
- Borders: Subtle `border-border`

### 5.4 Forms
- Input background: `bg-background` or `bg-input`
- Border: `border-input`
- Focus ring: `ring-ring` (blue)
- Labels: `text-foreground` with `font-medium`

---

## 6. Animation & Motion

### 6.1 Transitions
- Default: `transition-colors` (color changes)
- Duration: 200ms ease-out (shadcn default)

### 6.2 Custom Animations

**Tail Splash** (Mako branding):
```css
@keyframes tail-splash {
  0%, 100% {
    opacity: 0;
    transform: translateX(0) translateY(-50%) scale(0.8);
  }
  50% {
    opacity: 1;
    transform: translateX(8px) translateY(-50%) scale(1.2);
  }
}
/* Duration: 2s, ease-in-out, infinite */
```

**Swim Shake** (Loading/processing):
```css
@keyframes swim-shake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-3px); }
  20% { transform: translateX(3px); }
  30% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  50% { transform: translateX(0); }
}
/* Duration: 0.6s, ease-in-out */
```

**Accordion** (Content expansion):
- `accordion-down`: 0.2s ease-out
- `accordion-up`: 0.2s ease-out

---

## 7. Iconography

### 7.1 Icon Library
- **Primary**: Lucide React (`lucide-react`)
- **Size Default**: 16px (via `[&_svg]:size-4` in buttons)
- **Color**: Inherits from text color

### 7.2 Common Icons
| Action | Icon |
|--------|------|
| Sync | `RefreshCw` |
| Settings | `Settings` |
| Search | `Search` |
| Filter | `Filter` |
| Success | `Check` |
| Error | `X` |
| Info | `Info` |
| Music | `Music` |

---

## 8. Dark Mode

Mako-Sync is **dark-mode only** by design:
- Optimized for extended use (DJ environments, late-night music sessions)
- Reduces eye strain when managing large music libraries
- Aligns with professional music software aesthetics (Spotify, Rekordbox, Serato)

No light mode variant is implemented or planned.

---

## 9. Third-Party Integration Styling

### 9.1 Spotify
- Use `spotify-gradient` for Spotify-related CTAs
- Spotify green: `#1DB954` to `#1ED760`
- Maintain Spotify brand guidelines for integration points

---

## 10. Accessibility Considerations

### 10.1 Color Contrast
- All text meets WCAG AA minimum (4.5:1 for normal text)
- Foreground on background: High contrast (near white on deep navy)
- Interactive elements have visible focus states

### 10.2 Focus States
- Focus ring: 2px solid `ring` color
- Offset: 2px from element
- Visible on keyboard navigation

### 10.3 Motion
- Animations are subtle and purposeful
- No auto-playing animations that could cause distraction
- Reduced motion preferences should be respected (future enhancement)

---

## 11. File Structure

```
src/
├── index.css              # CSS variables, base styles, utilities
├── components/ui/         # shadcn/ui components (customized)
├── assets/
│   └── new-mako-shark-logo.png
└── ...

tailwind.config.ts         # Tailwind configuration with design tokens
```

---

## 12. Design Principles

1. **Consistency**: Use semantic tokens exclusively, never hardcode colors
2. **Hierarchy**: Clear visual hierarchy through typography and spacing
3. **Efficiency**: Minimize clicks, maximize information density for power users
4. **Feedback**: Every action should have visible feedback (loading, success, error)
5. **Restraint**: Dark, professional aesthetic - avoid unnecessary decoration
