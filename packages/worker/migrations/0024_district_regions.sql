-- A district belongs to one of the 14 regions of Uzbekistan (owner's decision, October 2026):
-- `region` is its id (`Region` in core); districts made before it was asked have none until an
-- admin picks it in «Tumanlar». Additive: the previous Worker never reads it.
ALTER TABLE districts ADD COLUMN region TEXT;

-- The pilot's two districts in Qashqadaryo viloyati, 20 km each (owner's decision, October
-- 2026): Yakkabog' stansiyasi, the town that grew around the station, and Yakkabog' posyolkasi,
-- the settlement of Eski Yakkabog'. A district an admin already made under the name stays.
INSERT OR IGNORE INTO districts
    (id, name, name_key, region, latitude, longitude, radius_m, wait_minutes, created_at,
        updated_at)
VALUES
    ('district-yakkabog-stansiyasi', 'Yakkabog'' stansiyasi', 'yakkabog'' stansiyasi',
        'qashqadaryo', 38.9785, 66.6831, 20000, 10, 1792130400000, 1792130400000),
    ('district-yakkabog-posyolkasi', 'Yakkabog'' posyolkasi', 'yakkabog'' posyolkasi',
        'qashqadaryo', 38.93139, 66.83889, 20000, 10, 1792130400000, 1792130400000);

-- Every shop with a place goes to the closest district whose circle holds it, as saving a
-- district in «Tumanlar» does (`districtOf`, haversine to the meter as `Location.distanceTo`);
-- a demo stays out. Only a shop whose district changes is written; `updated_at` stays, so an
-- edit saved at the same moment is not refused (it never writes `district_id`).
UPDATE businesses SET district_id = nearest.district_id
FROM (
    SELECT b.id AS business_id,
        CASE WHEN b.demo_at IS NOT NULL THEN NULL ELSE (
            SELECT d.id FROM districts d
            WHERE round(12742000 * asin(sqrt(
                pow(sin(radians(b.latitude - d.latitude) / 2), 2)
                + cos(radians(d.latitude)) * cos(radians(b.latitude))
                * pow(sin(radians(b.longitude - d.longitude) / 2), 2)
            ))) <= d.radius_m
            ORDER BY round(12742000 * asin(sqrt(
                pow(sin(radians(b.latitude - d.latitude) / 2), 2)
                + cos(radians(d.latitude)) * cos(radians(b.latitude))
                * pow(sin(radians(b.longitude - d.longitude) / 2), 2)
            ))), d.name_key
            LIMIT 1
        ) END AS district_id
    FROM businesses b
    WHERE b.latitude IS NOT NULL
) AS nearest
WHERE businesses.id = nearest.business_id
    AND businesses.district_id IS NOT nearest.district_id;
