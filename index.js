module.exports = (api, options) => {
  const { info, chalk, execa, error } = require("@vue/cli-shared-utils");
  const glob = require("glob");
  const _ = require("lodash");

  api.registerCommand(
    "cypress:e2e:parallel",
    {
      description: "run e2e tests with Cypress parallel with multiple process",
      usage: "vue-cli-service test:e2e:parallel [options]",
      options: {
        "--headless": "run in headless mode without GUI",
        "--mode":
          "specify the mode the dev server should run in. (default: production)",
        "--url":
          "run e2e tests against given url instead of auto-starting dev server",
        "-s, --spec":
          '(headless only) runs a specific spec file. defaults to "all"',
        "-t, --threads": "number of threads to use"
      },
      details:
        `All Cypress CLI options are also supported:\n` +
        chalk.yellow(
          `https://docs.cypress.io/guides/guides/command-line.html#cypress-run`
        )
    },
    async (args, rawArgs) => {
      removeArg(rawArgs, "mode");
      removeArg(rawArgs, "url");
      removeArg(rawArgs, "config");
      removeArg(rawArgs, "threads");
      removeArg(rawArgs, "spec");

      let specs;
      try {
        specs = glob.sync(args.spec);
      } catch (e) {
        error(
          `Please provide --spec option for ex. --spec="tests/e2e/specs/**/*.e2e.js"`
        );
        process.exit(1);
      }
      if (args.threads && isNaN(args.threads)) {
        error(`Please provide --threads option as number`);
        process.exit(1);
      }
      info(`Starting e2e tests...`);
      const threads = args.threads ? parseInt(args.threads) : 2;
      const specPerThreads = Math.ceil(specs.length / threads);
      const specChunks = _.chunk(specs, specPerThreads);

      let { url, server } = args.url
        ? { url: args.url }
        : await api.service.run("serve");

      const configs =
        typeof args.config === "string" ? args.config.split(",") : [];

      if (url && url.indexOf(",") >= 0) {
        url = url.split(",");
      } else {
        url = [url];
      }

      const cyArgs = [
        args.headless ? "run" : "open", // open or run
        "--config",
        ...(configs.length ? [configs.join(",")] : []),
        ...rawArgs
      ];

      let exitCode = null;
      const processes = [];

      specChunks.forEach((specs, instanceIndex) => {
        const localArgs = [
          ...cyArgs,
          `baseUrl=${url[instanceIndex % url.length]}`,
          "--spec",
          `'${specs.join(",")}'`
        ];
        const p = getCypressInstance(execa, localArgs);
        processes.push(p);
        if (process.env.VUE_CLI_TEST) {
          p.on("exit", (code) => {
            if (!exitCode) {
              exitCode = code;
            }
          });
        }

        p.on("exit", () => {
          const index = processes.indexOf(p);
          processes.splice(index, 1);
          checkProcess(processes);
        });
        p.on("error", () => {
          const index = processes.indexOf(p);
          processes.splice(index, 1);
          checkProcess(processes);
        });
      });

      function checkProcess(processes) {
        if (!processes.length) {
          if (server) {
            server.close();
          }
          process.exit(exitCode);
        }
      }

      return processes[0];
    }
  );
};

module.exports.defaultModes = {
  "test:e2e": "production"
};

function getCypressInstance(execa, cyArgs) {
  const cypressBinPath = require.resolve("cypress/bin/cypress");
  const runner = execa(cypressBinPath, cyArgs, { stdio: "inherit" });
  return runner;
}

function removeArg(rawArgs, argToRemove, offset = 1) {
  const matchRE = new RegExp(`^--${argToRemove}$`);
  const equalRE = new RegExp(`^--${argToRemove}=`);

  const i = rawArgs.findIndex((arg) => matchRE.test(arg) || equalRE.test(arg));
  if (i > -1) {
    rawArgs.splice(i, offset + (equalRE.test(rawArgs[i]) ? 0 : 1));
  }
}
