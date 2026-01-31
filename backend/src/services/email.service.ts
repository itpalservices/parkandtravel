import * as brevo from "@getbrevo/brevo";

const apiInstance = new brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ""
);

interface BookingEmailData {
  email: string;
  fullName: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
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
          
          <!-- Success Badge -->
          <tr>
            <td align="center" style="padding: 30px 30px 20px 30px;">
              <h2 style="color: #2e7d32; margin: 20px 0 10px 0; font-size: 24px; font-weight: 600;">Booking Confirmed!</h2>
              <p style="color: #666666; margin: 0; font-size: 16px; line-height: 1.6;">
                Thank you, <strong style="color: #333333;">${data.fullName}</strong>! Your parking reservation has been successfully created.
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
                      📅 Reservation Details
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
                  <td style="padding: 15px 25px; width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0;">
                    <p style="margin: 0 0 5px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Check-out</p>
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">${formatDate(data.checkOutDate)}</p>
                    <p style="margin: 5px 0 0 0; color: #006B8F; font-size: 14px; font-weight: 500;">${formatTime(data.checkOutTime)}</p>
                  </td>
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
                      ${data.washService ? "✓ Included" : "No"}
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
                    <p style="margin: 0; color: #1e293b; font-size: 15px; font-weight: 600;">✈️ ${data.flightNumber}</p>
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
          
          ${data.finalPrice !== null ? `
          <!-- Price Section -->
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #006B8F 0%, #008BB5 100%); border-radius: 10px;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <p style="margin: 0 0 5px 0; color: rgba(255, 255, 255, 0.8); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Amount</p>
                    <p style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700;">€${data.finalPrice.toFixed(2)}</p>
                    <p style="margin: 10px 0 0 0; color: rgba(255, 255, 255, 0.7); font-size: 13px;">Payment due upon arrival</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 30px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                Have questions? We're here to help!
              </p>
              <p style="margin: 0 0 20px 0; color: #006B8F; font-size: 16px; font-weight: 600;">
                📞 Contact Park & Travel Support
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © ${new Date().getFullYear()} Park & Travel. All rights reserved.<br>
                Secure Airport Parking Services
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

  let text = `
BOOKING CONFIRMATION - Park & Travel
=====================================

Thank you, ${data.fullName}! Your parking reservation has been successfully created.

RESERVATION DETAILS
-------------------

Check-in: ${formatDate(data.checkInDate)} at ${formatTime(data.checkInTime)}
Check-out: ${formatDate(data.checkOutDate)} at ${formatTime(data.checkOutTime)}

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

  if (data.finalPrice !== null) {
    text += `
TOTAL AMOUNT
------------
€${data.finalPrice.toFixed(2)}
`;
  }

  return text;
}

export async function sendBookingConfirmationEmail(
  data: BookingEmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!process.env.BREVO_API_KEY) {
    console.error("BREVO_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    
    sendSmtpEmail.subject = "✅ Booking Confirmed - Park & Travel";
    sendSmtpEmail.htmlContent = generateBookingConfirmationHtml(data);
    sendSmtpEmail.textContent = generateBookingConfirmationText(data);
    sendSmtpEmail.sender = {
      name: "Park & Travel",
      email: process.env.BREVO_SENDER_EMAIL || "it.pal.service@gmail.com",
    };
    sendSmtpEmail.to = [
      {
        email: data.email,
        name: data.fullName,
      },
    ];
    sendSmtpEmail.replyTo = {
      email: process.env.BREVO_REPLY_TO_EMAIL || "support@parkandtravel.com",
      name: "Park & Travel Support",
    };

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    console.log("Email sent successfully:", result.body);
    return { 
      success: true, 
      messageId: result.body?.messageId 
    };
  } catch (error: any) {
    const errorDetails = error.body || error.response?.data || { message: error.message };
    console.error("Failed to send email. Error details:", errorDetails);
    console.error("Sender email used:", process.env.BREVO_SENDER_EMAIL || "it.pal.service@gmail.com");
    return { 
      success: false, 
      error: errorDetails?.message || error.message || "Failed to send email" 
    };
  }
}

export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  if (!process.env.BREVO_API_KEY) {
    return { success: false, error: "BREVO_API_KEY not configured" };
  }

  try {
    const accountApi = new brevo.AccountApi();
    accountApi.setApiKey(
      brevo.AccountApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );
    
    const result = await accountApi.getAccount();
    console.log("Brevo account connected:", result.body?.email);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to connect to Brevo:", error.body || error.message);
    return { 
      success: false, 
      error: error.body?.message || error.message || "Connection failed" 
    };
  }
}
