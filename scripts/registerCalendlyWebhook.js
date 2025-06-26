import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config();

const TOKEN = process.env.CALENDLY_ACCESS_TOKEN;
const WEBHOOK_URL = process.env.CALENDLY_WEBHOOK_URL;
// const WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET;
console.log("TOKEN", TOKEN, WEBHOOK_URL);
// console.log("WEBHOOK_SECRET", WEBHOOK_SECRET);
async function main() {
  try {
    //  Fetch current user to get their organization URI
    const userRes = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!userRes.ok) {
      throw new Error(`❌ Failed to fetch user info: ${await userRes.text()}`);
    }
    const { resource } = await userRes.json();
    const orgUri = resource.current_organization;
    console.log("✔️ Organization URI:", orgUri);

    //  Create the webhook subscription
    const subscribeRes = await fetch(
      "https://api.calendly.com/webhook_subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          events: ["invitee.created", "invitee.canceled"],
          scope: "organization",
          organization: orgUri,
          // secret: WEBHOOK_SECRET,
        }),
      }
    );

    if (!subscribeRes.ok) {
      throw new Error(
        `❌ Webhook creation failed: ${await subscribeRes.text()}`
      );
    }
    const data = await subscribeRes.json();
    console.log("🎉 Webhook created:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
