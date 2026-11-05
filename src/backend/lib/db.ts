import { SheetDB } from "@gasboost/sheetorm";
import { rls } from "./rls";
import { sheetGateway, sheetTables } from "./sheets";

export const db = new SheetDB({
  tables: sheetTables,
  gateway: sheetGateway,
  cacheService: CacheService,
  utilities: Utilities,
  rowLevelSecurity: rls,
  lockService: LockService,
});

export type DB = typeof db;
