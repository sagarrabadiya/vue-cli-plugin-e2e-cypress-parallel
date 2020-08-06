module.exports = (api) => {
  api.extendPackage({
    scripts: {
      "cypress:e2e:parellel": "vue-cli-service cypress:e2e:parellel --headless",
    },
  });
};
