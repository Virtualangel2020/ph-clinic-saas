-- Additive column so a flexible-arrival or walk-in-intent booking uses the
-- EXACT same appointments table/calendar/My-Appointments/dashboard pipeline
-- as a strict slot booking — no parallel calendar (Angel: "one calendar
-- engine", Part 33 "same data everywhere"). Every existing row is
-- implicitly 'scheduled' (the default), zero backfill risk since that's
-- exactly what every current row already is.
--
-- For 'flexible_arrival'/'walk_in_intent' rows, start_at/end_at hold that
-- day's published clinic-hours window (not a personal slot) so overlap
-- math elsewhere (portal_book_appointment's double-booking check, the
-- calendar view) still has a sane range to render — they just aren't
-- exclusive slots the way a 'scheduled' row is. expected_arrival_at is the
-- patient's stated arrival time under flexible_arrival only; walk_in_intent
-- rows never set it (no time picker for walk-ins per Angel's spec).
alter table appointments
  add column if not exists booking_mode text not null default 'scheduled'
    check (booking_mode in ('scheduled','flexible_arrival','walk_in_intent')),
  add column if not exists expected_arrival_at timestamptz;

comment on column appointments.booking_mode is 'scheduled = real reserved slot. flexible_arrival = patient booked within a clinic-hours window, exact time not guaranteed (see expected_arrival_at). walk_in_intent = patient notified intent to visit during walk-in hours, no time reserved at all.';
comment on column appointments.expected_arrival_at is 'Patient-stated expected arrival time for booking_mode=flexible_arrival only. NOT a guaranteed consultation time. Always null for scheduled/walk_in_intent.';
