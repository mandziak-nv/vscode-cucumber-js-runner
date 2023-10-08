# Cucumber JS Test Runner

This extension adds support for Cucumber JS tests running using VS Code testing tools.

## Tests

It looks for tests in `.feature` files:

```feature
Feature: Greeting

  Scenario: Say hello
    When the greeter says hello
    Then I should have heard "hello"
```

## Extension Settings

The `cucumber_runner.features` setting defines where the extension should look for `.feature` files.

Example:

```json
{
  "cucumber_runner.features": [
    "features/**/*.feature"
  ]
}
```

The `cucumber_runner.env_variables` setting defines environment variables that will be passed to the `cucumber-js` command.

Example:

```json
{
  "cucumber_runner.env_variables": {
    "BROWSER": "chromium",
    "DEVICE": "desktop"
  }
}
```

The `cucumber_runner.cli_options` setting defines options that will be passed to the `cucumber-js` command.

Example:

```json
{
  "cucumber_runner.cli_options": [
    "--profile",
    "parallel",
    "--tags",
    "@auto"
  ]
}
```
