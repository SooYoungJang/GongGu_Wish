import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

const sections = [
  { key: "info", label: "상품 정보" },
  { key: "media", label: "미디어" },
  { key: "visibility", label: "기간 · 노출" },
] as const;

type SectionKey = (typeof sections)[number]["key"];

export function EditorSections({
  info,
  media,
  visibility,
  readOnly = false,
}: Record<SectionKey, ReactNode> & { readOnly?: boolean }) {
  const id = useId();
  const [active, setActive] = useState<SectionKey>("info");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % sections.length;
    else if (event.key === "ArrowLeft")
      next = (index + sections.length - 1) % sections.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sections.length - 1;
    else return;
    event.preventDefault();
    setActive(sections[next].key);
    buttons.current[next]?.focus();
  }

  const content = { info, media, visibility };
  return (
    <div className="editor-sections">
      <div
        className="editor-sections__tabs"
        role="tablist"
        aria-label="상품 편집 항목"
      >
        {sections.map((section, index) => (
          <button
            aria-controls={`${id}-${section.key}-panel`}
            aria-selected={active === section.key}
            id={`${id}-${section.key}-tab`}
            key={section.key}
            onClick={() => setActive(section.key)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            role="tab"
            tabIndex={active === section.key ? 0 : -1}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </div>
      {sections.map((section) => (
        <section
          aria-labelledby={`${id}-${section.key}-tab`}
          className="editor-sections__panel"
          hidden={active !== section.key}
          id={`${id}-${section.key}-panel`}
          key={section.key}
          role="tabpanel"
        >
          <fieldset className="review-fieldset" disabled={readOnly}>
            {content[section.key]}
          </fieldset>
        </section>
      ))}
    </div>
  );
}
