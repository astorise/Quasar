# Design: Web Components & GSAP Choreography

## 1. Component Lifecycle & Data Binding
Every Quasar visual widget inherits from a base `QuasarWidget` class extending `HTMLElement`.

1. **Initialization:** The component reads its configuration attributes mapped from the JSON dashboard manifest (e.g., `metric="dau"`, `type="line"`).
2. **Subscription:** The widget registers itself to the nearest parent `<quasar-provider>`.
3. **Stream Handling:** When the provider receives an updated materialized view via polling or QUIC/WebSocket CDC broadcast, it propagates the slice of JSON data to the targeted widget via a reactive `data` setter.

## 2. Rendering & Animation Performance (GSAP)
To avoid jarring visual jumps during real-time data updates, layout updates are split into two cycles:
- **DOM Mutate:** The SVG points or progress bars are updated in memory.
- **GSAP Transition:** GSAP interpolates the properties (e.g., `stroke-dashoffset`, CSS heights, path definitions via `attr: { d: newPath }`) directly within the browser's `requestAnimationFrame` loop, ensuring a locked 60+ FPS experience even during heavy ingestion spikes.

## 3. Tailwind Design System Alignment
Tailwind will compile down to a utility-first bundle. Encapsulated custom elements will leverage standard CSS variables or Tailwind's utility classes to ensure a seamless dark-mode/light-mode theme synced with the VS Code engineering environment.