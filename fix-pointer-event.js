const fs = require('fs');
let code = fs.readFileSync('components/dashboard/toml-dashboard.tsx', 'utf8');

code = code.replace(
  /const handlePointerMove = \\(ev: PointerEvent\\) => \\{\n\\s*const deltaX = ev\\.clientX - startX;\n\\s*const deltaY = ev\\.clientY - startY;\n\\s*const targetCard = \\(e\\.currentTarget as HTMLElement\\)\\.closest\\('\\.group\\\\\\\\/card'\\);\n\\s*const cellW = targetCard \\? targetCard\\.getBoundingClientRect\\(\\)\\.width \/ initialCol : 120;\n\\s*const colDiff = Math\\.round\\(deltaX \/ cellW\\);/,
  \`const targetCard = (e.currentTarget as HTMLElement).closest('.group\\\\/card');
          const cellW = targetCard ? targetCard.getBoundingClientRect().width / initialCol : 120;

          const handlePointerMove = (ev: PointerEvent) => {
            const deltaX = ev.clientX - startX;
            const deltaY = ev.clientY - startY;
            const colDiff = Math.round(deltaX / cellW);\`
);

fs.writeFileSync('components/dashboard/toml-dashboard.tsx', code);
