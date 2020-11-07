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
      const specChunks = [];
      _.range(0, threads).forEach((i) => {
        specChunks[i] = [];
      });
      specs.forEach((spec, index) => {
        const chunkIndex = index % threads;
        specChunks[chunkIndex].push(spec);
      });

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

      const cypressBinPath = require.resolve("cypress/bin/cypress");
      const runners = specChunks.map((specs, instanceIndex) => {
        const baseUrl = url[instanceIndex % url.length];
        const cyArgs = [
          args.headless ? "run" : "open", // open or run
          "--config",
          [`baseUrl=${baseUrl}`, ...configs].join(","),
          ...rawArgs
        ];
        const localArgs = [...cyArgs, "--spec", `'${specs.join(",")}'`];
        info(`Starting cypress instance with baseUrl ${baseUrl}`);
        return execa(cypressBinPath, localArgs, { stdio: "inherit" })
          .then((result) => {
            info(`Finished cypress instance with baseUrl ${baseUrl}`);
            return result;
          })
          .catch((result) => {
            error(`Failed cypress instance with baseUrl ${baseUrl}`);
            return result;
          });
      });

      const results = await Promise.all(runners);
      function exitHandler(exitCode) {
        info(`Parent Process exited with code ${exitCode}`);
        if (server) {
          server.close();
        }
        runners.forEach((runner) => {
          runner.kill("SIGTERM", {
            forceKillAfterTimeout: 2000
          });
        });
        process.exit(exitCode);
      }
      //do something when app is closing
      process.on("exit", exitHandler);

      //catches ctrl+c event
      process.on("SIGINT", exitHandler);

      // catches "kill pid" (for example: nodemon restart)
      process.on("SIGUSR1", exitHandler);
      process.on("SIGUSR2", exitHandler);
      process.on("SIGTERM", exitHandler);

      //catches uncaught exceptions
      process.on("uncaughtException", exitHandler);

      const nonZeroExitCodes = results.filter((r) => r.code !== 0);

      if (nonZeroExitCodes.length) {
        process.exit(nonZeroExitCodes[0]);
      } else {
        process.exit(0);
      }
    }
  );
};

module.exports.defaultModes = {
  "test:e2e": "production"
};

function removeArg(rawArgs, argToRemove, offset = 1) {
  const matchRE = new RegExp(`^--${argToRemove}$`);
  const equalRE = new RegExp(`^--${argToRemove}=`);

  const i = rawArgs.findIndex((arg) => matchRE.test(arg) || equalRE.test(arg));
  if (i > -1) {
    rawArgs.splice(i, offset + (equalRE.test(rawArgs[i]) ? 0 : 1));
  }
}
