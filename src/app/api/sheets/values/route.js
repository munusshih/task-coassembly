import { NextResponse } from "next/server";
import { google } from "googleapis";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

function parseSpreadsheetId(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";

  const urlMatch = text.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];

  return text;
}

async function readServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  const rootDir = /* turbopackIgnore: true */ process.cwd();
  const candidateFiles = [
    resolve(rootDir, "coassembly-finance-136ad8cbfec8.json"),
  ];

  for (const filePath of candidateFiles) {
    try {
      await access(filePath);
      const fileContent = await readFile(filePath, "utf8");
      return JSON.parse(fileContent);
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(
    "Missing Google service-account credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or provide local coassembly-finance-136ad8cbfec8.json.",
  );
}

function resolveSpreadsheetId() {
  const fromId = parseSpreadsheetId(process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
  if (fromId) return fromId;

  const fromUrl = parseSpreadsheetId(
    process.env.GOOGLE_SHEETS_SPREADSHEET_URL,
  );
  if (fromUrl) return fromUrl;

  const defaultUrl = parseSpreadsheetId(
    "https://docs.google.com/spreadsheets/d/1lkDGH44Ut3sBiMe9Jr70hRX-YQSCqAPgUb1ubs82uqc/edit?usp=sharing",
  );
  if (defaultUrl) return defaultUrl;

  throw new Error(
    "Set GOOGLE_SHEETS_SPREADSHEET_ID or GOOGLE_SHEETS_SPREADSHEET_URL.",
  );
}

function resolveRange(request) {
  const url = new URL(request.url);
  return (
    url.searchParams.get("range") ||
    process.env.GOOGLE_SHEETS_DEFAULT_RANGE ||
    "日記帳(每日記錄)!A:ZZ"
  );
}

async function buildSheetsClient() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: await readServiceAccountCredentials(),
      scopes: [SHEETS_READONLY_SCOPE],
    });
    return google.sheets({ version: "v4", auth });
  } catch (error) {
    throw new Error(error?.message || "Could not initialize Google Sheets client.");
  }
}

async function getValuesWithFallback(sheets, spreadsheetId, range) {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return {
      values: result.data.values || [],
      rangeUsed: range,
    };
  } catch (error) {
    const message = String(error?.message || "");
    if (!/Unable to parse range/i.test(message)) {
      throw error;
    }

    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    });
    const firstTitle =
      metadata?.data?.sheets?.[0]?.properties?.title || "Sheet1";
    const fallbackRange = `${firstTitle}!A:ZZ`;
    const fallback = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fallbackRange,
    });

    return {
      values: fallback.data.values || [],
      rangeUsed: fallbackRange,
    };
  }
}

export async function GET(request) {
  try {
    const range = resolveRange(request);
    const sheets = await buildSheetsClient();
    const spreadsheetId = resolveSpreadsheetId();

    const result = await getValuesWithFallback(sheets, spreadsheetId, range);

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      range: result.rangeUsed,
      values: result.values,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to read Google Sheet. Check service account and env config.",
      },
      { status: 500 },
    );
  }
}
