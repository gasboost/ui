import { SheetGateway, SheetTable } from "@gasboost/sheetorm";
import { authTables, authorizationTables } from "../../shared/tables";

function resolveSpreadsheetId(): string {
  const configuredSpreadsheetId =
    PropertiesService.getScriptProperties().getProperty(
      "GASBOOST_SPREADSHEET_ID",
    );

  if (configuredSpreadsheetId !== null && configuredSpreadsheetId.length > 0) {
    return configuredSpreadsheetId;
  }

  /*
   * Container-bound Apps Script projects may use their active
   * spreadsheet. The local SpreadsheetAppStub also provides a fixed
   * active spreadsheet ID, which keeps local development zero-config.
   */
  const activeSpreadsheetId = SpreadsheetApp.getActive()?.getId();

  if (
    activeSpreadsheetId !== undefined &&
    activeSpreadsheetId !== null &&
    activeSpreadsheetId.length > 0
  ) {
    return activeSpreadsheetId;
  }

  throw new Error(
    "Spreadsheet ID is not configured. " +
      "Set GASBOOST_SPREADSHEET_ID in Apps Script Script Properties.",
  );
}

export const spreadsheetId = resolveSpreadsheetId();

const userTable = new SheetTable({
  ...authTables.user,
  dbId: spreadsheetId,
});

const accountTable = new SheetTable({
  ...authTables.account,
  dbId: spreadsheetId,
});

const passwordResetTable = new SheetTable({
  ...authTables.passwordReset,
  dbId: spreadsheetId,
});

const roleTable = new SheetTable({
  ...authorizationTables.role,
  dbId: spreadsheetId,
});

const permissionTable = new SheetTable({
  ...authorizationTables.permission,
  dbId: spreadsheetId,
});

export const sheetTables = [
  userTable,
  accountTable,
  passwordResetTable,
  roleTable,
  permissionTable,
] as const;

export const sheetGateway = new SheetGateway(Sheets!);
