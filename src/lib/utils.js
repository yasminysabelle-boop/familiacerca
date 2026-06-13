export const getTodayPR = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })

export const getDatePR = (date) =>
  new Date(date).toLocaleDateString('en-CA', { timeZone: 'America/Puerto_Rico' })
