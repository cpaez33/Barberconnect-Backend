import express from "express";
import crypto from "crypto";
const router = express.Router();
export default router;

import requireUser from "#middleware/requireUser";
import {
  upsertClientByEmail,
  createAppointmentFromWebhook,
  cancelAppointmentByUri,
} from "#db/queries/appointments";
import { findServiceByEventUri } from "#db/queries/services";
import { updateUserTokens } from "#db/queries/users";

const WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

async function refreshCalendlyToken(user) {
  const resp = await fetch("https://auth.calendly.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: user.calendly_refresh_token,
      client_id: process.env.CALENDLY_CLIENT_ID,
      client_secret: process.env.CALENDLY_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) {
    throw new Error("Calendly refresh failed: " + resp.status);
  }
  const { access_token, refresh_token, expires_in } = await resp.json();
  const expires_at = new Date(Date.now() + expires_in * 1000);
  // persist the new tokens for this barber
  await updateUserTokens(access_token, refresh_token, expires_at, user.id);
  return access_token;
}

/**
 * Returns a valid access token for this user.
 * Refreshes it if the stored one is expired (or will expire in the next minute).
 */
export async function getValidAccessToken(user) {
  const now = new Date();
  // give 60s buffer to avoid race
  if (
    !user.calendly_token_expires ||
    now >= new Date(user.calendly_token_expires) - 60000
  ) {
    return refreshCalendlyToken(user);
  }
  return user.calendly_access_token;
}

// GET /api/calendly/event_types
router.get(
  "/event_types",
  requireUser, // ensure req.user.calendly_access_token exists
  async (req, res, next) => {
    try {
      console.log("req.user.token", req.user.calendly_access_token);
      const token = await getValidAccessToken(req.user);
      const calendlyMeResponse = await fetch(
        "https://api.calendly.com/users/me",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log("calendlyMeResponse", calendlyMeResponse);
      if (!calendlyMeResponse.ok)
        throw new Error("Failed fetching calendlyMeResponse");
      const calendlyMeResponseData = await calendlyMeResponse.json();
      console.log("calendlyMeResponseData", calendlyMeResponseData);
      const userUri = calendlyMeResponseData.resource.uri;

      const resp = await fetch(
        `https://api.calendly.com/event_types?user=${encodeURIComponent(
          userUri
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await resp.json();
      console.log("dataaaaaa", data);
      // data.collection is an array of event-type objects
      res.json(data.collection);
    } catch (err) {
      next(err);
    }
  }
);

function verifyCalendlySignature(req) {
  const sigHeader = req.get("Calendly-Webhook-Signature") || "";
  // header format: "t=1625256000,v1=abcdef1234…"
  const parts = sigHeader.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !v1Part) return false;

  const timestamp = tPart.split("=", 2)[1];
  const signature = v1Part.split("=", 2)[1];

  // rawBody is a Buffer because of the express.json({verify…}) hook
  const rawPayload = req.rawBody.toString("utf8");
  const signedPayload = `${timestamp}.${rawPayload}`;

  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(signedPayload, "utf8")
    .digest("hex");

  return expected === signature;
}

router.route("/webhook").post(async (req, res, next) => {
  console.log("🔔 Calendly webhook received:", req.body.event);
  try {
    if (!verifyCalendlySignature(req)) {
      console.log("verifyCalendlySignature failed");
      return res.status(401).send("Invalid signature");
    }

    const { event, payload } = req.body;

    if (event === "invitee.created") {
      console.log("hererererere");
      // 1) Determine which service this is
      console.log("invitee.created payload", payload);
      const eventTypeUri = payload.scheduled_event.event_type;
      const service = await findServiceByEventUri(eventTypeUri);
      if (!service) {
        return res.status(400).send("Unknown service for event_type");
      }

      // 2) Upsert the client by email/name
      const inviteeEmail = payload.email;
      const inviteeName = payload.name || "Client";
      const client = await upsertClientByEmail(inviteeEmail, inviteeName);

      // 3) Create the appointment
      const eventUri = payload.uri;
      const cancelUrl = payload.cancel_url;
      const rescheduleUrl = payload.reschedule_url;
      const scheduledTime = new Date(payload.scheduled_event.start_time); // ISO timestamp
      const appt = await createAppointmentFromWebhook(
        client.id,
        service.id,
        scheduledTime,
        eventUri,
        cancelUrl,
        rescheduleUrl
      );

      return res.status(200).send("ok");
    }

    if (event === "invitee.canceled") {
      const eventUri = payload.uri;
      const appt = await cancelAppointmentByUri(eventUri);
      if (!appt) {
        return res.status(404).send("Appointment not found");
      }
      return res.json(appt);
    }

    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

router.route("/connect").get(async (req, res, next) => {
  const { userId } = req.query;
  console.log("Hi", userId);
  const authUrl =
    `https://auth.calendly.com/oauth/authorize?` +
    `client_id=${process.env.CALENDLY_CLIENT_ID}&` +
    `response_type=code&` +
    `redirect_uri=${process.env.CALENDLY_REDIRECT_URI}&` +
    `state=${userId}`;
  // `scope=default&` +

  res.redirect(authUrl);
});

router.route("/auth").get(async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }
  try {
    const response = await fetch(`https://auth.calendly.com/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.CALENDLY_REDIRECT_URI,
        client_id: process.env.CALENDLY_CLIENT_ID,
        client_secret: process.env.CALENDLY_CLIENT_SECRET,
      }),
    });
    if (!response.ok)
      throw new Error(`Calendly token fetch failed: ${response.status}`);

    const userData = await response.json();
    const { access_token, refresh_token, expires_in } = userData;
    const expires_at = new Date(Date.now() + expires_in * 1000);
    await updateUserTokens(access_token, refresh_token, expires_at, userId);

    try {
      const calendlyMeResponse = await fetch(
        "https://api.calendly.com/users/me",
        {
          headers: { Authorization: `Bearer ${access_token}` },
        }
      );

      if (!calendlyMeResponse.ok)
        throw new Error("Failed fetching calendlyMeResponse");
      const calendlyMeResponseData = await calendlyMeResponse.json();
      console.log("calendlyMeResponseData", calendlyMeResponseData);
      const organizationUri =
        calendlyMeResponseData.resource.current_organization;

      const webhookResponse = await fetch(
        "https://api.calendly.com/webhook_subscriptions",
        {
          body: JSON.stringify({
            url: `${process.env.CALENDLY_WEBHOOK_URL}`,
            events: ["invitee.created", "invitee.canceled"],
            organization: organizationUri,
            scope: "organization",
          }),
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const webhookResponseData = await webhookResponse.json();
      console.log("Webhook created", webhookResponseData);
    } catch (error) {
      console.error("Webhook error", error);
    }

    res.redirect("http://localhost:5173/services?calendly=connected");
  } catch (err) {
    console.error("Error exchanging Calendly code:", err);
    return res.redirect("http://localhost:5173/settings?calendly_error=1");
  }
});
