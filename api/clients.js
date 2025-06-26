import express from "express";
const router = express.Router();
export default router;

import requireUser from "#middleware/requireUser";
import { getUserById } from "#db/queries/users";
import { getAppointmentsForClient } from "#db/queries/appointments";

router.use(requireUser);

router.param("id", async (req, res, next, id) => {
  const client = await getUserById(id);
  if (!client) return res.status(404).send("user not found");
  if (client.id !== req.user.id) {
    return res
      .status(403)
      .send("You dont have permission to view these appointments.");
  }
  req.client = client;
  next();
});

/**
 * GET /api/clients/:id/appointments
 *   - Only a client can fetch their own appointments.
 */
router.route("/:id/appointments").get(async (req, res, next) => {
  try {
    const clientId = req.client.id;
    if (!Number.isInteger(clientId)) {
      return res.status(400).send("Client ID must be an integer.");
    }
    if (req.user.role !== "client") {
      return res.status(403).send("Forbidden");
    }
    const appointments = await getAppointmentsForClient(clientId);
    res.json(appointments);
  } catch (err) {
    next(err);
  }
});
