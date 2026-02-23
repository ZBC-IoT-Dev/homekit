const fs = require('fs');
let code = fs.readFileSync('components/dashboard/toml-dashboard.tsx', 'utf8');

// Update Grid Auto Rows to a fixed size so vertical resize behaves predictably
code = code.replace(
  /grid-flow-row-dense" style={{ gridAutoRows: 'minmax\\(120px, auto\\)' }}/,
  \`grid-flow-row-dense" style={{ gridAutoRows: '120px' }}\`
);

// Allow content to scroll inside if it doesn't fit the row span
code = code.replace(
  /<CardContent className="flex-1 px-5 pb-5 flex flex-col relative">/,
  \`<CardContent className="flex-1 px-5 pb-5 flex flex-col relative overflow-y-auto overflow-x-hidden no-scrollbar">\`
);

// Update deltaY calculation for rowDiff to match the fixed row height (120px + 16px gap = 136px)
code = code.replace(
  /const rowDiff = Math.round\\(deltaY \/ 120\\);/,
  \`const rowDiff = Math.round(deltaY / 136);\`
);

// Better deltaX scaling for responsive columns
code = code.replace(
  /const colDiff = Math.round\\(deltaX \/ 120\\);/,
  \`const rect = (ev.currentTarget as HTMLElement).closest('.group\\\\/card')?.getBoundingClientRect();
            const colWidth = rect ? rect.width / initialCol : 120;
            const colDiff = Math.round(deltaX / colWidth);\`
);

// Let's add the fix for pointer event type
// It's already PointerEvent because of my sed, but let's make sure ev.currentTarget works.
// Wait, ev is cast to 'any' implicitly if the type is not full, but I did sed:
// const handlePointerMove = (ev: PointerEvent) => {
// We can just cast it.

// Wait, the icon for resizing.
// In the current code, the onPointerDown is attached to the resize handle div.
code = code.replace(
  /const handlePointerMove = \\(ev: PointerEvent\\) => \\{/,
  \`const handlePointerMove = (ev: PointerEvent) => {\` // Noop, just checking it exists
);

fs.writeFileSync('components/dashboard/toml-dashboard.tsx', code);
console.log('Fixed resize!');
