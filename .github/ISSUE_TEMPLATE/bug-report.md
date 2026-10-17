---
name: 🐛 Bug Report
about: Something isn't working as expected
title: ''
labels: bug
body:
  type: markdown
  attributes:
    value: |
      Thanks for reporting a bug in EV — Expert Advisor Visualizer! Please fill out the details below.
  type: textarea
  id: description
  attributes:
    label: Description
    description: A clear description of the bug
  validations:
    required: true
  type: textarea
  id: steps
  attributes:
    label: Steps to Reproduce
    description: How to reproduce the issue
    placeholder: "1. Start backend\n2. Run backtest\n3. Observe error in equity curve"
  validations:
    required: true
  type: textarea
  id: expected
  attributes:
    label: Expected Behavior
    description: What should happen
  validations:
    required: true
  type: textarea
  id: actual
  attributes:
    label: Actual Behavior
    description: What actually happened
  validations:
    required: true
  type: textarea
  id: environment
  attributes:
    label: Environment
    description: Browser, Python version, etc.
  validations:
    required: false
  type: textarea
  id: additional
  attributes:
    label: Additional Context
    description: Add any other context here
  validations:
    required: false
