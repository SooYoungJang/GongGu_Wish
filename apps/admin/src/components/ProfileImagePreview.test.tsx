import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProfileImagePreview } from "./ProfileImagePreview";

afterEach(() => {
  cleanup();
});

describe("ProfileImagePreview", () => {
  it("renders the Hiker profile image with an accessible account label", () => {
    render(
      <ProfileImagePreview
        instagramUsername="gyulbbad"
        profileImageUrl="https://example.com/gyulbbad.jpg"
      />,
    );

    expect(
      screen
        .getByRole("img", { name: "@gyulbbad 프로필 이미지" })
        .getAttribute("src"),
    ).toBe("https://example.com/gyulbbad.jpg");
  });

  it("shows the account initial when the image fails to load", () => {
    render(
      <ProfileImagePreview
        instagramUsername="gyulbbad"
        profileImageUrl="https://example.com/broken.jpg"
      />,
    );

    fireEvent.error(
      screen.getByRole("img", { name: "@gyulbbad 프로필 이미지" }),
    );

    expect(
      screen.getByRole("img", { name: "@gyulbbad 프로필 이미지 없음" })
        .textContent,
    ).toContain("G");
  });

  it("falls back immediately when no profile URL is available", () => {
    render(<ProfileImagePreview instagramUsername="" profileImageUrl={null} />);

    expect(
      screen.getByRole("img", { name: "인스타그램 프로필 이미지 없음" })
        .textContent,
    ).toContain("@");
  });
});
