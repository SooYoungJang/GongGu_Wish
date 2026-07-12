import { Component, createRef, type KeyboardEvent } from "react";

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

interface LocalDateParts {
  year: number;
  month: number;
  day: number;
}

interface DatePickerFieldState {
  isOpen: boolean;
  focusedDate: string | null;
  preferredDay: number;
  visibleMonth: {
    year: number;
    month: number;
  };
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDateValue(parts: LocalDateParts) {
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function parseLocalDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getLocalToday() {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

function getInitialMonth(value: string) {
  const selectedDate = parseLocalDate(value);
  const fallbackDate = getLocalToday();
  const date = selectedDate ?? fallbackDate;

  return { year: date.year, month: date.month };
}

function getInitialCalendarState(value: string, min?: string, max?: string): DatePickerFieldState {
  const selectedDate = parseLocalDate(value);
  const minDate = parseLocalDate(min);
  const maxDate = parseLocalDate(max);
  const minValue = minDate ? formatDateValue(minDate) : undefined;
  const maxValue = maxDate ? formatDateValue(maxDate) : undefined;

  if (minValue && maxValue && minValue > maxValue) {
    return {
      isOpen: false,
      focusedDate: null,
      preferredDay: selectedDate?.day ?? getLocalToday().day,
      visibleMonth: getInitialMonth(value),
    };
  }

  let focusedDate = selectedDate ? formatDateValue(selectedDate) : formatDateValue(getLocalToday());
  if (minValue && focusedDate < minValue) {
    focusedDate = minValue;
  }
  if (maxValue && focusedDate > maxValue) {
    focusedDate = maxValue;
  }

  const focusedParts = parseLocalDate(focusedDate);
  return {
    isOpen: false,
    focusedDate,
    preferredDay: focusedParts?.day ?? getLocalToday().day,
    visibleMonth: focusedParts
      ? { year: focusedParts.year, month: focusedParts.month }
      : getInitialMonth(value),
  };
}

function getMonthLabel(year: number, month: number) {
  return `${year}년 ${month}월`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function isDateOutsideRange(value: string, min?: string, max?: string) {
  const minDate = parseLocalDate(min);
  const maxDate = parseLocalDate(max);
  const minValue = minDate ? formatDateValue(minDate) : undefined;
  const maxValue = maxDate ? formatDateValue(maxDate) : undefined;

  return Boolean((minValue && value < minValue) || (maxValue && value > maxValue));
}

function addDays(value: string, offset: number) {
  const parts = parseLocalDate(value);
  if (!parts) {
    return value;
  }

  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + offset);
  return formatDateValue({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
}

function getFocusableDateInMonth(
  year: number,
  month: number,
  preferredDay: number,
  min?: string,
  max?: string
) {
  const firstValue = formatDateValue({ year, month, day: 1 });
  const lastValue = formatDateValue({ year, month, day: getDaysInMonth(year, month) });
  const minDate = parseLocalDate(min);
  const maxDate = parseLocalDate(max);
  const minValue = minDate ? formatDateValue(minDate) : firstValue;
  const maxValue = maxDate ? formatDateValue(maxDate) : lastValue;
  const allowedStart = minValue > firstValue ? minValue : firstValue;
  const allowedEnd = maxValue < lastValue ? maxValue : lastValue;

  if (allowedStart > allowedEnd) {
    return null;
  }

  const preferredValue = formatDateValue({
    year,
    month,
    day: Math.min(preferredDay, getDaysInMonth(year, month)),
  });
  if (preferredValue < allowedStart) {
    return allowedStart;
  }
  if (preferredValue > allowedEnd) {
    return allowedEnd;
  }
  return preferredValue;
}

function getFocusableDateAfterMonthOffset(
  year: number,
  month: number,
  offset: number,
  preferredDay: number,
  min?: string,
  max?: string
) {
  const targetMonth = new Date(year, month - 1 + offset, 1);
  return getFocusableDateInMonth(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    preferredDay,
    min,
    max
  );
}

export class DatePickerField extends Component<DatePickerFieldProps, DatePickerFieldState> {
  private readonly triggerRef = createRef<HTMLButtonElement>();

  private readonly dialogRef = createRef<HTMLDialogElement>();

  private readonly closeButtonRef = createRef<HTMLButtonElement>();

  state: DatePickerFieldState = getInitialCalendarState(
    this.props.value,
    this.props.min,
    this.props.max
  );

  componentDidUpdate(
    _previousProps: DatePickerFieldProps,
    previousState: DatePickerFieldState
  ) {
    if (this.state.isOpen && !previousState.isOpen) {
      this.showDialog();
    }
  }

  componentWillUnmount() {
    const dialog = this.dialogRef.current;

    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
    }
  }

  private showDialog() {
    const dialog = this.dialogRef.current;

    if (!dialog) {
      return;
    }

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      dialog.setAttribute("open", "");
    }

    this.focusCalendarDate(this.state.focusedDate);
  }

  private openCalendar = () => {
    this.setState({
      ...getInitialCalendarState(this.props.value, this.props.min, this.props.max),
      isOpen: true,
    });
  };

  private focusCalendarDate(value: string | null) {
    const dayButton = value
      ? this.dialogRef.current?.querySelector<HTMLButtonElement>(`[data-date="${value}"]`)
      : null;
    (dayButton ?? this.closeButtonRef.current)?.focus();
  }

  private closeCalendar = () => {
    const dialog = this.dialogRef.current;

    if (dialog?.open && typeof dialog.close === "function") {
      dialog.close();
    }

    this.setState({ isOpen: false }, () => {
      this.triggerRef.current?.focus();
    });
  };

  private changeMonth = (offset: number) => {
    this.setState(({ preferredDay, visibleMonth }) => {
      const nextDate = new Date(visibleMonth.year, visibleMonth.month - 1 + offset, 1);
      const nextFocusedDate = getFocusableDateAfterMonthOffset(
        visibleMonth.year,
        visibleMonth.month,
        offset,
        preferredDay,
        this.props.min,
        this.props.max
      );
      if (!nextFocusedDate) {
        return null;
      }
      return {
        focusedDate: nextFocusedDate,
        visibleMonth: {
          year: nextDate.getFullYear(),
          month: nextDate.getMonth() + 1,
        },
      };
    });
  };

  private handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, dateValue: string) => {
    const dateParts = parseLocalDate(dateValue);
    if (!dateParts) {
      return;
    }

    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const direction = event.key === "PageUp" ? -1 : 1;
      const monthOffset = direction * (event.shiftKey ? 12 : 1);
      const nextValue = getFocusableDateAfterMonthOffset(
        dateParts.year,
        dateParts.month,
        monthOffset,
        this.state.preferredDay,
        this.props.min,
        this.props.max
      );
      if (!nextValue) {
        return;
      }

      const nextParts = parseLocalDate(nextValue);
      if (!nextParts) {
        return;
      }
      this.setState(
        {
          focusedDate: nextValue,
          visibleMonth: { year: nextParts.year, month: nextParts.month },
        },
        () => this.focusCalendarDate(nextValue)
      );
      return;
    }

    const weekday = new Date(dateParts.year, dateParts.month - 1, dateParts.day).getDay();
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    const offset = offsets[event.key];
    if (offset === undefined) {
      return;
    }

    event.preventDefault();
    const nextValue = addDays(dateValue, offset);
    if (isDateOutsideRange(nextValue, this.props.min, this.props.max)) {
      return;
    }

    const nextParts = parseLocalDate(nextValue);
    if (!nextParts) {
      return;
    }

    this.setState(
      {
        focusedDate: nextValue,
        preferredDay: nextParts.day,
        visibleMonth: { year: nextParts.year, month: nextParts.month },
      },
      () => this.focusCalendarDate(nextValue)
    );
  };

  private selectDate = (nextValue: string) => {
    this.props.onChange(nextValue);
    this.closeCalendar();
  };

  render() {
    const { label, value, min, max } = this.props;
    const { focusedDate, isOpen, visibleMonth } = this.state;
    const selectedDate = parseLocalDate(value);
    const selectedValue = selectedDate ? formatDateValue(selectedDate) : "";
    const todayValue = formatDateValue(getLocalToday());
    const isTodayDisabled = isDateOutsideRange(todayValue, min, max);
    const daysInVisibleMonth = getDaysInMonth(visibleMonth.year, visibleMonth.month);
    const firstWeekday = new Date(visibleMonth.year, visibleMonth.month - 1, 1).getDay();
    const calendarCellCount = Math.ceil((firstWeekday + daysInVisibleMonth) / 7) * 7;
    const calendarDays = Array.from({ length: calendarCellCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day > 0 && day <= daysInVisibleMonth ? day : null;
    });
    const calendarWeeks = Array.from(
      { length: calendarDays.length / 7 },
      (_, weekIndex) => calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7)
    );
    const canChangeToPreviousMonth = Boolean(
      getFocusableDateAfterMonthOffset(
        visibleMonth.year,
        visibleMonth.month,
        -1,
        this.state.preferredDay,
        min,
        max
      )
    );
    const canChangeToNextMonth = Boolean(
      getFocusableDateAfterMonthOffset(
        visibleMonth.year,
        visibleMonth.month,
        1,
        this.state.preferredDay,
        min,
        max
      )
    );

    return (
      <div className="date-picker-field">
        <button
          ref={this.triggerRef}
          type="button"
          className="date-picker-field__trigger"
          aria-label={`${label} ${selectedValue || "날짜 미선택"}`}
          onClick={this.openCalendar}
        >
          <span className="date-picker-field__label">{label}</span>
          <span className="date-picker-field__value">{selectedValue || "날짜 선택"}</span>
        </button>

        {isOpen ? (
          <dialog
            ref={this.dialogRef}
            className="date-picker-field__dialog"
            aria-label={`${label} 달력`}
            aria-modal="true"
            onCancel={(event) => {
              event.preventDefault();
              this.closeCalendar();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                this.closeCalendar();
              }
            }}
          >
            <div className="date-picker-field__dialog-panel">
              <div className="date-picker-field__header">
                <button
                  type="button"
                  className="date-picker-field__month-button"
                  aria-label="이전 달"
                  disabled={!canChangeToPreviousMonth}
                  onClick={() => this.changeMonth(-1)}
                >
                  ‹
                </button>
                <h2 className="date-picker-field__month-heading">
                  {getMonthLabel(visibleMonth.year, visibleMonth.month)}
                </h2>
                <button
                  type="button"
                  className="date-picker-field__month-button"
                  aria-label="다음 달"
                  disabled={!canChangeToNextMonth}
                  onClick={() => this.changeMonth(1)}
                >
                  ›
                </button>
              </div>

              <div className="date-picker-field__grid" role="grid" aria-label={`${label} 날짜`}>
                <div className="date-picker-field__weekdays" role="row">
                  {WEEK_DAYS.map((weekday) => (
                    <span
                      key={weekday}
                      className="date-picker-field__weekday"
                      role="columnheader"
                    >
                      {weekday}
                    </span>
                  ))}
                </div>

                {calendarWeeks.map((week, weekIndex) => (
                  <div className="date-picker-field__days" role="row" key={`week-${weekIndex}`}>
                    {week.map((day, dayIndex) => {
                      if (day === null) {
                        return (
                          <span
                            key={`empty-${weekIndex}-${dayIndex}`}
                            className="date-picker-field__day date-picker-field__day--empty"
                            role="gridcell"
                          />
                        );
                      }

                      const dateValue = formatDateValue({
                        year: visibleMonth.year,
                        month: visibleMonth.month,
                        day,
                      });
                      const isSelected = dateValue === selectedValue;
                      const isToday = dateValue === todayValue;
                      const isDisabled = isDateOutsideRange(dateValue, min, max);

                      return (
                        <span key={dateValue} className="date-picker-field__day" role="gridcell">
                          <button
                            type="button"
                            className="date-picker-field__day-button"
                            aria-label={dateValue}
                            aria-current={isToday ? "date" : undefined}
                            aria-pressed={isSelected}
                            data-date={dateValue}
                            disabled={isDisabled}
                            tabIndex={!isDisabled && dateValue === focusedDate ? 0 : -1}
                            onClick={() => this.selectDate(dateValue)}
                            onKeyDown={(event) => this.handleDayKeyDown(event, dateValue)}
                          >
                            {day}
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="date-picker-field__actions">
                <button
                  type="button"
                  className="date-picker-field__action"
                  aria-label="오늘"
                  disabled={isTodayDisabled}
                  onClick={() => this.selectDate(todayValue)}
                >
                  오늘
                </button>
                <button
                  type="button"
                  className="date-picker-field__action"
                  aria-label="날짜 지우기"
                  onClick={() => this.selectDate("")}
                >
                  지우기
                </button>
                <button
                  ref={this.closeButtonRef}
                  type="button"
                  className="date-picker-field__action"
                  aria-label="달력 닫기"
                  onClick={this.closeCalendar}
                >
                  닫기
                </button>
              </div>
            </div>
          </dialog>
        ) : null}
      </div>
    );
  }
}
