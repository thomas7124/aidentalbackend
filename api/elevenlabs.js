export const config = {
  runtime: "nodejs",
};

// ✅ Phone normalization (E.164 required by Cal.com)
function normalizePhoneNumber(phone) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;

  return null;
}

export default async function handler(req, res) {
  console.log("🔥 Function invoked");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1️⃣ Extract body
  const {
    patient_name,
    phone_number,
    appointment_reason,
    preferred_date,
    preferred_time,
    is_emergency = false,
  } = req.body;

  if (
    !patient_name ||
    !phone_number ||
    !appointment_reason ||
    !preferred_date ||
    !preferred_time
  ) {
    return res.status(400).json({
      success: false,
      error: "Missing required appointment fields",
    });
  }

  // 🚨 Emergency shortcut
  if (is_emergency === true) {
    return res.status(200).json({
      success: true,
      message: "Emergency flagged – manual follow-up required",
    });
  }

  // 2️⃣ Normalize phone
  const normalizedPhone = normalizePhoneNumber(phone_number);

  if (!normalizedPhone) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number format",
    });
  }

  // 3️⃣ Create start time
  const startTime = new Date(
    `${preferred_date}T${preferred_time}:00-05:00`
  );

  if (isNaN(startTime.getTime())) {
    return res.status(400).json({
      success: false,
      error: "Invalid date or time format",
    });
  }

  // 4️⃣ Idempotency key (NOW safe to compute)
  const bookingKey = `${patient_name}-${normalizedPhone}-${startTime.toISOString()}`;
  console.log("🔐 Booking key:", bookingKey);

  try {
    const calResponse = await fetch(
      `https://api.cal.com/v1/bookings?apiKey=${process.env.CAL_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventTypeId: Number(process.env.CAL_EVENT_TYPE_ID),
          start: startTime.toISOString(),
          timeZone: "America/New_York",
          language: "en",
          metadata: { bookingKey },

          responses: {
            name: patient_name,
            attendeePhoneNumber: normalizedPhone,
            notes: appointment_reason,
            email: "noemail@yourclinic.com",
            location: "In-person",
          },
        }),
      }
    );

    const result = await calResponse.json();

    // ❌ Booking failed — DO NOT tell the bot it succeeded
// ❌ Cal.com sometimes returns 200 even on failure — check payload
if (
  !calResponse.ok ||
  result?.message === "no_available_users_found_error" ||
  result?.message?.includes("no_available")
) {
  console.error("❌ Cal.com booking failed:", result);

  return res.status(409).json({
    success: false,
    code: "TIME_SLOT_UNAVAILABLE",
    message:
      "That time is no longer available. Would you like to choose a different time?",
  });
}


  // Any other Cal.com error
  return res.status(500).json({
    success: false,
    code: "CAL_API_ERROR",
    message: "Unable to book the appointment right now.",
    details: result,
  });
}


    console.log("✅ Booking created:", result);

    // ✅ ONLY success response ElevenLabs should trust
    return res.status(200).json({
      success: true,
      message: "Appointment booked successfully",
      booking: result,
    });

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
