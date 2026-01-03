// ✅ REQUIRED for Vercel Node.js
module.exports.config = {
  runtime: "nodejs",
};

// ✅ Normalize phone number to XXX-XXX-XXXX
function formatPhoneXXX(phone) {
  if (!phone) return null;

  // Remove everything except digits
  const digits = phone.replace(/\D/g, "");

  // Support US numbers only
  const normalized =
    digits.length === 10
      ? digits
      : digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : null;

  if (!normalized) return null;

  return `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;
}


module.exports.default = async function handler(req, res) {
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

  if (is_emergency === true) {
    return res.status(200).json({
      success: true,
      message: "Emergency flagged – manual follow-up required",
    });
  }

 const formattedPhone = formatPhoneXXX(phone_number);
  if (!formattedPhone) {
  return res.status(400).json({
    success: false,
    error: "Invalid phone number format",
  });
}


  const startTime = new Date(`${preferred_date}T${preferred_time}:00-05:00`);
  if (isNaN(startTime.getTime())) {
    return res.status(400).json({
      success: false,
      error: "Invalid date or time format",
    });
  }

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
          metadata: {},
          responses: {
            name: patient_name,
            attendeePhoneNumber: formattedPhone,
            notes: appointment_reason,
            email: "noemail@yourclinic.com",
            location: "In-person",
          },
        }),
      }
    );

    const result = await calResponse.json();

    // 🔥 CRITICAL FIX: treat payload errors as failures
    if (
      !calResponse.ok ||
      result?.message === "no_available_users_found_error" ||
      result?.message?.includes("no_available") ||
      !result?.id
    ) {
      console.error("❌ Cal.com booking failed:", result);

      return res.status(409).json({
        success: false,
        code: "TIME_SLOT_UNAVAILABLE",
        message:
          "That time is no longer available. Would you like to choose a different time?",
      });
    }

    console.log("✅ Booking created:", result);

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
};
