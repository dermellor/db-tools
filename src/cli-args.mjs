const valueFlags = new Set(["--env", "-e", "--output", "--out", "-o"]);

export const parseCliArgs = ({ argv, defaults, usage }) => {
  const options = { ...defaults };
  const unknown = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (valueFlags.has(arg)) {
      const next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        console.error(`Missing value for ${arg}`);
        if (usage) {
          console.error(usage);
        }
        process.exit(1);
      }
      i += 1;
      if (arg === "--env" || arg === "-e") {
        options.env = next;
      } else {
        options.output = next;
      }
      continue;
    }

    unknown.push(arg);
  }

  if (unknown.length > 0) {
    console.error(`Unknown arguments: ${unknown.join(", ")}`);
    if (usage) {
      console.error(usage);
    }
    process.exit(1);
  }

  return options;
};
