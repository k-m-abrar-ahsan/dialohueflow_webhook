const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const path = require("path");

const app = express();
app.use(bodyParser.json());

/**
 * ✅ Helper function to get Visa Info from Google Sheets
 */
async function getVisaInfo(country, visaType) {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "cred.json"), // Ensure cred.json is in the same directory
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: "1OJp_uRS9U-MMygvRG_cY4TkiDalVVM8P_OBcRFRT548", // <-- Replace with actual ID
    range: "VisaData!A:D",
  });
  const rows = res.data.values;

  for (let row of rows.slice(1)) {
    if (
      row[0]?.toLowerCase() === country?.toLowerCase() &&
      row[1]?.toLowerCase() === visaType?.toLowerCase()
    ) {
      return {
        cost: row[2],
        requirements: row[3],
      };
    }
  }
  return null;
}

/**
 * ✅ Route for Dialogflow Webhook
 */
app.post("/webhook", async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const country = req.body.queryResult.parameters.country_name;
  const visaType = req.body.queryResult.parameters.visa_type;

  try {
    const result = await getVisaInfo(country, visaType);
    if (!result) {
      return res.json({ fulfillmentText: "I couldn’t find that visa information." });
    }

    if (intent === "Get Visa Cost") {
      res.json({ fulfillmentText: `We charge ${result.cost} for a ${country} ${visaType} visa.` });
    } else if (intent === "Get Visa Requirements") {
      res.json({ fulfillmentText: `You need ${result.requirements} for a ${country} ${visaType} visa.` });
    } else {
      res.json({ fulfillmentText: "I didn't understand the request." });
    }
  } catch (error) {
    console.error(error);
    res.json({ fulfillmentText: "There was an error processing your request." });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Webhook is running on port ${PORT}`);
});
