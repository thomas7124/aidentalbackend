// ✅ REQUIRED for Vercel Node.js
module.exports.config = {
  runtime: "nodejs",
};

// ✅ Normalize phone to E.164 (+1XXXXXXXXXX), US/Canada only
function formatPhoneE164(phone) {
  if (!phone) return null;

  // Convert to string and remove everything except digits
  const digits = String(phone).replace(/\D/g, "");

  // Handle common cases:
  // 10 digits: XXXXXXXXXX
  // 11 digits starting with 1: 1XXXXXXXXXX
  let ten;
  if (digits.length === 10) {
    ten = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    ten = digits.slice(1);
  } else {
    return null;
  }

  // Optional: basic sanity checks (avoid 000/111 junk)
  // if (ten.startsWith("000")) return null;

  return `+1${ten}`;
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

const formattedPhone = formatPhoneE164(phone_number);

if (!formattedPhone) {
  return res.status(400).json({
    success: false,
    code: "INVALID_PHONE",
    message:
      "I couldn’t understand that phone number. Please say your 10-digit phone number including area code.",
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
        email: "noemail@yourclinic.com",
        notes: appointment_reason,

        // ✅ STEP 4 GOES HERE
        smsReminderNumber: formattedPhone,
        location: {
          value: "userPhone",
          optionValue: formattedPhone,
        },
      },
    }),
  }
);
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
