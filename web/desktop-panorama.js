(() => {
  if (!window.matchMedia("(min-width: 1200px)").matches) return;

  const art = document.querySelector(".hero-art");
  if (!art) return;

  art.innerHTML = `
    <svg class="desktop-panorama-svg" viewBox="0 0 1600 360" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="travonSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#dff8fa"/>
          <stop offset="100%" stop-color="#f7fcfc"/>
        </linearGradient>
        <linearGradient id="travonWater" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#9fe0e4"/>
          <stop offset="100%" stop-color="#78ced4"/>
        </linearGradient>
      </defs>

      <rect width="1600" height="360" fill="url(#travonSky)"/>
      <circle cx="1490" cy="72" r="24" fill="#ffd45a"/>

      <g fill="#ffffff" opacity=".9">
        <ellipse cx="120" cy="86" rx="32" ry="11"/>
        <ellipse cx="145" cy="88" rx="20" ry="8"/>
        <ellipse cx="700" cy="74" rx="35" ry="12"/>
        <ellipse cx="730" cy="77" rx="22" ry="9"/>
        <ellipse cx="1190" cy="94" rx="29" ry="10"/>
        <ellipse cx="1214" cy="96" rx="18" ry="7"/>
        <ellipse cx="1450" cy="108" rx="35" ry="12"/>
        <ellipse cx="1482" cy="110" rx="22" ry="9"/>
      </g>

      <path d="M0 240 L85 168 L150 222 L225 155 L315 230 L400 184 L480 230 L565 170 L650 232 L760 172 L850 232 L960 158 L1060 230 L1160 178 L1250 226 L1360 146 L1450 224 L1540 166 L1600 214 L1600 270 L0 270 Z" fill="#8fd4d8"/>
      <path d="M0 250 L110 202 L190 245 L280 198 L370 248 L470 210 L560 250 L690 202 L790 246 L900 204 L1010 250 L1130 210 L1230 246 L1350 196 L1465 242 L1550 204 L1600 228 L1600 274 L0 274 Z" fill="#70c3ca" opacity=".95"/>

      <path d="M0 236 C240 218 420 238 610 224 C820 210 1000 238 1190 224 C1380 212 1510 226 1600 216 L1600 272 L0 272 Z" fill="url(#travonWater)"/>
      <path d="M0 266 C190 242 350 272 520 254 C720 234 900 272 1080 252 C1260 234 1430 264 1600 246 L1600 306 L0 306 Z" fill="#b6e76d"/>

      <g fill="#63a84c">
        <ellipse cx="52" cy="246" rx="16" ry="38"/>
        <ellipse cx="90" cy="252" rx="12" ry="29"/>
        <ellipse cx="350" cy="252" rx="14" ry="32"/>
        <ellipse cx="580" cy="246" rx="15" ry="36"/>
        <ellipse cx="900" cy="250" rx="13" ry="30"/>
        <ellipse cx="1195" cy="246" rx="15" ry="35"/>
        <ellipse cx="1545" cy="246" rx="16" ry="38"/>
      </g>

      <g fill="#6bbfc5" opacity=".92">
        <rect x="1420" y="184" width="22" height="56" rx="2"/>
        <rect x="1448" y="166" width="28" height="74" rx="2"/>
        <rect x="1482" y="178" width="20" height="62" rx="2"/>
        <rect x="1508" y="154" width="24" height="86" rx="2"/>
        <rect x="1538" y="172" width="30" height="68" rx="2"/>
      </g>

      <path d="M0 286 C210 275 390 300 580 286 C780 272 965 300 1160 286 C1350 273 1490 292 1600 282 L1600 360 L0 360 Z" fill="#4f5966"/>
      <path d="M0 309 C220 297 390 318 585 305 C790 292 965 318 1165 306 C1350 294 1490 312 1600 304" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-dasharray="26 22"/>

      <g transform="translate(1275 242)">
        <rect x="18" y="25" width="96" height="42" rx="14" fill="#ef4740"/>
        <path d="M34 25 L54 3 H82 L100 25Z" fill="#ef4740"/>
        <rect x="54" y="9" width="24" height="19" rx="3" fill="#24313f"/>
        <circle cx="42" cy="69" r="14" fill="#24313f"/>
        <circle cx="92" cy="69" r="14" fill="#24313f"/>
        <circle cx="42" cy="69" r="6" fill="#f5f7f9"/>
        <circle cx="92" cy="69" r="6" fill="#f5f7f9"/>
        <rect x="53" y="-7" width="33" height="10" rx="2" fill="#2d633d"/>
        <rect x="60" y="-16" width="19" height="9" rx="2" fill="#315b38"/>
      </g>
    </svg>`;
})();
