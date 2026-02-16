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

The extension currently does not support debugging. However, you can use the Debug option to run tests with an additional set of environment variables defined in `cucumberJsRunner.debugEnv`.

## Extension Settings

The `cucumberJsRunner.features` setting defines where the extension should look for `.feature` files.

Example:

```json
{
  "cucumberJsRunner.features": [
    "features/**/*.feature"
  ]
}
```

The `cucumberJsRunner.env` setting defines environment variables that will be passed to the `cucumber-js` command.

Example:

```json
{
  "cucumberJsRunner.env": {
    "BROWSER": "chromium",
    "DEVICE": "desktop"
  }
}
```

The `cucumberJsRunner.debugEnv` setting defines debug environment variables that will be passed to the `cucumber-js` command when debugging, alongside those specified in the `cucumberJsRunner.env` setting.

Example:

```json
{
  "cucumberJsRunner.debugEnv": {
    "DEBUG": "true"
  }
}
```

The `cucumberJsRunner.cliArgs` setting defines additional arguments that will be passed to the `cucumber-js` command.

Example:

```json
{
  "cucumberJsRunner.cliArgs": [
    "--profile",
    "parallel",
    "--tags",
    "@auto"
  ]
}
```

The `cucumberJsRunner.cwd` setting defines the current working directory for the `cucumber-js` command. The first workspace folder will be used if not specified.

Example:

```json
{
  "cucumberJsRunner.cwd": "/Users/user/projects/cucumber-project"
}
```

The `cucumberJsRunner.cucumberExecutable` setting defines the path to the `cucumber-js` command.

Example:

```json
{
  "cucumberJsRunner.cucumberExecutable": "./node_modules/.bin/cucumber-js"
}
```