"""Shared helper: tell SQLAlchemy's Enum to send VALUES, not Python enum NAMES."""


def enum_values(enum_cls):
    """Extract string values from a Python enum for SQLAlchemy's values_callable."""
    return [e.value for e in enum_cls]
