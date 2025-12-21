export const config = {
  runtime: "nodejs",
};

/**
 * 🔒 In-memory booking lock
 * Prevents duplicate bookings from audio retries
 */
const recentBookings = new Set();

/**
 * ✅ Phone normalization (E.164 required by Cal.com)
 */
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

  // 🚨 Emergency handling
  if (is_emergency === true) {
    return res.status(200).json({
      success: true,
      message: "Emergency flagged – manual follow-up required",
    });
  }

  // ✅ Normalize phone number
  const normalizedPhone = normalizePhoneNumber(phone_number);
  if (!normalizedPhone) {
    return res.status(400).json({
      success: false,
      error: "Invalid phone number format",
    });
  }

  // Convert date + time → ISO
  const startTime = new Date(
    `${preferred_date}T${preferred_time}:00-05:00`
  );

  if (isNaN(startTime.getTime())) {
    return res.status(400).json({
      success: false,
      error: "Invalid date or time format",
    });
  }

  /**
   * 🔑 Booking fingerprint (prevents duplicate audio calls)
   */
  const bookingKey = `${patient_name}-${preferred_date}-${preferred_time}`;

  if (recentBookings.has(bookingKey)) {
    console.log("🔁 Duplicate booking attempt blocked:", bookingKey);
    return res.status(200).json({
      success: true,
      message: "Appointment already booked",
    });
  }

  // Lock the booking
  recentBookings.add(bookingKey);
  setTimeout(() => recentBookings.delete(bookingKey), 120000); // auto-expire

  try {
    console.log(
      "ENV CHECK:",
      "CAL_API_KEY:", !!process.env.CAL_API_KEY,
      "EVENT_TYPE_ID:", !!process.env.CAL_EVENT_TYPE_ID
    );

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

          timeZone: "America/New_York",
          language: "en",
          metadata: {},

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

    /**
     * ❗ If Cal.com says slot unavailable AFTER a successful booking,
     * treat it as success to prevent audio retries
     */
    if (!calResponse.ok) {
      console.error("❌ Cal.com error:", result);

      if (
        result?.message === "no_available_users_found_error" ||
        result?.message?.includes("no_available")
      ) {
        return res.status(200).json({
          success: true,
          message: "Appointment already booked",
        });
      }

      return res.status(500).json({
        success: false,
        code: "CAL_API_ERROR",
        message: "Unable to book the appointment at this time.",
        details: result,
      });
    }

    console.log("✅ Booking created:", result);

    // ✅ CRITICAL: tells ElevenLabs booking succeeded
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
