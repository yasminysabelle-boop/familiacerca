// Thin-stroke icon system — all 24×24, stroke-only, no fill by default.
// Usage: <Home size={22} color="#0d6b63" strokeWidth={1.5} />

function Svg({ size = 24, color = 'currentColor', strokeWidth = 1.5, fill = 'none', children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  )
}

export function Home({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path d="M9 22V12h6v10" />
    </Svg>
  )
}

export function Pill({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </Svg>
  )
}

export function Calendar({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </Svg>
  )
}

export function Chat({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  )
}

export function Menu({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </Svg>
  )
}

export function FileText({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </Svg>
  )
}

export function Image({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </Svg>
  )
}

export function Mic({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
    </Svg>
  )
}

export function ClipboardCheck({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="2" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

export function BarChart({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </Svg>
  )
}

export function User({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </Svg>
  )
}

export function Heart({ size, color, strokeWidth, filled = false }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} fill={filled ? color : 'none'}>
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </Svg>
  )
}

export function AlertTriangle({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  )
}

export function CheckIcon({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

export function XIcon({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

export function Clock({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Svg>
  )
}

export function Gift({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M20 12v10H4V12M22 7H2v5h20V7zM12 22V7" />
      <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
    </Svg>
  )
}

export function Info({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8h.01M12 12v4" />
    </Svg>
  )
}

export function LogOut({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </Svg>
  )
}

export function ChevronRight({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M9 18l6-6-6-6" />
    </Svg>
  )
}

export function Shield({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

export function Camera({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </Svg>
  )
}

export function ChevronLeft({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  )
}

export function Plus({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

export function Receipt({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
      <path d="M8 8h8M8 12h8M8 16h4" />
    </Svg>
  )
}

export function UserPlus({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </Svg>
  )
}

export function Bell({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  )
}

export function BookOpen({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </Svg>
  )
}

export function Phone({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
    </Svg>
  )
}

export function Mail({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </Svg>
  )
}

export function MapPin({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1118 0z" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  )
}

export function Star({ size, color, strokeWidth, filled = false }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth} fill={filled ? color : 'none'}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  )
}

export function Pencil({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

export function Trash({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
    </Svg>
  )
}

export function Users({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Svg>
  )
}

export function Eye({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

export function EyeOff({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </Svg>
  )
}

export function Settings({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </Svg>
  )
}

export function MoreVertical({ size, color, strokeWidth }) {
  return (
    <Svg size={size} color={color} strokeWidth={strokeWidth}>
      <circle cx="12" cy="5"  r="1" fill={color} stroke="none" />
      <circle cx="12" cy="12" r="1" fill={color} stroke="none" />
      <circle cx="12" cy="19" r="1" fill={color} stroke="none" />
    </Svg>
  )
}
