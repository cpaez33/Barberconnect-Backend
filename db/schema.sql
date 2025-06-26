-- Drop tables in reverse-dependency order to not cause errors 

DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS users;

DROP TYPE IF EXISTS appointment_status;
DROP TYPE IF EXISTS user_role;

CREATE TYPE user_role AS ENUM ('client', 'barber');
CREATE TYPE appointment_status AS ENUM ('booked', 'cancelled');

-- users table
CREATE TABLE users (
  id                          serial PRIMARY KEY,
  name                        text NOT NULL, 
  email                       text NOT NULL UNIQUE,
  password                    text NOT NULL, -- remember to store it hash
  role                        user_role NOT NULL DEFAULT 'client',
  calendly_link               TEXT,  -- public link for embedding
  calendly_access_token       TEXT,   -- OAuth token for API calls
  calendly_refresh_token      TEXT,    -- to refresh the access token
  calendly_token_expires      TIMESTAMPTZ   -- when the access token expires
);

-- services table
CREATE TABLE services (
  id                          serial PRIMARY KEY,
  barber_id                   int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  price_cents                 int NOT NULL CHECK (price_cents >= 0),
  calendly_event_type         TEXT NOT NULL -- public scheduling URL,
  calendly_event_type_api_uri TEXT NOT NULL DEFAULT '' -- API URI for matching
); 

-- appointments table
CREATE TABLE appointments (
  id                    serial       PRIMARY KEY,
  client_id             int          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id            int          NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  appointment_dt        TIMESTAMPTZ  NOT NULL,
  status                appointment_status   NOT NULL DEFAULT 'booked',
  calendly_event_uri    TEXT         NOT NULL,  -- unique Calendly event identifier e.g., https://api.calendly.com/scheduled_events/UUID
  cancellation_url      TEXT,
  reschedule_url        TEXT
);