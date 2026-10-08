// utils/shootout.js
// Shootout attempts in a HockeyTech /live payload (PWHL, AHL, ECHL): the
// Worker sends them as 'shootout' events in period 7 ('SO',
// hockeytechPeriodNumber), since the feed gives them no period or time.
// They have no coordinates and never make a period of their own: the
// summaries, period lists and clocks leave them out or label them "SO".
// (PWHL data from before 2026-10-08 had none: /pwhl/live dropped them.)

export const SHOOTOUT_PERIOD = 7;

export const isShootoutEvent = e => e?.eventType === 'shootout' || e?.period === SHOOTOUT_PERIOD;
