# Diseño de referencia v0 — Dashboard FamiliaCerca

Este archivo contiene el código generado por v0.dev como REFERENCIA VISUAL/ESTRUCTURAL.
Está en TypeScript + Tailwind + lucide-react + next/image.
Debe TRADUCIRSE a: JavaScript (.jsx) + estilos inline + Icons.jsx local + <img> normal.

## Paleta (de globals.css de v0) — ya coincide con la tuya:
```
teal #087F70 | teal-light #A8E5D6 | coral #E9826E | emergency #D9534F
cream #F8F4ED | peach #FBEAE4 | gold #D99A18 | purple #7566D8 | text #334155
muted-foreground #7C8698 | border #ECE6DA | card #FFFFFF
```

## patient-card.tsx
```tsx
import Image from 'next/image'
import { Heart, Pill, CalendarCheck, Users, MoreHorizontal } from 'lucide-react'

const stats = [
  { icon: Pill, title: 'Medicamentos', sub: 'al día' },
  { icon: CalendarCheck, title: 'Rutina', sub: 'completada' },
  { icon: Users, title: '4 familiares', sub: 'conectados' },
]

export function PatientCard() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg"
      style={{ background: 'linear-gradient(150deg, #16a892 0%, #0a8878 45%, #087f70 100%)' }}
      aria-label="Estado de Deborah"
    >
      {/* Heart watermark */}
      <Heart
        className="pointer-events-none absolute -bottom-6 -right-6 size-48 text-white/10"
        fill="currentColor"
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl ring-2 ring-white/40">
          <Image
            src="/images/deborah.png"
            alt="Foto de Deborah"
            width={80}
            height={80}
            className="size-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold leading-tight">
              Deborah
              <Heart className="size-5 text-coral" fill="currentColor" aria-hidden="true" />
            </h1>
            <button type="button" aria-label="Más opciones" className="text-white/70">
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-1 text-pretty text-[15px] leading-snug text-white/90">
            Hoy está tranquila y de buen ánimo
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#4ade80] ring-2 ring-[#4ade80]/30" aria-hidden="true" />
            <span className="text-sm font-medium text-white/90">Todo bajo control</span>
          </div>
        </div>
      </div>

      <div className="relative mt-5 flex items-center justify-between border-t border-white/15 pt-4">
        {stats.map(({ icon: Icon, title, sub }, i) => (
          <div key={title} className="flex flex-1 items-center gap-2">
            {i > 0 && <span className="mr-1 h-8 w-px bg-white/15" aria-hidden="true" />}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Icon className="size-4 text-white" aria-hidden="true" />
            </span>
            <span className="text-[13px] font-semibold leading-tight">
              {title}
              <span className="block font-normal text-white/80">{sub}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

## attention-card.tsx
```tsx
import { Bell, Pill, Clock, AlertCircle, CalendarClock, ChevronRight, Check } from 'lucide-react'

export function AttentionCard() {
  return (
    <section
      className="overflow-hidden rounded-3xl bg-peach shadow-sm"
      aria-label="Necesita tu atención"
    >
      <div className="p-5">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-coral" aria-hidden="true" />
          <h2 className="font-semibold text-coral">Necesita tu atención</h2>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-coral)_15%,white)]">
            <Pill className="size-7 text-coral" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-foreground">Losartán 50mg</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
              Hoy 8:00 PM
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-coral">
              <AlertCircle className="size-4" aria-hidden="true" />
              Pendiente de confirmar
            </p>
          </div>

          <button
            type="button"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-coral px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[color-mix(in_oklab,var(--color-coral)_88%,black)]"
          >
            Confirmar
            <Check className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-between border-t border-coral/15 bg-[color-mix(in_oklab,var(--color-peach)_60%,white)] px-5 py-3 text-sm"
      >
        <span className="flex items-center gap-2 font-medium text-muted-foreground">
          <CalendarClock className="size-4" aria-hidden="true" />
          Ventana: 7:00 PM · 9:00 PM
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
    </section>
  )
}
```

## recent-activity.tsx
```tsx
import Image from 'next/image'
import { Heart, Check, MessageSquare } from 'lucide-react'

type Activity = {
  avatar: string
  name: string
  action: string
  detail?: string
  time: string
  status: 'check' | 'note'
}

const activities: Activity[] = [
  {
    avatar: '/images/rosa.png',
    name: 'Rosa',
    action: 'confirmó el desayuno',
    time: 'Hace 30 min',
    status: 'check',
  },
  {
    avatar: '/images/carlos.png',
    name: 'Carlos',
    action: 'registró el Atenolol 25mg',
    time: 'Hoy · 8:05 AM',
    status: 'check',
  },
  {
    avatar: '/images/ana.png',
    name: 'Ana',
    action: 'agregó una nota',
    detail: '"Se sintió mejor después del paseo"',
    time: 'Ayer · 7:40 PM',
    status: 'note',
  },
]

export function RecentActivity() {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm" aria-label="Actividad reciente">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <Heart className="size-5 text-teal" aria-hidden="true" />
          Actividad reciente
        </h2>
        <button type="button" className="text-sm font-semibold text-teal">
          Ver todo
        </button>
      </div>

      <ul className="mt-4 flex flex-col gap-4">
        {activities.map((a) => (
          <li key={a.name} className="flex items-start gap-3">
            <Image
              src={a.avatar || '/placeholder.svg'}
              alt={`Foto de ${a.name}`}
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-snug text-foreground">
                <span className="font-semibold">{a.name}</span> {a.action}
              </p>
              {a.detail && (
                <p className="text-[15px] italic leading-snug text-muted-foreground">{a.detail}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">{a.time}</p>
            </div>
            {a.status === 'check' ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-teal-light)_45%,white)]">
                <Check className="size-4 text-teal" aria-hidden="true" />
              </span>
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="size-4 text-muted-foreground" aria-hidden="true" />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

## pets-card.tsx
```tsx
import Image from 'next/image'
import { MessageCircle, ChevronRight } from 'lucide-react'

export function PetsCard() {
  return (
    <section
      className="relative overflow-hidden rounded-3xl p-4 shadow-sm"
      style={{ backgroundColor: 'color-mix(in oklab, #7566d8 12%, white)' }}
      aria-label="Asistente Milo y Luna"
    >
      <div className="flex items-center gap-3">
        <Image
          src="/images/milo-luna.png"
          alt="Milo el perro y Luna el gato"
          width={96}
          height={96}
          className="size-24 shrink-0 object-contain"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-serif text-[17px] font-semibold leading-snug text-purple">
              Milo y Luna están aquí para ayudar
            </p>
            <ChevronRight className="mt-1 size-5 shrink-0 text-purple" aria-hidden="true" />
          </div>
          <p className="mt-1 text-sm leading-snug text-muted-foreground">
            ¿Necesitas algo sobre el cuidado de Deborah?
          </p>
          <button
            type="button"
            className="mt-3 flex items-center gap-2 rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Hablar con Milo y Luna
          </button>
        </div>
      </div>
    </section>
  )
}
```

## quick-actions.tsx
```tsx
import { Zap, Pill, Siren, MessageSquareText, Video } from 'lucide-react'

const actions = [
  { icon: Pill, label: 'Medicamentos', color: 'text-teal' },
  { icon: Siren, label: 'Emergencia', color: 'text-emergency', emphasize: true },
  { icon: MessageSquareText, label: 'Chat familiar', color: 'text-teal' },
  { icon: Video, label: 'Videollamada', color: 'text-teal', emphasize: true },
]

export function QuickActions() {
  return (
    <section aria-label="Acciones rápidas">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <Zap className="size-5 text-teal" fill="currentColor" aria-hidden="true" />
        Acciones rápidas
      </h2>

      <div className="mt-3 grid grid-cols-4 gap-3">
        {actions.map(({ icon: Icon, label, color, emphasize }) => (
          <button
            key={label}
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 shadow-sm"
          >
            <Icon className={`size-6 ${color}`} aria-hidden="true" />
            <span
              className={`text-center text-xs leading-tight ${
                emphasize ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'
              }`}
            >
              {label}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
```

## header.tsx
```tsx
import Image from 'next/image'
import { Bell, HeartHandshake } from 'lucide-react'

export function Header() {
  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-teal-light)_60%,white)]">
          <HeartHandshake className="size-5 text-teal" aria-hidden="true" />
        </span>
        <span className="font-serif text-2xl font-semibold tracking-tight">
          <span className="text-teal">Familia</span>
          <span className="text-coral">Cerca</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative flex size-11 items-center justify-center rounded-full bg-card shadow-sm"
          aria-label="Notificaciones, 2 sin leer"
        >
          <Bell className="size-5 text-foreground" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-coral text-[11px] font-bold text-white">
            2
          </span>
        </button>
        <button
          type="button"
          className="size-11 overflow-hidden rounded-full ring-2 ring-white shadow-sm"
          aria-label="Tu perfil"
        >
          <Image
            src="/images/user.png"
            alt="Tu foto de perfil"
            width={44}
            height={44}
            className="size-full object-cover"
          />
        </button>
      </div>
    </header>
  )
}
```

## bottom-nav.tsx
```tsx
import { Home, Heart, Users, ClipboardList, MoreHorizontal } from 'lucide-react'

const items = [
  { icon: Home, label: 'Inicio', active: true },
  { icon: Heart, label: 'Cuidado' },
  { icon: Users, label: 'Familia' },
  { icon: ClipboardList, label: 'Historia' },
  { icon: MoreHorizontal, label: 'Más' },
]

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur"
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-6 pb-6 pt-3">
        {items.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            type="button"
            aria-current={active ? 'page' : undefined}
            className="flex flex-col items-center gap-1"
          >
            <span
              className={`flex size-9 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-teal text-white' : 'text-muted-foreground'
              }`}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <span className={`text-[11px] ${active ? 'font-semibold text-teal' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
```

## app/page.tsx (cómo se ensamblan)
```tsx
import { Header } from '@/components/dashboard/header'
import { PatientCard } from '@/components/dashboard/patient-card'
import { AttentionCard } from '@/components/dashboard/attention-card'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { PetsCard } from '@/components/dashboard/pets-card'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { BottomNav } from '@/components/dashboard/bottom-nav'

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-28 pt-4">
        <Header />
        <div className="mt-4 flex flex-col gap-4">
          <PatientCard />
          <AttentionCard />
          <RecentActivity />
          <PetsCard />
          <QuickActions />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
```
