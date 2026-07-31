const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripeEvent = JSON.parse(event.body);

    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const customerEmail = session.customer_details?.email;

      if (customerEmail) {
        // Percorso del file ebook.pdf nel progetto
        const filePath = path.join(process.cwd(), 'private', 'ebook.pdf');
        
        // Leggiamo il file e lo convertiamo in base64 per Resend
        const pdfBuffer = fs.readFileSync(filePath);
        const base64Pdf = pdfBuffer.toString('base64');

        // Invio mail tramite Resend con allegato
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Maura Balocco <onboarding@resend.dev>', // Sostituisci con info@maurabalocco.com quando verifichi il dominio
            to: [customerEmail],
            subject: 'Grazie per l\'acquisto! Ecco il tuo libro',
            html: `
              <h1>Grazie per aver acquistato il libro!</h1>
              <p>In allegato a questa email trovi il file PDF del tuo eBook.</p>
              <p>Buona lettura!</p>
            `,
            attachments: [
              {
                filename: 'ebook.pdf',
                content: base64Pdf,
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Errore Resend:', errorData);
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error('Errore Webhook:', err.message);
    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};