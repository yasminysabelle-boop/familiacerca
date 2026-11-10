-- Resumen semanal por correo (nov 2026): cada domingo a las 22:00 UTC
-- (6 p. m. hora del Este de EE. UU.). Requiere haber desplegado antes la
-- función send-weekly-summary. Copia el mismo llamado del resumen diario
-- (mismas llaves y secreto), solo cambia la función y el horario.
select cron.unschedule('fc-weekly-summary') where exists (select 1 from cron.job where jobname = 'fc-weekly-summary');
select cron.schedule(
  'fc-weekly-summary',
  '0 22 * * 0',
  (select replace(command, 'send-daily-summary', 'send-weekly-summary') from cron.job where jobname = 'fc-daily-summary')
);
select jobname, schedule from cron.job where jobname in ('fc-daily-summary', 'fc-weekly-summary');
