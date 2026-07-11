/**
 * Google Sheets Manager
 * Handles all Google Sheets operations for Tammy Brightwood classroom system
 */

const { google } = require("googleapis");

class GoogleSheetsManager {
  constructor() {
    this.sheets = null;
    this.serviceAccount = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Sheets API with service account
   */
  async initialize() {
    try {
      const accountJson = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "", "base64").toString("utf8");
      this.serviceAccount = JSON.parse(accountJson);

      const auth = new google.auth.GoogleAuth({
        credentials: this.serviceAccount,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      this.sheets = google.sheets({ version: "v4", auth });
      this.initialized = true;
      console.log("✅ Google Sheets API initialized");
      return true;
    } catch (e) {
      console.error("❌ Google Sheets init error:", e.message);
      return false;
    }
  }

  /**
   * Get all values from a sheet
   */
  async getSheetValues(spreadsheetId, sheetName) {
    if (!this.initialized) await this.initialize();

    try {
      const result = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      return result.data.values || [];
    } catch (e) {
      console.error(`❌ Get sheet error (${sheetName}):`, e.message);
      return [];
    }
  }

  /**
   * Add row to sheet
   */
  async appendRow(spreadsheetId, sheetName, values) {
    if (!this.initialized) await this.initialize();

    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [values] },
      });

      return true;
    } catch (e) {
      console.error(`❌ Append row error (${sheetName}):`, e.message);
      return false;
    }
  }

  /**
   * Update cell value
   */
  async updateCell(spreadsheetId, sheetName, row, col, value) {
    if (!this.initialized) await this.initialize();

    try {
      const colLetter = String.fromCharCode(65 + col);
      const range = `${sheetName}!${colLetter}${row}`;

      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[value]] },
      });

      return true;
    } catch (e) {
      console.error(`❌ Update cell error (${sheetName}):`, e.message);
      return false;
    }
  }

  /**
   * Find row by value in column
   */
  async findRowByValue(spreadsheetId, sheetName, colIndex, value) {
    const rows = await this.getSheetValues(spreadsheetId, sheetName);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][colIndex] === value) return i + 1; // 1-indexed
    }
    return -1;
  }

  /**
   * Get student data
   */
  async getStudent(studentSheetId, studentId) {
    const rows = await this.getSheetValues(studentSheetId, "Students");
    if (!rows || rows.length === 0) return null;

    const headers = rows[0];
    const studentIdCol = headers.indexOf("student_id");

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][studentIdCol] === studentId) {
        return this._rowToObject(headers, rows[i]);
      }
    }

    return null;
  }

  /**
   * Get all students
   */
  async getStudents(studentSheetId) {
    const rows = await this.getSheetValues(studentSheetId, "Students");
    if (!rows || rows.length < 2) return [];

    const headers = rows[0];
    return rows.slice(1).map((row) => this._rowToObject(headers, row));
  }

  /**
   * Get grades for student
   */
  async getStudentGrades(gradeSheetId, studentId) {
    const rows = await this.getSheetValues(gradeSheetId, "Master Grade Ledger");
    if (!rows || rows.length === 0) return [];

    const headers = rows[0];
    const studentIdCol = headers.indexOf("student_id");

    return rows
      .slice(1)
      .filter((row) => row[studentIdCol] === studentId)
      .map((row) => this._rowToObject(headers, row));
  }

  /**
   * Convert row to object using headers
   */
  _rowToObject(headers, row) {
    const obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i] || "";
    });
    return obj;
  }
}

module.exports = { GoogleSheetsManager };
