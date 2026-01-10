import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const loadEnv = (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }
  const contents = fs.readFileSync(filePath, "utf8");
  contents.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      return;
    }
    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  });
};

const resolvePath = (inputPath) => path.resolve(process.cwd(), inputPath);

export const exportSql = async ({
  rpcName,
  envPath,
  outputPath,
  headerLines,
  transformLines,
}) => {
  const resolvedEnvPath = envPath ? resolvePath(envPath) : null;
  const resolvedOutputPath = resolvePath(outputPath);

  loadEnv(resolvedEnvPath);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const envHint = resolvedEnvPath ? resolvedEnvPath : "the current environment";
    console.error(
      `Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in ${envHint}.`
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.rpc(rpcName);

  if (error) {
    console.error(`Failed to export ${rpcName}:`, error.message);
    process.exit(1);
  }

  const lines = Array.isArray(data) ? data.map((row) => row?.line ?? "") : [];
  const finalLines = transformLines ? transformLines(lines) : lines;
  const contents = [...headerLines, "", ...finalLines, ""].join("\n");

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, contents, "utf8");

  console.log(`Wrote ${resolvedOutputPath}`);
};
