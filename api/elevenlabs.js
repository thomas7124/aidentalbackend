export const config = {
  runtime: "nodejs",
};

/**
 * Normalize US phone numbers to E.164 format
 * Examples:
 *  6572396233   -> +16572396233
 *  (657)239-6233 -> +16572396233
 *  +16572396233 -> +16572396233
 */
function toE164US(phone) {
  if (!phone) return null;

  const digits = String(phone).replace(/\D/g, "");

  // Already E.164 with country code
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Standard US 10-digit number
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Invalid
  return null;
}

export default async function handler(req, res) {
  console.log("🔥 Function invoked");

  if (req.method !== "POST") {
    console.log("❌ Not POST:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("📦 Raw body:", JSON.stringify(req.body, null, 2));

  const {
    patient_name,
    phone_number,
    appointment_reason,
    preferred_date,
    preferred_time,
    is_emergency = false
  } = req.body;

  // Basic validation
  if (
    !patient_name ||
    !phone_number ||
    !appointment_reason ||
    !preferred_date ||
    !preferred_time
  ) {
    return res.status(400).json({
      error: "Missing required appointment fields"
    });
  }

  // 🚨 Emergency handling
  if (is_emergency === true) {
    console.log("🚨 Emergency appointment detected");
    return res.status(200).json({
      status: "Emergency flagged – manual follow-up required"
    });
  }

  // ✅ Normalize phone number
  const attendeePhoneNumber = toE164US(phone_number);

  if (!attendeePhoneNumber) {
    return res.status(400).json({
      error: "Invalid phone number format. Must include area code."
    });
  }

  // Convert date + time → ISO
  const startTime = new Date(
    `${preferred_date}T${preferred_time}:00-05:00`
  );

  if (isNaN(startTime.getTime())) {
    return res.status(400).json({
      error: "Invalid date or time format"
    });
  }

  try {
    console.log(
      "ENV CHECK:",
      "CAL_API_KEY:", !!process.env.CAL_API_KEY,
      "EVENT_TYPE_ID:", !!process.env.CAL_EVENT_TYPE_ID
    );

    console.log("CAL_API_KEY length:", process.env.CAL_API_KEY?.length);

    const calResponse = await fetch(
      `https://api.cal.com/v1/bookings?apiKey=${process.env.CAL_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
          start: startTime.toISOString(),

          // ✅ REQUIRED FIELDS
          timeZone: "America/New_York",
          language: "en",
          metadata: {},

          responses: {
            name: patient_name,
            attendeePhoneNumber, // ✅ FIXED FORMAT
            notes: appointment_reason,
            email: "noemail@yourclinic.com",
            location: "In-person",
          },
        }),
      }
    );

    const result = await calResponse.json();

    if (!calResponse.ok) {
      console.error("❌ Cal.com error:", result);
      return res.status(500).json({
        error: "Failed to create calendar booking",
        details: result
      });
    }

    console.log("✅ Booking created:", result);

    return res.status(200).json({
      status: "Appointment booked",
      booking: result
    });

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
