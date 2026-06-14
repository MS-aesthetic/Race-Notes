# Race Notes - Codebase Knowledge & Documentation

This document serves as a detailed technical reference for the **Race Notes** PWA. It is designed to assist with future development, feature additions, and maintenance of the codebase.

## 1. Tech Stack Overview
- **Framework**: React 19 (via Vite 6)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: TailwindCSS v4 with custom dark-mode theme variables in `index.css`
- **Icons**: Material Symbols Outlined (via Google Fonts in CSS) & `lucide-react`
- **Animations**: Framer Motion (`motion/react`) for fluid tab transitions
- **PWA Support**: `vite-plugin-pwa` for manifest generation, Service Worker offline precaching, and Android installability.
- **Hosting**: Configured for Netlify (`netlify.toml` included).

---

## 2. Architecture & State Management

The application is structured as a single-page React app without a dedicated routing library (like react-router). Instead, navigation is handled via conditional rendering controlled by the `activeTab` state in `App.tsx`.

### Global State (in `App.tsx`)
State is managed entirely at the top level (`App.tsx`) and passed down as props to the view components.
- `setup`: The currently active `Setup` configuration.
- `savedSetups`: An array of all saved `Setup` configurations.
- `weekends`: An array of `RaceWeekend` objects, each containing multiple `SessionRecord` logs.
- `activeSession`: The live data being entered for the current track session before it is finalized into a `RaceWeekend`.

### Data Persistence
To ensure a dirt racer doesn't lose their data trackside if they accidentally close the browser, all core state is **durably synced to `localStorage`**.
- `race_notes_setup`
- `race_notes_saved_setups`
- `race_notes_weekends`
- `race_notes_active_session`

The `useEffect` in `App.tsx` initializes state from `localStorage` on load, and custom handler functions (e.g., `saveSetup`, `handleUpdateSession`) update both React state and `localStorage` simultaneously.

---

## 3. Core Domain Models (`src/types.ts`)

The application heavily relies on detailed TypeScript interfaces tailored to dirt track physics and racing terminology.

- **`CornerSetup`**: The most granular model. Represents the physical setup of a single wheel corner (LF, RF, LR, RR). It includes properties for springs, shocks, load weights, c-to-c (center-to-center) measurements, caster, camber, tire compounds, sizes, pressures, and rear-specific metrics like birdcage holes, pull bar angles, and droop.
- **`Setup`**: Represents an entire car's configuration at a point in time. It contains metadata (chassis, track, date) and four `CornerSetup` objects, plus global settings like gear ratio and overall stagger.
- **`ActiveSession` / `SessionRecord`**: Logs for on-track performance.
  - **Metrics**: Best lap, average lap, finish position, max RPM, leader gap.
  - **Diagnostics**: Driver feedback on the car's handling at three points in the corner: `cornerEntry`, `centerApex`, `cornerExit` (values are `TIGHT`, `NEUTRAL`, or `LOOSE`).
  - **Tires & Pressures**: Hot/cold tire readings.
- **`RaceWeekend`**: A grouping container for multiple `SessionRecord`s (e.g., Heat 1, Qualifying, A-Main) that occur at the same event.

---

## 4. Main UI Components (`src/components/`)

- **`DashboardView.tsx`**: The landing screen. Displays an accordion-style log of all `RaceWeekends` and their nested sessions. Features a "Current Active Setup" summary card highlighting the 4 corner tire pressures.
- **`SetupView.tsx`**: The comprehensive engineering interface for creating, editing, and cloning car setups. Uses accordion panels for each of the 4 corners to keep the UI manageable. Auto-saves changes.
- **`SessionsView.tsx`**: The live logging view used during or immediately after a race. Allows the user to input lap times, diagnostics, and tire pressure adjustments.
- **`ExportView.tsx`**: Responsible for formatting and exporting the data (likely for sharing with crew chiefs or printing).
- **`QuickReferenceView.tsx`**: A reference guide tab for the user.

---

## 5. Styling & Theming

The UI is built with a custom "Motorsport Telemetry" dark-theme design system.
- **CSS Variables** (`src/index.css`): Variables map to Tailwind utilities (e.g., `--color-surface: #131313`, `--color-primary: #ffb3ac`).
- **Typography**: Inter (sans-serif), Space Grotesk (display headers), JetBrains Mono (data/telemetry numbers).
- **Effects**: Features custom `.scanline` animations and `.status-glow-*` classes to mimic physical telemetry dashboards.
- **Layout**: The app is constrained to `max-w-2xl` centrally, optimizing it heavily for mobile/tablet portrait usage (which is how it will be used in the pits).

---

## 6. PWA Integration Details

- **Plugin**: `vite-plugin-pwa` handles the heavy lifting.
- **Caching Strategy**: `generateSW` mode is active, meaning the service worker (`dist/sw.js`) automatically precaches all JS, CSS, HTML, and icon assets on build, guaranteeing 100% offline functionality.
- **Manifest**: Generated dynamically with `theme_color` `#131313` and `standalone` display mode so it launches without browser UI on Android.
- **Icons**: Located in `public/`. Sized at `192x192`, `512x512`, and a `maskable-icon.png` (with 15% safe padding) for adaptive Android launcher icons.

---

## 7. Future Development Considerations

1. **State Management Scaling**: If the app grows to include more views, migrating from `App.tsx` state passing to React Context or a lightweight store like Zustand might be necessary to avoid prop-drilling.
2. **Cloud Sync**: Currently, data is limited to device `localStorage`. Implementing Firebase or Supabase to sync data across devices (e.g., driver's phone and crew chief's iPad) would be a highly valuable feature.
3. **Data Export**: Ensure `ExportView` can generate standardized PDFs or CSVs for offline archiving.
4. **Routing**: As the application grows, introducing `react-router` could allow users to bookmark specific setups or sessions. Ensure `netlify.toml` redirection remains intact if client-side routing is added.
