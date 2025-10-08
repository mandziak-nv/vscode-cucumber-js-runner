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

## Debugging

The extension supports debugging tests through the VS Code testing panel. When you click the debug button for a test, it will run with the `PWDEBUG=1` environment variable set, which enables Playwright's debug mode (if you're using Playwright). This allows you to:

- Step through your test execution
- Inspect the browser state
- Use Playwright Inspector for debugging

Simply click the debug icon (instead of the run icon) next to any test in the VS Code testing panel.

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

The `cucumber_runner.cucumber_path` setting defines the path to the `cucumber-js` command.

Example:

```json
{
  "cucumber_runner.cucumber_path": "./node_modules/.bin/cucumber-js"
}
```
