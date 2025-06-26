import express from "express";
const router = express.Router();
export default router;

import requireUser from "#middleware/requireUser";
import { getUserById } from "#db/queries/users";
import { getAppointmentsForBarber } from "#db/queries/appointments";
import {
  findAllBarbersWithServices,
  findBarberById,
} from "#db/queries/barbers";
import { getServicesByBarberId } from "#db/queries/services";
import { getValidAccessToken } from "#api/calendly";

/**
 * GET /api/calendly/calendlyverify
 * Returns { verify: true } if we have (or can refresh) a valid access token,
 * otherwise { verify: false }.
 */
router.get("/calendlyverify", requireUser, async (req, res, next) => {
  try {
    // This will refresh the token if it's expired (and save the new tokens),
    // or throw if the refresh failed.
    await getValidAccessToken(req.user);
    return res.json({ verify: true });
  } catch (err) {
    console.error("Calendly verify failed:", err);
    return res.json({ verify: false });
  }
});

// Public: list all barbers
router.get("/", async (req, res, next) => {
  const barbers = await findAllBarbersWithServices();
  return res.send(barbers);
});

// Public: get any single barber’s profile
router.get("/:id", async (req, res, next) => {
  const barber = await findBarberById(req.params.id);
  if (!barber) return res.status(404).send("Barber not found");
  return res.send(barber);
});

// From here on out, you must be a logged-in user

// router.param("id", async (req, res, next, id) => {
//   const barber = await getUserById(id);
//   if (!barber) return res.status(404).send("User not found");
//   if (barber.id !== req.user.id) {
//     return res
//       .status(403)
//       .send("You dont have permission to view these appointments.");
//   }
//   req.barber = barber;
//   next();
// });

/**
 * GET /api/barbers/:id/appointments
 *  - Only a barber can fetch their own appointment list.
 */
router.route("/:id/services").get(requireUser, async (req, res, next) => {
  try {
    const barberId = Number(req.params.id);
    if (Number.isNaN(barberId)) {
      return res.status(400).send("Barber ID must be an integer.");
    }
    if (req.user.id !== barberId) {
      return res
        .status(403)
        .send("You dont have permission to view these services.");
    }
    const services = await getServicesByBarberId(barberId);
    res.json(services);
  } catch (err) {
    next(err);
  }
});

router.route("/:id/appointments").get(requireUser, async (req, res, next) => {
  try {
    const barberId = Number(req.params.id);
    if (Number.isNaN(barberId)) {
      return res.status(400).send("Barber ID must be an integer.");
    }

    if (req.user.id !== barberId) {
      return res
        .status(403)
        .send("You dont have permission to view these appointments.");
    }
    const appointments = await getAppointmentsForBarber(barberId);
    res.json(appointments);
  } catch (err) {
    next(err);
  }
});
