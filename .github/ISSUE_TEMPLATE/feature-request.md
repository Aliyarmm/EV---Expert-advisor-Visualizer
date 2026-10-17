---
name: ✨ Feature Request
about: Suggest a new feature for EA analysis
title: ''
labels: enhancement
body:
  type: textarea
  id: suggestion
  attributes:
    label: Feature Description
    description: What capability are you suggesting?
    placeholder: "e.g. Add support for MT5 trade history import"
  validations:
    required: true
  type: textarea
  id: use-case
  attributes:
    label: Use Case
    description: How would this be used for EA performance analysis?
  validations:
    required: true
  type: textarea
  id: alternatives
  attributes:
    label: Alternatives
    description: Any alternative approaches considered?
  validations:
    required: false
