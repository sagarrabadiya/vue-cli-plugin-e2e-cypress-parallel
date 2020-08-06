module.exports = (api) => {
  api.describeTask({
    match: (command) => /vue-cli-service cypress:e2e:parellel/.test(command),
    description: "Run cypress e2e with multiple processes parellel",
    link:
      "https://github.com/sagarrabadiya/vue-cli-plugin-e2e-cypress-parellel#injected-commands",
    prompts: [
      {
        name: "mode",
        type: "list",
        default: "development",
        choices: [
          {
            name: "development",
            value: "development",
          },
          {
            name: "production",
            value: "production",
          },
          {
            name: "test",
            value: "test",
          },
        ],
        description: "Specifiy the mode the dev server should run in",
      },
      {
        name: "url",
        type: "input",
        default: "",
        description:
          "Run e2e tests against given url instead of auto-starting dev server",
      },
      {
        name: "spec",
        type: "input",
        default: "",
        validate: (input) => !!input,
        description: "Spec pattern it can be one file or glob pattern",
      },
      {
        name: "threads",
        type: "input",
        validate: (input) => !isNaN(input),
        default: 2,
        description: "Number of process to start of cypress",
      },
    ],
    onBeforeRun: ({ answers, args }) => {
      if (answers.headless) args.push("--headless");
      if (answers.mode) args.push("--mode", answers.mode);
      if (answers.url) args.push("--url=" + answers.url);
      if (answers.spec) args.push("--spec=" + answers.spec);
      if (answers.threads) args.push("--threads=" + parseInt(answers.threds));
    },
  });
};
