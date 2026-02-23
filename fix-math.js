const fs = require('fs');
let code = fs.readFileSync('components/dashboard/toml-dashboard.tsx', 'utf8');

code = code.replace(
  "const deltaY = ev.clientY - startY;",
  "const deltaY = ev.clientY - startY;\n            const targetCard = (e.currentTarget as HTMLElement).closest('.group\\\\/card');\n            const cellW = targetCard ? targetCard.getBoundingClientRect().width / initialCol : 120;"
);

code = code.replace(
  "const colDiff = Math.round(deltaX / 120);",
  "const colDiff = Math.round(deltaX / cellW);"
);

code = code.replace(
  "const rowDiff = Math.round(deltaY / 120);",
  "const rowDiff = Math.round(deltaY / 136);" // 120px + 16px gap
);

fs.writeFileSync('components/dashboard/toml-dashboard.tsx', code);
