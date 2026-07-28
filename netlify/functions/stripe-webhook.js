const Stripe = require("stripe");
const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

    // Gestione raw body per Netlify
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;

    const stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("EVENTO RICEVUTO:", stripeEvent.type);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const customerEmail = session.customer_details?.email || session.customer_email;

      console.log("DESTINATARIO EMAIL:", customerEmail);

      if (!customerEmail) {
        throw new Error("Nessun indirizzo email trovato nella sessione di checkout.");
      }

      // Path corretto e compatibile con incluso_files in netlify.toml
      const pdfPath = path.join(process.cwd(), "private", "ebook.pdf");

      console.log("LETTURA FILE DA:", pdfPath);

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`File non trovato al percorso: ${pdfPath}`);
      }

      const pdfBuffer = fs.readFileSync(pdfPath);

      console.log("INVIO CON RESEND IN CORSO...");

      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: [customerEmail],
        subject: "Il tuo ebook è pronto ✨",
        html: `
          <h2>Grazie per il tuo acquisto</h2>
          <p>In allegato trovi il tuo ebook PDF.</p>
          <p>Buona lettura ✨</p>
        `,
        attachments: [
          {
            filename: "ebook.pdf",
            content: pdfBuffer,
          },
        ],
      });

      if (error) {
        console.error("ERRORE DA RESEND:", error);
        throw new Error(`Resend Error: ${error.message}`);
      }

      console.log("ESITO RESEND SUCCESS:", data);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };

  } catch (err) {
    console.error("ERRORE WEBHOOK STRIPE:", err.message);

    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};