const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const twilio = require("twilio");

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ===========================
// 🔥 GOOGLE SHEETS FUNCTION
// ===========================
async function getVisaInfo(country, visaType) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "cred.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: "YOUR_SPREADSHEET_ID",
    range: "VisaData!A:D",
  });
  const rows = res.data.values;

  for (let row of rows.slice(1)) {
    if (
      row[0]?.toLowerCase() === country.toLowerCase() &&
      row[1]?.toLowerCase() === visaType.toLowerCase()
    ) {
      return {
        cost: row[2],
        requirements: row[3],
      };
    }
  }
  return null;
}

// ===========================
// ⚡️ DIALOGFLOW WEBHOOK
// ===========================
app.post("/webhook", async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const country = req.body.queryResult.parameters.country_name;
  const visaType = req.body.queryResult.parameters.visa_type;

  const result = await getVisaInfo(country, visaType);
  if (!result) {
    return res.json({ fulfillmentText: "I couldn’t find that visa information." });
  }

  if (intent === "Get Visa Cost") {
    res.json({ fulfillmentText: `We charge ${result.cost} for ${country} ${visaType} visa.` });
  } else if (intent === "Get Visa Requirements") {
    res.json({ fulfillmentText: `You need ${result.requirements} for ${country} ${visaType} visa.` });
  } else {
    res.json({ fulfillmentText: "I didn't understand the request." });
  }
});

// ===========================
// 📱 WHATSAPP WEBHOOK
// ===========================
app.post("/whatsapp", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const userMessage = req.body.Body;

  // Very Simple Parser (you can make it smarter!)
  // Expect user message like: "cost tourist Malaysia"
  const words = userMessage.trim().split(/\s+/);
  if (words.length < 3) {
    twiml.message("Please ask like: cost tourist Malaysia OR requirements tourist Malaysia");
    res.writeHead(200, { "Content-Type": "text/xml" });
    return res.end(twiml.toString());
  }

  const [queryType, visaType, country] = words;

  const result = await getVisaInfo(country, visaType);
  if (!result) {
    twiml.message("I couldn’t find that visa information.");
  } else {
    if (queryType.toLowerCase() === "cost") {
      twiml.message(`We charge ${result.cost} for ${country} ${visaType} visa.`);
    } else if (queryType.toLowerCase() === "requirements") {
      twiml.message(`You need ${result.requirements} for ${country} ${visaType} visa.`);
    } else {
      twiml.message("I didn't understand your request. Try: cost tourist Malaysia");
    }
  }

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

// ===========================
// 🚀 START SERVER
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
