module.exports = {
  sourceDir: "dist",
  artifactsDir: "artifacts",
  verbose: true,
  build: {
    filename: "image-blocker-{version}.zip",
  },
  run: {
    startUrl: ["https://duckduckgo.com/?t=ffab&q=komondor&ia=images&iax=images"],
    pref: [
      "devtools.chrome.enabled=true",
      "devtools.console.stdout.content=true",
      "devtools.console.stdout.chrome=true",
      "datareporting.policy.dataSubmissionEnabled=false",
      "toolkit.telemetry.reportingpolicy.firstRun=false",
      "browser.startup.homepage_override.mstone=ignore",
      "startup.homepage_welcome_url=",
      "startup.homepage_welcome_url.additional=",
      "browser.aboutwelcome.enabled=false",
    ],
  },
};
