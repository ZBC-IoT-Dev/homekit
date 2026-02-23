# Smart Home Dashboard Redesign Plan

## Objective
Remake the current smart home dashboard to achieve a modern, clean, and polished "next-level smart home" aesthetic (inspired by modern iOS/HomeKit design), while keeping all existing functionality (TOML-based dynamic cards with drag&drop, toggles, sensors, charts).

## 1. Global Theme & CSS Updates (`app/globals.css`)
- **Border Radius**: Increase the base `--radius` (currently `0.35rem`) to `0.75rem` or `1rem` for softer, rounded components.
- **Shadows**: Replace the existing brutalist/flat drop shadows (e.g., `0px 2px 0px 0px`) with soft, multi-layered blurred shadows to create an elegant floating effect for cards.
- **Colors**: Adjust the light mode background to be a distinct soft gray (`#f4f4f5`) while keeping the card background pure white (`#ffffff`). This provides a clear contrast hierarchy without hard borders.

## 2. Card Components Redesign (`components/ui/card.tsx`)
- **Borders & Shadows**: Let the new soft shadows and contrast define the cards. Make borders very subtle or remove them entirely on the outer card container.
- **Card Headers**: 
  - Minimize the prominence of the edit/drag/delete action buttons. Convert them into a clean horizontal group of ghost icon buttons (`hover:bg-muted` style).
  - Soften the visual weight of the card titles and badges.

## 3. Interactive Tiles (Sensors, Toggles, Charts)
In `components/dashboard/toml-dashboard.tsx`:
- **Toggles**: Transform standard switches into full interactive tiles. When active, give the tile a subtle glow, background color shift (e.g., light accent background), and change the icon color to indicate the "ON" state.
- **Sensors**: Redesign the layout to feature contextual icons (`lucide-react` icons like `Thermometer` for temperature, `Droplets` for humidity). Place the label at the top, the value in the center, and the unit styled gracefully next to it.
- **Charts**: Remove harsh grid lines. Implement smooth curves (`type="monotone"`) and soft vertical gradient fills for the area charts. Round the corners of the chart container.
- **Tile Backgrounds**: Give these inner items a pure white background (if on a gray card) or slightly muted background (if on a white card) with a delicate border, making them look like discrete interactive modules.

## 4. Animations & Interactivity
- Implement `framer-motion` for smooth layout transitions when adding, removing, or dragging cards.
- Add an `active:scale-[0.98]` class to interactive tiles (toggles) to provide satisfying physical feedback when pressed.

## Summary
These changes will completely transform the dashboard from a utility-focused interface to a premium, polished consumer-grade experience, directly addressing the user's vision of a "next-level smart home."