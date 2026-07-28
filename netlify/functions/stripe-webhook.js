const Stripe = require("stripe");
const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  try {
    const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

    // Gestione corretta del payload per Netlify Serverless
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body;

    const stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // PAGAMENTO COMPLETATO
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;
      const customerEmail = session.customer_details?.email;

      if (!customerEmail) {
        throw new Error("Email cliente non trovata nella sessione Stripe.");
      }

      // Risoluzione path sicura in ambiente Netlify
      const pdfPath = path.resolve(__dirname, "../../private/ebook.pdf");

      console.log("Tentativo lettura PDF PATH:", pdfPath);

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`File PDF non trovato sul server al percorso: ${pdfPath}`);
      }

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString("base64");

      // INVIO EMAIL VIA RESEND
      const response = await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: customerEmail,
        subject: "Il tuo ebook è pronto ✨",
        html: `
          <h2>Grazie per il tuo acquisto</h2>
          <p>In allegato trovi il tuo ebook PDF.</p>
          <p>Buona lettura ✨</p>
        `,
        attachments: [
          {
            filename: "ebook.pdf",
            content: pdfBase64,
          },
        ],
      });

      console.log("EMAIL INVIATA CON SUCCESSO:", response);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };

  } catch (err) {
    console.error("ERRORE WEBHOOK STRIPE:", err.message);

    // Dettaglio errore nei log di Netlify per debug rapido
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};