import db from "#db/client";
import bcrypt from "bcrypt";

export async function createUser(
  name,
  email,
  password,
  role,
  calendlyLink,
  calendlyAccessToken,
  calendlyRefreshToken,
  calendlyTokenExpiration
) {
  const sql = `
  INSERT INTO users
    (name, email, password, role, calendly_link, calendly_access_token, calendly_refresh_token, calendly_token_expires)
  VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *
  `;
  const hashedPassword = await bcrypt.hash(password, 10);
  const {
    rows: [user],
  } = await db.query(sql, [
    name,
    email,
    hashedPassword,
    role,
    calendlyLink,
    calendlyAccessToken,
    calendlyRefreshToken,
    calendlyTokenExpiration,
  ]);
  return user;
}

export async function getUserByEmailAndPassword(email, password) {
  const sql = `
  SELECT *
  FROM users
  WHERE email = $1
  `;
  const {
    rows: [user],
  } = await db.query(sql, [email]);
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  return user;
}

export async function getUserById(id) {
  const sql = `
  SELECT *
  FROM users
  WHERE id = $1
  `;
  const {
    rows: [user],
  } = await db.query(sql, [id]);
  return user;
}

/**
 * Update a user’s (barber) Calendly root link.
 * @param {number} userId
 * @param {string} calendlyLink
 * @returns {Promise<Object>} the updated user row
 */

export async function updateCalendlyLink(calendlyLink, userId) {
  const sql = `
  UPDATE users 
  SET calendly_link = $1 
  WHERE id = $2 
  RETURNING id, name, email, role, calendly_link`;
  const {
    rows: [user],
  } = await db.query(sql, [calendlyLink, userId]);
  return user;
}

export async function updateUserTokens(
  calendlyAccessToken,
  calendlyRefreshToken,
  calendlyTokenExpires,
  userId
) {
  const sql = `
UPDATE users
SET calendly_access_token = $1, calendly_refresh_token = $2, calendly_token_expires = $3
WHERE id = $4
RETURNING *`;
  const {
    rows: [user],
  } = await db.query(sql, [
    calendlyAccessToken,
    calendlyRefreshToken,
    calendlyTokenExpires,
    userId,
  ]);
  return user;
}
