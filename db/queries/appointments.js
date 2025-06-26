import db from "#db/client";

/**
 * Insert a new appointment.
 * @param {number} clientId                – user.id of the client booking
 * @param {number} serviceId               – service.id being booked
 * @param {Date|string} appointmentDt      – timestamp of the appointment
 * @param {string} status                  – one of the appointment_status enum values (booked or cancelled)
 * @param {string} calendlyEventUri        – URI returned from Calendly
 * @returns {Promise<Object>}              – the inserted appointment row
 */
export async function createAppointment(
  clientId,
  serviceId,
  appointmentDt,
  status,
  calendlyEventUri
) {
  const sql = `
    INSERT INTO appointments
      (client_id, service_id, appointment_dt, status, calendly_event_uri)
    VALUES
      ($1, $2, $3, $4, $5)
    RETURNING *;
    `;
  const {
    rows: [appointment],
  } = await db.query(sql, [
    clientId,
    serviceId,
    appointmentDt,
    status,
    calendlyEventUri,
  ]);
  return appointment;
}

/**
 * Insert a new appointment record from a Calendly webhook.
 * @param {number} clientId
 * @param {number} serviceId
 * @param {string} eventUri
 * @param {string} scheduledTime  // ISO string e.g "2025-06-15T12:30:00Z" or timestamp
 * @returns {Promise<Object>} appointment row
 */
export async function createAppointmentFromWebhook(
  clientId,
  serviceId,
  scheduledTime,
  eventUri,
  cancelUrl,
  rescheduleUrl
) {
  const sql = `
   INSERT INTO appointments
      (client_id, service_id, appointment_dt, calendly_event_uri, cancellation_url, reschedule_url)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING *;`;
  const {
    rows: [appointment],
  } = await db.query(sql, [
    clientId,
    serviceId,
    scheduledTime,
    eventUri,
    cancelUrl,
    rescheduleUrl,
  ]);
  return appointment;
}

/**
 * Mark an appointment as cancelled via its Calendly event URI.
 * @param {string} eventUri
 * @returns {Promise<Object|undefined>} the updated row or undefined if not found
 */
export async function cancelAppointmentByUri(eventUri) {
  const sql = `
    UPDATE appointments
    SET status = 'cancelled'
    WHERE calendly_event_uri = $1
    RETURNING *;
  `;
  const {
    rows: [appointment],
  } = await db.query(sql, [eventUri]);
  return appointment;
}

/**
 * Find or create a client user by their Calendly invitee email.
 * @param {string} email
 * @param {string} name
 * @returns {Promise<Object>} user row
 */
export async function upsertClientByEmail(email, name) {
  const sql = `
    INSERT INTO users (email, name, password, role)
    VALUES ($1, $2, '', 'client')
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING *;
  `;
  const {
    rows: [user],
  } = await db.query(sql, [email, name]);
  return user;
}

/**
 *   Get all appointments for a given client, including:
 * - the selected service (id, name, price)
 * - the barber who provides that service (id, name, email)
 *
 * Appointments are ordered from soonest to latest.
 *
 * @param {number} clientId - The ID of the client whose appointments to fetch.
 * @returns {Promise<Array<{
 *   id: number,
 *   appointment_dt: string,
 *   status: string,
 *   calendly_event_uri: string,
 *   service: {
 *     id: number,
 *     name: string,
 *     price_cents: number
 *   },
 *   otherUser: {
 *     id: number,
 *     name: string,
 *     email: string
 *   }
 * }>>} A list of appointment objects with nested service and barber info.
 */

export async function getAppointmentsForClient(clientId) {
  const sql = `
    SELECT
      appointments.id,
      appointments.appointment_dt,
      appointments.status,
      appointments.calendly_event_uri,
      appointments.cancellation_url,
      appointments.reschedule_url,
      json_build_object(
        'id', services.id,
        'name', services.name,               
        'price_cents', services.price_cents
      ) AS service,
      json_build_object(
        'id', users.id,
        'name', users.name,
        'email', users.email
      ) AS otherUser
    FROM appointments
    JOIN services
      ON appointments.service_id = services.id
    JOIN users
      ON services.barber_id = users.id
    WHERE appointments.client_id = $1
    ORDER BY appointments.appointment_dt ASC;
  `;
  const { rows: appointmentList } = await db.query(sql, [clientId]);
  return appointmentList;
}

/**
 *   Get all appointments for a given barber, including:
 * - the service that was booked (id, name, price)
 * - the client who booked the appointment (id, name, email)
 *
 * Appointments are ordered from soonest to latest.
 *
 * @param {number} barberId - The ID of the barber whose appointments to fetch.
 * @returns {Promise<Array<{
 *   id: number,
 *   appointment_dt: string,
 *   status: string,
 *   calendly_event_uri: string,
 *   service: {
 *     id: number,
 *     name: string,
 *     price_cents: number
 *   },
 *   otherUser: {
 *     id: number,
 *     name: string,
 *     email: string
 *   }
 * }>>} A list of appointment objects with nested service and client info.
 */

export async function getAppointmentsForBarber(barberId) {
  const sql = `
    SELECT
      appointments.id,
      appointments.appointment_dt,
      appointments.status,
      appointments.calendly_event_uri,
      appointments.cancellation_url,
      appointments.reschedule_url,
      json_build_object(
        'id', services.id,
        'name', services.name,
        'price_cents', services.price_cents
      ) AS service,
      json_build_object(
        'id', users.id,
        'name', users.name,
        'email', users.email
      ) AS otherUser
    FROM appointments
    JOIN services
      ON appointments.service_id = services.id
    JOIN users
      ON appointments.client_id = users.id
    WHERE services.barber_id = $1
    ORDER BY appointments.appointment_dt ASC;
  `;
  const { rows: appointmentList } = await db.query(sql, [barberId]);
  return appointmentList;
}

/**
 * Fetch a single appointment by its numeric ID.
 * Includes the calendly_event_uri and the barber_id (for auth).
 */
export async function getAppointmentById(appointmentId) {
  const sql = `
  SELECT
    a.id,
    a.client_id,
    a.calendly_event_uri,
    a.cancellation_url,
    a.reschedule_url,
    s.barber_id
  FROM appointments a
  JOIN services s ON a.service_id = s.id
  WHERE a.id = $1
`;
  const {
    rows: [appt],
  } = await db.query(sql, [appointmentId]);
  return appt;
}
