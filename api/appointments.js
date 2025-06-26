import express from "express";
import requireUser from "#middleware/requireUser";
const router = express.Router();
export default router;

import { getAppointmentById } from "#db/queries/appointments";
import { getValidAccessToken } from "#api/calendly";

// Allows a client (or the barber) to cancel an appointment
router.post("/:id", requireUser, async (req, res, next) => {
  try {
    const apptId = Number(req.params.id);
    if (!Number.isInteger(apptId)) {
      return res.status(400).json({ error: "Invalid appointment ID" });
    }

    // Fetch the appointment to check ownership and get the uri
    const appt = await getAppointmentById(apptId);
    if (!appt) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    // Only the client who booked it (or the barber who owns the service) may cancel
    if (req.user.role === "client" && appt.client_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (
      req.user.role === "barber" &&
      appt.barber_id !== req.user.id // you'll need to JOIN barber_id in the query
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Extract the event UUID from your stored calendly_event_uri
    // e.g. "https://api.calendly.com/scheduled_events/abcd-1234"
    // const parts = appt.calendly_event_uri.split("/");
    // const eventUuid = parts[parts.length - 1];
    // console.log("eventsuuid", eventUuid);
    // Use the exact URL Calendly sent you:
    const url = appt.cancellation_url;
    if (!url) return res.status(400).json({ error: "No cancellation URL" });
    // Get a fresh (or still-valid) token
    const token = await getValidAccessToken(req.user);

    // Send the POST to Calendly
    const calendlyRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    console.log("calendlyRes", calendlyRes);
    if (!calendlyRes.ok) {
      const detail = await calendlyRes.text();
      return res
        .status(calendlyRes.status)
        .json({ error: "Cancel failed", detail });
    }

    // Calendly will POST an invitee.canceled to your webhook,
    // which will update the DB. just return success here.
    return res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});
