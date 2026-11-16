-- «Smenadaman» holds until the courier switches it off (owner's decision, November 2026): a
-- courier on shift now stays on shift past midnight. 8640000000000000 is SHIFT_OPEN_END in core,
-- the farthest moment a date can name. Data only: the previous Worker reads it as on shift.
UPDATE courier_profiles SET shift_until = 8640000000000000
WHERE shift_until > CAST(strftime('%s', 'now') AS INTEGER) * 1000;
