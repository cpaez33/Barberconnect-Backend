import db from "#db/client";

/**
 * Fetch every barber and bundle their services into an array,
 * using full column names for each JSON key.
 *
 * e.g
 * [
 * {
 *   "id": 1,
 *   "name": "Liam Styles",
 *   "email": "liam@example.com",
 *   "calendly_link": "https://calendly.com/liam",
 *   "services": [
 *     { "id": 42, "name": "Haircut", "price": 4000, "event": "haircut_30" },
 *       { "id": 43, "name": "Beard Trim", "price": 2000, "event": "beard_15" }
 *     ]
 *   },
 *  …
 * ]
 *
 * @returns {Promise<Array<{
 *   id: number,
 *   name: string,
 *   email: string,
 *   calendly_link: string,
 *   services: Array<{
 *     id: number,
 *     name: string,
 *     price_cents: number,
 *     calendly_event_type: string
 *   }>
 * }>>}
 */
export async function findAllBarbersWithServices() {
  const sql = `
  SELECT
  users.id,
  users.name,
  users.email,
  users.calendly_link,
  COALESCE(
    json_agg(
      json_build_object(
        'id',                   services.id,
        'name',                 services.name,
        'price_cents',          services.price_cents,
        'calendly_event_type',  services.calendly_event_type
      )
    ) FILTER (WHERE services.id IS NOT NULL),
    '[]'
  ) AS services
FROM users
LEFT JOIN services
  ON services.barber_id = users.id
WHERE users.role = 'barber'
GROUP BY users.id;
`;

  const { rows: barbers } = await db.query(sql);
  return barbers;
}

/**
 * Get a single barber and their services by ID.
 * @param {number} id - Barber user ID
 * @returns {Promise<object>}
 */
export async function findBarberById(id) {
  const sql = `
    SELECT
      users.id,
      users.name,
      users.email,
      users.role,
      users.calendly_link,
      users.calendly_access_token,
      users.calendly_refresh_token,
      users.calendly_token_expires,
      COALESCE(
        json_agg(
          json_build_object(
            'id',                   services.id,
            'name',                 services.name,
            'price_cents',          services.price_cents,
            'calendly_event_type',  services.calendly_event_type
          )
        ) FILTER (WHERE services.id IS NOT NULL),
        '[]'
      ) AS services
    FROM users
    LEFT JOIN services
      ON services.barber_id = users.id
    WHERE users.role = 'barber' AND users.id = $1
    GROUP BY users.id;
  `;

  const {
    rows: [barber],
  } = await db.query(sql, [id]);
  return barber;
}
