import express from "express";
const app = express();
export default app;

import usersRouter from "#api/users";
import calendlyRouter from "#api/calendly";
import clientsRouter from "#api/clients";
import servicesRouter from "#api/services";
import barbersRouter from "#api/barbers";
import appointmentsRouter from "#api/appointments";

import getUserFromToken from "#middleware/getUserFromToken";
import handlePostgresErrors from "#middleware/handlePostgresErrors";
import cors from "cors";
import morgan from "morgan";

// app.use(cors({ origin: process.env.CORS_ORIGIN ?? /localhost/ }));
// app.use(cors());

// parse comma-separated origins into an array
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : [];

// only allow requests coming from your Netlify app (or localhost during dev)
app.use(
  cors({
    origin: (origin, callback) => {
      // browser may send no origin (e.g. mobile clients, curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(morgan("dev"));

app.use(
  express.json({
    verify: (req, res, buf) => {
      // stash the raw request body on req.rawBody
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

app.use(getUserFromToken);

app.get("/", (req, res) => res.send("Hello, World!"));

app.use("/users", usersRouter);
app.use("/services", servicesRouter);
app.use("/calendly", calendlyRouter);
app.use("/clients", clientsRouter);
app.use("/barbers", barbersRouter);
app.use("/appointments", appointmentsRouter);

app.use(handlePostgresErrors);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Sorry! Something went wrong.");
});
