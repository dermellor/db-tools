import { Client } from "pg";
import { bootstrapSqlByRpc } from "./bootstrap-sql.mjs";

const missingFunctionPatterns = [
  /Could not find the function .* without parameters/i,
  /function .* does not exist/i,
];

const isMissingFunctionError = (error) => {
  const message = error?.message || "";
  return missingFunctionPatterns.some((pattern) => pattern.test(message));
};

const buildClientOptions = (databaseUrl) => {
  if (!databaseUrl) {
    return null;
  }
  const needsSsl =
    databaseUrl.includes("sslmode=require") || databaseUrl.includes("supabase.co");
  if (!needsSsl) {
    return { connectionString: databaseUrl };
  }
  if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  return {
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  };
};

export const maybeBootstrapFunction = async ({ rpcName, error, databaseUrl }) => {
  if (!isMissingFunctionError(error)) {
    return false;
  }

  const sql = bootstrapSqlByRpc[rpcName];
  if (!sql) {
    console.error(`No bootstrap SQL available for ${rpcName}.`);
    process.exit(1);
  }

  const clientOptions = buildClientOptions(databaseUrl);
  if (!clientOptions) {
    console.error(
      "Missing DATABASE_URL. Set it to a Postgres connection string to bootstrap functions."
    );
    process.exit(1);
  }

  const client = new Client(clientOptions);
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Bootstrapped ${rpcName} via DATABASE_URL.`);
  } finally {
    await client.end();
  }

  return true;
};
