from hak_ocr.validation import parse_attendance_value, validate_attendance_grid
import pytest


def test_attendance_units_are_explicit():
    assert parse_attendance_value("8", unit="hours") == 8
    assert parse_attendance_value("1", unit="days") == 1
    assert parse_attendance_value("8", unit="days") is None
    assert parse_attendance_value("", unit="days") is None
    with pytest.raises(ValueError):
        parse_attendance_value("1", unit="invalid")


def test_monthly_total_can_exceed_single_day_limit():
    header = ["Tên", "1", "2", "3", "4", "5", "TC"]
    days = ["NV A", "1", "1", "1", "1", "1", "5"]
    assert validate_attendance_grid([header, days, ["", "", "", "", "", "", ""]], unit="days") == []
    mismatch = ["NV B", "1", "1", "1", "1", "1", "4"]
    issues = validate_attendance_grid([header, mismatch, ["", "", "", "", "", "", ""]], unit="days")
    assert len(issues) == 1
    assert issues[0]["computed"] == 5
    assert issues[0]["printed"] == 4
