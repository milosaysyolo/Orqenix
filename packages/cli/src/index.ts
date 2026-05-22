import { defineCommand, runMain } from "citty";
import { init } from "./commands/init.js";
import { doctor } from "./commands/doctor.js";
import { configCmd } from "./commands/config.js";
import { scopeCmd } from "./commands/scope.js";
import { teamCmd } from "./commands/team.js";
import { syncCmd } from "./commands/sync.js";
import { pluginCmd } from "./commands/plugin.js";
import { mcpCmd } from "./commands/mcp.js";

const main = defineCommand({
  meta: {
    name: "orqenix",
    version: "0.2.0-dev",
    description: "Primary-agent orchestration engine",
  },
  subCommands: {
    init,
    doctor,
    config: configCmd,
    scope: scopeCmd,
    team: teamCmd,
    sync: syncCmd,
    plugin: pluginCmd,
    mcp: mcpCmd,
  },
});

await runMain(main);
