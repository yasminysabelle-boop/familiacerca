import posthog from 'posthog-js'

const key = import.meta.env.VITE_POSTHOG_KEY

if (key) {
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
  })
}

export function track(event, props = {}) {
  if (!key) return
  posthog.capture(event, props)
}

export function identify(userId, traits = {}) {
  if (!key) return
  posthog.identify(userId, traits)
}
