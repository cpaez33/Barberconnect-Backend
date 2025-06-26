import express from "express";
const router = express.Router();
export default router;

import requireUser from "#middleware/requireUser";
import requireBody from "#middleware/requireBody";
import {
  createService,
  deleteService,
  getServiceById,
  getServices,
  getServicesByBarberId,
  updateService,
} from "#db/queries/services";

router
  .route("/")
  .post(
    requireUser,
    requireBody([
      "name",
      "priceCents",
      "calendlyEventType",
      "calendlyEventUri",
    ]),
    async (req, res) => {
      if (req.user.role !== "barber") {
        return res
          .status(403)
          .json({ error: "Only barbers can create a service" });
      }
      const { name, priceCents, calendlyEventType, calendlyEventUri } =
        req.body;
      if (!name || !priceCents || !calendlyEventType)
        return res
          .status(400)
          .send("request body must have name, price, and calendly event type");

      const service = await createService(
        req.user.id,
        name.trim(),
        priceCents,
        calendlyEventType.trim(),
        calendlyEventUri
      );
      res.status(201).send(service);
    }
  )
  .get(async (req, res) => {
    const services = await getServices();
    res.send(services);
  });

router.param("id", async (req, res, next, id) => {
  const service = await getServiceById(id);
  if (!service) return res.status(404).send("service not found");
  if (service.barber_id !== req.user.id) {
    return res.status(403).send("This is not your service");
  }
  req.service = service;
  next();
});

router
  .route("/:id")
  .get(async (req, res) => {
    const service = await getServiceById(req.service.id);
    res.send(service);
  })
  .put(
    requireBody(["name", "priceCents", "calendlyEventType"]),
    async (req, res, next) => {
      try {
        if (req.user.role !== "barber") {
          return res
            .status(403)
            .json({ error: "Only barbers can update a service." });
        }

        const { name, priceCents, calendlyEventType } = req.body;

        const updatedService = await updateService(
          req.service.id,
          req.user.id,
          name,
          priceCents,
          calendlyEventType
        );

        if (!updatedService) {
          return res
            .status(404)
            .json({ error: "Service not found or not owned by you." });
        }

        res.send(updatedService);
      } catch (err) {
        next(err);
      }
    }
  )
  .delete(requireUser, async (req, res, next) => {
    try {
      if (req.user.role !== "barber") {
        return res
          .status(403)
          .json({ error: "Only barbers can delete a service." });
      }

      const deleted = await deleteService(req.service.id, req.user.id);

      if (!deleted) {
        return res
          .status(404)
          .json({ error: "Service not found or not owned by you." });
      }

      return res.sendStatus(204);
    } catch (err) {
      next(err);
    }
  });
