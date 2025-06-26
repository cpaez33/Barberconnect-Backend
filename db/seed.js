import db from "#db/client";
import { createUser } from "#db/queries/users";
import { createService } from "#db/queries/services";
import { createAppointment } from "#db/queries/appointments";
import { faker } from "@faker-js/faker";

await db.connect();
await seed();
await db.end();
console.log("🌱 Database seeded.");

async function seed() {
  // 1) Barbers
  const barbers = [];
  for (let i = 0; i < 10; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    const password = faker.internet.password(8);
    const barber = await createUser(name, email, password, "barber");
    console.log(`Barber: ${email} / ${password}`);
    barbers.push(barber);
  }

  // 2) Clients
  const clients = [];
  for (let i = 0; i < 15; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const name = `${firstName} ${lastName}`;
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    const password = faker.internet.password(8);
    const client = await createUser(name, email, password, "client");
    console.log(`Client: ${email} / ${password}`);
    clients.push(client);
  }

  // 3) Services per Barber
  const services = [];
  for (const barber of barbers) {
    const count = faker.number.int({ min: 1, max: 5 });
    for (let i = 0; i < count; i++) {
      const serviceName = faker.helpers.arrayElement([
        "Haircut",
        "Beard Trim",
        "Shave",
        "Color",
        "Fade",
      ]);
      const price = faker.number.int({ min: 2000, max: 8000 });
      const eventType = `https://${emailUsername(
        barber.email
      )}.calendly.com/${faker.lorem.slug()}`;
      const service = await createService(
        barber.id,
        serviceName,
        price,
        eventType
      );
      services.push(service);
    }
  }

  // 4) Appointments
  for (let i = 0; i < 15; i++) {
    const client = faker.helpers.arrayElement(clients);
    const service = faker.helpers.arrayElement(services);
    const dt = faker.date.between({
      from: new Date("2025-07-01"),
      to: new Date("2025-12-31"),
    });
    const status = faker.helpers.arrayElement(["booked", "cancelled"]);
    const uri = faker.string.uuid();

    await createAppointment(client.id, service.id, dt, status, uri);
  }
}

function emailUsername(email) {
  return email.split("@")[0];
}
