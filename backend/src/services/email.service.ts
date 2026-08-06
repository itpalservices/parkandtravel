const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface BookingEmailData {
  email: string;
  fullName: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate?: string;
  checkOutTime?: string;
  licensePlate: string;
  vehicleBrand: string;
  vehicleModel?: string;
  vehicleColor?: string;
  parkingType: string;
  washService: boolean;
  flightNumber?: string;
  dropOffOption?: string;
  pickUpOption?: string;
  finalPrice: number | null;
  isUpdate?: boolean;
  isPaymentConfirmation?: boolean;
  emailDescription?: string | null;
  paymentStatus?: 'paid' | 'pending' | null;
  receiptPdfBuffer?: Buffer;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

function getTransportLabel(option: string): string {
  switch (option) {
    case "self_drive":
      return "Self Drop-Off";
    case "airport_pickup":
      return "Airport Pick-Up";
    case "self_pickup":
      return "Self Pick-Up";
    case "airport_delivery":
      return "Delivery to airport";
    default:
      return option;
  }
}

function getEmailTitle(data: BookingEmailData): string {
  if (data.isPaymentConfirmation) return 'Payment Confirmed!';
  if (data.isUpdate) return 'Booking Updated!';
  return 'Booking Confirmed!';
}

function getEmailTitleColor(data: BookingEmailData): string {
  if (data.isPaymentConfirmation) return '#1565c0';
  if (data.isUpdate) return '#1565c0';
  return '#2e7d32';
}

function getEmailIntro(data: BookingEmailData): string {
  if (data.isPaymentConfirmation) {
    return `Dear <strong style="color: #333333;">${data.fullName}</strong>, your payment has been received and your parking reservation is fully confirmed.`;
  }
  if (data.isUpdate) {
    return `Dear <strong style="color: #333333;">${data.fullName}</strong>, your parking reservation has been successfully updated. Please review your updated booking details below.`;
  }
  return `Thank you, <strong style="color: #333333;">${data.fullName}</strong>! Your parking reservation has been successfully created.`;
}

function generatePaymentStatusHtml(paymentStatus: 'paid' | 'pending'): string {
  if (paymentStatus === 'paid') {
    return `
          <!-- Payment Status: Paid -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f0fdf4; border-radius: 10px; border: 1px solid #86efac;">
                <tr>
                  <td style="padding: 20px 25px;">
                    <p style="margin: 0 0 5px 0; color: #14532d; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Payment Status</p>
                    <p style="margin: 0; color: #15803d; font-size: 18px; font-weight: 700;">&#x2705; Paid</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  }
  return `
          <!-- Payment Status: Pending -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fffbeb; border-radius: 10px; border: 1px solid #fbbf24;">
                <tr>
                  <td style="padding: 20px 25px;">
                    <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Payment Status</p>
                    <p style="margin: 0 0 10px 0; color: #b45309; font-size: 18px; font-weight: 700;">&#x23F3; Pending</p>
                    <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">Your booking has been created. You can complete the payment at your convenience.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function generateBookingConfirmationHtml(data: BookingEmailData): string {
  const vehicle = data.vehicleModel
    ? `${data.vehicleBrand} ${data.vehicleModel}`
    : data.vehicleBrand;

  const vehicleDetails = data.vehicleColor
    ? `${vehicle} (${data.vehicleColor})`
    : vehicle;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - Park & Travel</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #006B8F 0%, #008BB5 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #ffffff; border-radius: 50%; padding: 15px; margin-bottom: 20px;">
                      <svg width="50" height="50" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="11" fill="#006B8F"/>
                        <text x="12" y="16" font-size="10" fill="white" text-anchor="middle" font-weight="bold">P</text>
                      </svg>
                    </div>
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: 1px;">Park & Travel</h1>
                    <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Secure Airport Parking</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Title Badge -->
          <tr>
            <td align="center" style="padding: 30px 30px 20px 30px;">
              <h2 style="color: ${getEmailTitleColor(data)}; margin: 20px 0 10px 0; font-size: 24px; font-weight: 600;">${getEmailTitle(data)}</h2>
              <p style="color: #666666; margin: 0; font-size: 16px; line-height: 1.6;">
                ${getEmailIntro(data)}
              </p>
            </td>
          </tr>
          
          <!-- Booking Details Card -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                
                <!-- Section Header -->
                <tr>
                  <td colspan="2" style="padding: 20px 25px 15px 25px; border-bottom: 1px solid #e2e8f0;">
                    <h3 style="margin: 0; color: #006B8F; font-size: 18px; font-weight: 600;">
                      &#x1F4C5; Reservation Details
                    </h3>
                  </td>
                </tr>
                
                <!-- Check-in -->
                <tr>
                  <td style="padding: 15px 25px; width: 50%; vertical-align: top;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-in</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${formatDate(data.checkInDate)}</p>
                    <p style="margin: 5px 0 0 0; color: #006B8F; font-size: 14px; font-weight: 500;">${formatTime(data.checkInTime)}</p>
                  </td>
                  ${data.checkOutDate ? `<td style="padding: 15px 25px; width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-out</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${formatDate(data.checkOutDate)}</p>
                    ${data.checkOutTime ? `<p style="margin: 5px 0 0 0; color: #006B8F; font-size: 14px; font-weight: 500;">${formatTime(data.checkOutTime)}</p>` : ''}
                  </td>` : `<td style="padding: 15px 25px; width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-out</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">To be determined</p>
                  </td>`}
                </tr>
                
                <!-- Divider -->
                <tr>
                  <td colspan="2" style="padding: 0 25px;">
                    <div style="border-top: 1px solid #e2e8f0;"></div>
                  </td>
                </tr>
                
                <!-- Vehicle Info -->
                <tr>
                  <td colspan="2" style="padding: 15px 25px;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Vehicle</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${vehicleDetails}</p>
                    <p style="margin: 5px 0 0 0; color: #475569; font-size: 14px;">License Plate: <strong>${data.licensePlate}</strong></p>
                  </td>
                </tr>
                
                <!-- Divider -->
                <tr>
                  <td colspan="2" style="padding: 0 25px;">
                    <div style="border-top: 1px solid #e2e8f0;"></div>
                  </td>
                </tr>
                
                <!-- Parking Type -->
                <tr>
                  <td style="padding: 15px 25px; width: 50%; vertical-align: top;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Parking Type</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${data.parkingType}</p>
                  </td>
                  <td style="padding: 15px 25px; width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Car Wash</p>
                    <p style="margin: 0; color: ${data.washService ? "#2e7d32" : "#64748b"}; font-size: 15px; font-weight: 600;">
                      ${data.washService ? "&#x2713; Included" : "No"}
                    </p>
                  </td>
                </tr>
                
                ${data.flightNumber ? `
                <!-- Divider -->
                <tr>
                  <td colspan="2" style="padding: 0 25px;">
                    <div style="border-top: 1px solid #e2e8f0;"></div>
                  </td>
                </tr>
                
                <!-- Flight Info -->
                <tr>
                  <td colspan="2" style="padding: 15px 25px;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Return Flight</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">&#x2708;&#xFE0F; ${data.flightNumber}</p>
                  </td>
                </tr>
                ` : ""}
                
                ${data.dropOffOption || data.pickUpOption ? `
                <!-- Divider -->
                <tr>
                  <td colspan="2" style="padding: 0 25px;">
                    <div style="border-top: 1px solid #e2e8f0;"></div>
                  </td>
                </tr>
                
                <!-- Transport Options -->
                <tr>
                  ${data.dropOffOption ? `
                  <td style="padding: 15px 25px; width: 50%; vertical-align: top;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Drop-off</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${getTransportLabel(data.dropOffOption)}</p>
                  </td>
                  ` : ""}
                  ${data.pickUpOption ? `
                  <td style="padding: 15px 25px; width: 50%; vertical-align: top; ${data.dropOffOption ? "border-left: 1px solid #e2e8f0;" : ""}">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Pick-up</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${getTransportLabel(data.pickUpOption)}</p>
                  </td>
                  ` : ""}
                </tr>
                ` : ""}
                
              </table>
            </td>
          </tr>
          
          ${data.emailDescription ? `
          <!-- Email Description -->
          <tr>
            <td style="padding: 0 30px 20px 30px;">
              <div style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 20px 25px;">
                <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.8; white-space: pre-line;">${data.emailDescription}</p>
              </div>
            </td>
          </tr>
          ` : ""}
          
          ${data.finalPrice !== null ? `
          <!-- Price Section -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #006B8F 0%, #008BB5 100%); border-radius: 10px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0 0 5px 0; color: rgba(255, 255, 255, 0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Amount</p>
                    <p style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">&#x20AC;${data.finalPrice.toFixed(2)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          
          ${data.paymentStatus ? generatePaymentStatusHtml(data.paymentStatus) : ""}

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 30px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                Have questions? We're here to help!
              </p>
              <p style="margin: 0 0 20px 0; color: #006B8F; font-size: 16px; font-weight: 600;">
                &#x1F4DE; +357 99877866
              </p>
              <table role="presentation" style="margin: 0 auto 20px auto; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="https://www.google.com/maps/place/Park+%26+Travel/@34.8768671,33.599746,17z/data=!3m1!4b1!4m6!3m5!1s0x14e09cc6984f5de5:0x4f64d897eb55fa85!8m2!3d34.8768671!4d33.6023209!16s%2Fg%2F11dxm5p8qt?authuser=0&entry=ttu&g_ep=EgoyMDI2MDMzMC4wIKXMDSoASAFQAw%3D%3D"
                       target="_blank"
                       style="display: inline-block; background-color: #006B8F; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; letter-spacing: 0.3px;">
                      &#x1F4CD; View Our Location on Google Maps
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                &copy; ${new Date().getFullYear()} Powered by <a href="https://powersoft365.com" target="_blank" style="color: #94a3b8; text-decoration: none;">Powersoft</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function generateBookingConfirmationText(data: BookingEmailData): string {
  const vehicle = data.vehicleModel
    ? `${data.vehicleBrand} ${data.vehicleModel}`
    : data.vehicleBrand;

  let title: string;
  let message: string;
  if (data.isPaymentConfirmation) {
    title = 'PAYMENT CONFIRMED';
    message = `Dear ${data.fullName}, your payment has been received and your parking reservation is fully confirmed.`;
  } else if (data.isUpdate) {
    title = 'BOOKING UPDATED';
    message = `Dear ${data.fullName}, your parking reservation has been successfully updated.`;
  } else {
    title = 'BOOKING CONFIRMATION';
    message = `Thank you, ${data.fullName}! Your parking reservation has been successfully created.`;
  }

  let text = `
${title} - Park & Travel
=====================================

${message}

RESERVATION DETAILS
-------------------

Check-in: ${formatDate(data.checkInDate)} at ${formatTime(data.checkInTime)}
Check-out: ${data.checkOutDate ? `${formatDate(data.checkOutDate)}${data.checkOutTime ? ` at ${formatTime(data.checkOutTime)}` : ''}` : 'To be determined'}

Vehicle: ${vehicle}${data.vehicleColor ? ` (${data.vehicleColor})` : ""}
License Plate: ${data.licensePlate}

Parking Type: ${data.parkingType}
Car Wash: ${data.washService ? "Included" : "Not selected"}
`;

  if (data.flightNumber) {
    text += `Return Flight: ${data.flightNumber}\n`;
  }

  if (data.dropOffOption) {
    text += `Drop-off: ${getTransportLabel(data.dropOffOption)}\n`;
  }

  if (data.pickUpOption) {
    text += `Pick-up: ${getTransportLabel(data.pickUpOption)}\n`;
  }

  if (data.emailDescription) {
    text += `\n${data.emailDescription}\n`;
  }

  if (data.finalPrice !== null) {
    text += `
TOTAL AMOUNT
------------
EUR ${data.finalPrice.toFixed(2)}
`;
  }

  if (data.paymentStatus) {
    text += `
PAYMENT STATUS
--------------
${data.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
`;
    if (data.paymentStatus === 'pending') {
      text += `Your booking has been created. You can complete the payment at your convenience.\n`;
    }
  }

  text += `
FIND US
-------
View our location on Google Maps:
https://www.google.com/maps/place/Park+%26+Travel/@34.8768671,33.599746,17z/data=!3m1!4b1!4m6!3m5!1s0x14e09cc6984f5de5:0x4f64d897eb55fa85!8m2!3d34.8768671!4d33.6023209!16s%2Fg%2F11dxm5p8qt?authuser=0&entry=ttu&g_ep=EgoyMDI2MDMzMC4wIKXMDSoASAFQAw%3D%3D
`;

  return text;
}

function getEmailSubject(data: BookingEmailData): string {
  if (data.isPaymentConfirmation) return "Payment Confirmed - Park & Travel";
  if (data.isUpdate) return "Booking Updated - Park & Travel";
  return "Booking Confirmed - Park & Travel";
}

export async function sendBookingConfirmationEmail(
  data: BookingEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  const fromName = process.env.FROM_NAME || "Park & Travel";
  const fromEmail = process.env.BREVO_SENDER_EMAIL || "";
  const replyTo = process.env.BREVO_REPLY_TO_EMAIL || fromEmail;

  const body: Record<string, any> = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: data.email, name: data.fullName }],
    replyTo: { email: replyTo },
    subject: getEmailSubject(data),
    htmlContent: generateBookingConfirmationHtml(data),
    textContent: generateBookingConfirmationText(data),
  };

  if (data.receiptPdfBuffer) {
    body.attachment = [{
      name: "receipt.pdf",
      content: data.receiptPdfBuffer.toString("base64"),
    }];
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await response.json() as any;

    if (!response.ok) {
      const errMsg = json?.message || response.statusText;
      console.error("Failed to send email:", errMsg);
      return { success: false, error: errMsg };
    }

    console.log("Email sent successfully:", json.messageId);
    return { success: true, messageId: json.messageId };
  } catch (error: any) {
    console.error("Failed to send email:", error.message);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

interface DocumentEmailData {
  email: string;
  subject: string;
  bodyText: string;
  pdfBuffer: Buffer;
  attachmentName: string;
}

function generateDocumentEmailHtml(bodyText: string): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, Helvetica, sans-serif; color: #212529; line-height: 1.6;">
  <p>${bodyText}</p>
  <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Park &amp; Travel</p>
</body>
</html>`;
}

export async function sendDocumentEmail(
  data: DocumentEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  const fromName = process.env.FROM_NAME || "Park & Travel";
  const fromEmail = process.env.BREVO_SENDER_EMAIL || "";
  const replyTo = process.env.BREVO_REPLY_TO_EMAIL || fromEmail;

  const body: Record<string, any> = {
    sender: { name: fromName, email: fromEmail },
    to: [{ email: data.email }],
    replyTo: { email: replyTo },
    subject: data.subject,
    htmlContent: generateDocumentEmailHtml(data.bodyText),
    textContent: data.bodyText,
    attachment: [{
      name: data.attachmentName,
      content: data.pdfBuffer.toString("base64"),
    }],
  };

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await response.json() as any;

    if (!response.ok) {
      const errMsg = json?.message || response.statusText;
      console.error("Failed to send document email:", errMsg);
      return { success: false, error: errMsg };
    }

    console.log("Document email sent successfully:", json.messageId);
    return { success: true, messageId: json.messageId };
  } catch (error: any) {
    console.error("Failed to send document email:", error.message);
    return { success: false, error: error.message || "Failed to send email" };
  }
}

export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { success: false, error: "BREVO_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey },
    });

    if (!response.ok) {
      const json = await response.json() as any;
      const errMsg = json?.message || response.statusText;
      console.error("Brevo API key verification failed:", errMsg);
      return { success: false, error: errMsg };
    }

    console.log("Brevo API key verified successfully");
    return { success: true };
  } catch (error: any) {
    console.error("Brevo API connection failed:", error.message);
    return { success: false, error: error.message || "Brevo API connection failed" };
  }
}
