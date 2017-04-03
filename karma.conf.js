//jshint strict: false
module.exports = function(config) {
  config.set({
    files: [
      "app/bower_components/angular/angular.js",
      "app/bower_components/angular-resource/angular-resource.js",
      "app/bower_components/angular-mocks/angular-mocks.js",
      "app/bower_components/angular-bootstrap/ui-bootstrap.js",
      "src/*.module.js",
      "src/*!(.module|.spec).js",
      "src/**/*.module.js",
      "src/**/*!(.module|.spec).js",
      "src/**/*.spec.js"
    ],

    autoWatch: true,

    frameworks: ["jasmine"],

    browsers: ["Firefox", "Chrome"],

    plugins: [
      "karma-chrome-launcher",
      "karma-firefox-launcher",
      "karma-jasmine",
      "karma-junit-reporter"
    ],

    junitReporter: {
      outputFile: "test_out/unit.xml",
      suite: "unit"
    }

  });
};
