export function insertAndReturnId(database: any, table: any, values: any) {
  const row = database.insert(table).values(values).returning({ id: table.id }).get() as { id: number } | undefined;
  if (!row) {
    throw new Error(`Insert into ${table?.[Symbol.for("drizzle:Name")] ?? "table"} did not return an id.`);
  }
  return Number(row.id);
}

export function insertAndReturnRow<TSelected extends Record<string, unknown>>(
  database: any,
  table: any,
  values: any,
  selection: Record<string, unknown>,
) {
  const row = database.insert(table).values(values).returning(selection).get() as TSelected | undefined;
  if (!row) {
    throw new Error(`Insert into ${table?.[Symbol.for("drizzle:Name")] ?? "table"} did not return a row.`);
  }
  return row;
}
