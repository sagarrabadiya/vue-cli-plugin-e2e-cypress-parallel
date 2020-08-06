module.exports = (api) => {
  api.extendPackage({
    scripts: {
      "cypress:e2e:parallel": "vue-cli-service cypress:e2e:parallel --headless",
    },
  });
};
