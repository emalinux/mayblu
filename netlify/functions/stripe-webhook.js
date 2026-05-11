const Stripe = require("stripe");
const { Resend } = require("resend");
const fs = require("fs");
const path = require("path");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {

  try {

    const sig = event.headers["stripe-signature"];

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // PAGAMENTO COMPLETATO
    if (stripeEvent.type === "checkout.session.completed") {

      const session = stripeEvent.data.object;

      const customerEmail = session.customer_details.email;

      // PDF
      const pdfPath = path.join(process.cwd(), "private", "ebook.pdf");

      console.log("PDF PATH:", pdfPath);

      const pdfBuffer = fs.readFileSync(pdfPath);
      const pdfBase64 = pdfBuffer.toString("base64");


      // INVIO EMAIL
      const response = await resend.emails.send({

        from: process.env.EMAIL_FROM,

        to: customerEmail,

        subject: "Il tuo ebook è pronto ✨",

        html: `
          <h2>Grazie per il tuo acquisto</h2>

          <p>
            In allegato trovi il tuo ebook PDF.
          </p>

          <p>
            Buona lettura ✨
          </p>
        `,

        attachments: [
          {
            filename: "ebook.pdf",
            content: pdfBase64,
          },
        ],
      });

      console.log("EMAIL INVIATA:", response);
    }

    return {
      statusCode: 200,
      body: "Webhook ricevuto",
    };

  } catch (err) {

    console.error("ERRORE WEBHOOK:", err);

    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};