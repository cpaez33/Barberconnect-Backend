import express from "express";
const router = express.Router();
export default router;

import {
  createUser,
  getUserByEmailAndPassword,
  updateCalendlyLink,
} from "#db/queries/users";
import requireBody from "#middleware/requireBody";
import requireUser from "#middleware/requireUser";
import { createToken } from "#utils/jwt";

router.route("/register").post(
  requireBody(["name", "email", "password", "role"]), // Only requires the fields that are not null in db schema
  async (req, res) => {
    const {
      name,
      email,
      password,
      role,
      calendlyLink,
      calendlyAccessToken,
      calendlyRefreshToken,
      calendlyTokenExpiration,
    } = req.body;
    const user = await createUser(
      name,
      email,
      password,
      role,
      calendlyLink,
      calendlyAccessToken,
      calendlyRefreshToken,
      calendlyTokenExpiration
    );

    const token = await createToken({ id: user.id });
    res.status(201).send(token);
  }
);

router
  .route("/login")
  .post(requireBody(["email", "password"]), async (req, res) => {
    const { email, password } = req.body;
    const user = await getUserByEmailAndPassword(email, password);
    if (!user) return res.status(401).send("Invalid email or password.");

    const token = await createToken({ id: user.id });
    res.send(token);
  });

router.route("/client").get(requireUser, (req, res) => {
  res.json(req.user);
});

router
  .route("/client/calendly")
  .put(requireUser, requireBody(["calendlyLink"]), async (req, res, next) => {
    try {
      if (req.user.role !== "barber") {
        return res
          .status(403)
          .json({ error: "Only barbers can set a calendly link" });
      }
      const link = req.body.calendlyLink.trim(); //trim removes white spaces from both ends of the string

      const updatedBarberUser = await updateCalendlyLink(link, req.user.id);

      res.send(updatedBarberUser);
    } catch (err) {
      next(err);
    }
  });
