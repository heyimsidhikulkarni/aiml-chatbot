const base = {
  width: 44,
  height: 44,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false"
};

export const LogoIcon = ({ size = 34 }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" focusable="false">
    <circle cx="14" cy="13" r="7" fill="currentColor" />
    <circle cx="28" cy="15" r="5" fill="currentColor" />
    <circle cx="12" cy="28" r="5" fill="currentColor" />
    <circle cx="26" cy="29" r="7" fill="currentColor" />
  </svg>
);

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h8a2.5 2.5 0 0 1 2.5 2.5v4A2.5 2.5 0 0 1 14 13H9l-3.5 3v-3A2.5 2.5 0 0 1 3.5 10.5z" />
    <path d="M16.5 9H18a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2 2.4V21l-3.5-3h-4a2.5 2.5 0 0 1-2.2-1.3" />
    <path d="M7 8.2h6M7 10.4h3.5" />
  </svg>
);

export const CompanionIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="13" r="7" />
    <path d="M6.2 8.6 5 4.8l3.6 1.6M17.8 8.6 19 4.8l-3.6 1.6" />
    <circle cx="9.5" cy="12" r=".6" fill="currentColor" />
    <circle cx="14.5" cy="12" r=".6" fill="currentColor" />
    <path d="M10.5 15.2c.9.7 2.1.7 3 0" />
  </svg>
);

export const HeartIcon = () => (
  <svg {...base}>
    <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
    <path d="M8 10.2c.2-.9.9-1.5 1.8-1.6" />
  </svg>
);

export const StepsIcon = () => (
  <svg {...base}>
    <path d="M3.5 20h4.2v-4.2H12v-4.3h4.3V7.3h4.2" />
    <path d="M14.5 4.5l2-1.5 1.5 2" />
    <path d="M16.5 3v3.5" />
  </svg>
);

export const LayersIcon = () => (
  <svg {...base}>
    <path d="M12 4 3.5 8.5 12 13l8.5-4.5z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
    <path d="m3.5 16.2 8.5 4.5 8.5-4.5" />
  </svg>
);

export const ShieldIcon = () => (
  <svg {...base}>
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.3 7 9 4.1-1.7 7-4.8 7-9V6z" />
    <path d="M12 15.2s-3-1.8-3-4a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 2.2-3 4-3 4z" />
  </svg>
);
