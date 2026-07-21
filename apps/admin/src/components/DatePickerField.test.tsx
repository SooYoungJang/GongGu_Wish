import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePickerField } from "./DatePickerField";

afterEach(cleanup);

describe("DatePickerField", () => {
  it("renders the entire field as a button without a native date input", () => {
    render(<DatePickerField label="Start date" value="2026-07-12" onChange={vi.fn()} />);

    const field = screen.getByRole("button", { name: /Start date 2026-07-12/i });
    expect(field.classList.contains("date-picker-field__trigger")).toBe(true);
    expect(screen.queryByDisplayValue("2026-07-12")).toBeNull();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it("opens a dialog calendar, navigates months, and closes with Escape while restoring focus", async () => {
    const user = userEvent.setup();
    render(<DatePickerField label="Start date" value="2026-07-12" onChange={vi.fn()} />);

    const field = screen.getByRole("button", { name: /Start date 2026-07-12/i });
    await user.click(field);

    const dialog = screen.getByRole("dialog", { name: "Start date 달력" });
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("heading", { name: "2026년 7월" })).toBeTruthy();
    expect(screen.getByRole("grid", { name: "Start date 날짜" })).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(7);
    expect(within(screen.getByRole("grid", { name: "Start date 날짜" })).getAllByRole("row")).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "이전 달" }));
    expect(screen.getByRole("heading", { name: "2026년 7월" })).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Start date 달력" })).toBeNull();
    expect(document.activeElement).toBe(field);
  });

  it("uses a single roving tab stop and moves focus across days, weeks, and months", async () => {
    const user = userEvent.setup();
    render(<DatePickerField label="Start date" value="2026-07-31" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Start date 2026-07-31/i }));

    const selectedDay = screen.getByRole("button", { name: "2026-07-31" });
    const enabledDays = within(screen.getByRole("grid", { name: "Start date 날짜" }))
      .getAllByRole("button")
      .filter((button) => !(button as HTMLButtonElement).disabled);
    expect(enabledDays.filter((button) => button.tabIndex === 0)).toEqual([selectedDay]);
    expect(document.activeElement).toBe(selectedDay);

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2026-08-01" }));

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2026-08-08" }));

    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2026-08-02" }));

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2026-08-08" }));

    await user.keyboard("{ArrowUp}{ArrowLeft}");
    expect(screen.getByRole("heading", { name: "2026년 7월" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2026-07-31" }));
  });

  it("never moves the roving focus onto min/max disabled dates", async () => {
    const user = userEvent.setup();
    render(
      <DatePickerField
        label="End date"
        value="2026-07-12"
        onChange={vi.fn()}
        min="2026-07-10"
        max="2026-07-20"
      />
    );

    await user.click(screen.getByRole("button", { name: /End date 2026-07-12/i }));
    await user.keyboard("{ArrowLeft}{ArrowLeft}");

    const minimumDay = screen.getByRole("button", { name: "2026-07-10" });
    expect(document.activeElement).toBe(minimumDay);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(minimumDay);

    const gridDays = within(screen.getByRole("grid", { name: "End date 날짜" })).getAllByRole(
      "button"
    );
    expect(gridDays.filter((button) => button.tabIndex === 0)).toEqual([minimumDay]);
    expect(
      gridDays.filter((button) => (button as HTMLButtonElement).disabled && button.tabIndex === 0)
    ).toHaveLength(0);
  });

  it("uses PageUp and PageDown to change months while preserving the preferred day", async () => {
    const user = userEvent.setup();
    render(<DatePickerField label="Start date" value="2024-01-31" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Start date 2024-01-31/i }));
    await user.keyboard("{PageDown}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2024-02-29" }));

    await user.keyboard("{PageDown}");
    const marchLastDay = screen.getByRole("button", { name: "2024-03-31" });
    expect(document.activeElement).toBe(marchLastDay);
    expect(
      within(screen.getByRole("grid", { name: "Start date 날짜" }))
        .getAllByRole("button")
        .filter((button) => button.tabIndex === 0)
    ).toEqual([marchLastDay]);

    await user.keyboard("{PageUp}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2024-02-29" }));
  });

  it("uses Shift+PageUp and Shift+PageDown to change years with leap-day clamping", async () => {
    const user = userEvent.setup();
    render(<DatePickerField label="Start date" value="2024-02-29" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Start date 2024-02-29/i }));
    await user.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2025-02-28" }));

    await user.keyboard("{Shift>}{PageUp}{/Shift}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2024-02-29" }));
  });

  it("prevents keyboard and month-button navigation into months without enabled dates", async () => {
    const user = userEvent.setup();
    render(
      <DatePickerField
        label="End date"
        value="2026-07-15"
        onChange={vi.fn()}
        min="2026-07-10"
        max="2026-08-20"
      />
    );

    await user.click(screen.getByRole("button", { name: /End date 2026-07-15/i }));
    expect((screen.getByRole("button", { name: "이전 달" }) as HTMLButtonElement).disabled).toBe(
      true
    );

    await user.click(screen.getByRole("button", { name: "다음 달" }));
    const augustDay = screen.getByRole("button", { name: "2026-08-15" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "다음 달" }));
    expect((screen.getByRole("button", { name: "다음 달" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(
      within(screen.getByRole("grid", { name: "End date 날짜" }))
        .getAllByRole("button")
        .filter((button) => button.tabIndex === 0)
    ).toEqual([augustDay]);

    augustDay.focus();
    await user.keyboard("{PageDown}");
    expect(screen.getByRole("heading", { name: "2026년 8월" })).toBeTruthy();
    expect(document.activeElement).toBe(augustDay);
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("selects the focused date with %s using native button activation", async (_label, key) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePickerField label="Start date" value="2026-07-12" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Start date 2026-07-12/i }));
    await user.keyboard("{ArrowRight}");
    await user.keyboard(key);

    expect(onChange).toHaveBeenCalledWith("2026-07-13");
    expect(screen.queryByRole("dialog", { name: "Start date 달력" })).toBeNull();
  });

  it("selects a local YYYY-MM-DD date immediately and closes the dialog", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePickerField label="Start date" value="2026-07-12" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /Start date 2026-07-12/i }));
    const grid = screen.getByRole("grid", { name: "Start date 날짜" });
    await user.click(within(grid).getByRole("button", { name: "2026-07-15" }));

    expect(onChange).toHaveBeenCalledWith("2026-07-15");
    expect(screen.queryByRole("dialog", { name: "Start date 달력" })).toBeNull();
  });

  it("supports Today, Clear, Close, and min/max disabled dates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <DatePickerField
        label="End date"
        value="2026-07-12"
        onChange={onChange}
        min="2026-07-10"
        max="2026-07-20"
      />
    );

    await user.click(screen.getByRole("button", { name: /End date 2026-07-12/i }));
    const grid = screen.getByRole("grid", { name: "End date 날짜" });
    expect((within(grid).getByRole("button", { name: "2026-07-09" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((within(grid).getByRole("button", { name: "2026-07-21" }) as HTMLButtonElement).disabled).toBe(
      true
    );

    await user.click(screen.getByRole("button", { name: "날짜 지우기" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.queryByRole("dialog", { name: "End date 달력" })).toBeNull();

    rerender(
      <DatePickerField
        label="End date"
        value=""
        onChange={onChange}
      />
    );
    await user.click(screen.getByRole("button", { name: /End date 날짜 미선택/i }));
    await user.click(screen.getByRole("button", { name: "달력 닫기" }));
    expect(screen.queryByRole("dialog", { name: "End date 달력" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /End date 날짜 미선택/i }));
    await user.click(screen.getByRole("button", { name: "오늘" }));
    expect(onChange.mock.lastCall?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole("dialog", { name: "End date 달력" })).toBeNull();
  });

  it("disables Today when it falls outside the allowed range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePickerField
        label="배너 노출 시작일"
        value=""
        onChange={onChange}
        min="2099-01-01"
      />
    );

    await user.click(screen.getByRole("button", { name: /배너 노출 시작일 날짜 미선택/ }));

    expect((screen.getByRole("button", { name: "오늘" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
