import db from "#db/client";

export async function createService(
  barberId,
  name,
  price,
  calendlyEventType,
  calendlyEventUri
) {
  const sql = `
    INSERT into services
        (barber_id, name, price_cents, calendly_event_type, calendly_event_type_api_uri)
    VALUES
        ($1, $2, $3, $4, $5)
    RETURNING *`;
  const {
    rows: [service],
  } = await db.query(sql, [
    barberId,
    name,
    price,
    calendlyEventType,
    calendlyEventUri,
  ]);
  return service;
}

export async function getServicesByBarberId(BarberId) {
  const sql = `
    SELECT * 
    FROM services 
    where services.barber_id = $1`;
  const { rows: services } = await db.query(sql, [BarberId]);
  return services;
}

export async function getServices() {
  const sql = `
    SELECT * FROM services`;
  const { rows: services } = await db.query(sql);
  return services;
}

export async function getServiceById(id) {
  const sql = `SELECT * FROM services where id = $1`;
  const {
    rows: [service],
  } = await db.query(sql, [id]);
  return service;
}
/**
 * Update a service’s data.
 * @param {number} serviceId
 * @param {number} barberId // to enforce ownership
 * @param {string} name
 * @param {number} priceCents
 * @param {string} calendlyEventType
 * @returns {Promise<Object>} the updated service row
 */
export async function updateService(
  serviceId,
  barberId,
  name,
  priceCents,
  calendlyEventType
) {
  const sql = `
    UPDATE services
    SET
      name = $1,
      price_cents = $2,
      calendly_event_type = $3
    WHERE id = $4
      AND barber_id = $5
    RETURNING *
  `;
  const {
    rows: [service],
  } = await db.query(sql, [
    name,
    priceCents,
    calendlyEventType,
    serviceId,
    barberId,
  ]);
  return service;
}

/**
 * Delete a service by its ID, but only if it belongs to the given barber.
 * @param {number} serviceId
 * @param {number} barberId
 * @returns {Promise<Object|undefined>} the deleted service row, or undefined if none matched
 */
export async function deleteService(serviceId, barberId) {
  const sql = `
    DELETE FROM services
    WHERE id = $1
      AND barber_id = $2
    RETURNING *
  `;
  const {
    rows: [deleted],
  } = await db.query(sql, [serviceId, barberId]);
  return deleted;
}

/**
 * Finds a service by its associated Calendly event URI.
 *
 * @param {string} uri - The Calendly event URI used to identify the service.
 * @returns {Promise<Object|undefined>} the service row if found, or undefined if not found.
 */
export async function findServiceByEventUri(uri) {
  const sql = `SELECT * FROM services WHERE calendly_event_type_api_uri = $1`;
  const {
    rows: [service],
  } = await db.query(sql, [uri]);
  return service;
}
