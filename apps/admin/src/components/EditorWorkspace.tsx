import { useId, useState, type ReactNode } from "react";

const views = [
  { key: "edit", label: "상품 편집" },
  { key: "preview", label: "앱 미리보기" },
  { key: "source", label: "원본 확인" },
] as const;

export function EditorWorkspace({
  source,
  preview,
  children,
}: {
  source: ReactNode;
  preview: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const [view, setView] = useState<(typeof views)[number]["key"]>("edit");

  return (
    <div className="editor-workspace" data-view={view}>
      <div
        className="editor-workspace__switcher"
        role="group"
        aria-label="편집 화면 선택"
      >
        {views.map((item) => (
          <button
            aria-controls={`${id}-${item.key}`}
            aria-pressed={view === item.key}
            key={item.key}
            onClick={() => setView(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="app-editor-grid">
        <div
          className="editor-workspace__pane editor-workspace__pane--source"
          id={`${id}-source`}
        >
          {source}
        </div>
        <div
          className="editor-workspace__pane editor-workspace__pane--preview"
          id={`${id}-preview`}
        >
          {preview}
        </div>
        <div
          className="editor-workspace__pane editor-workspace__pane--edit"
          id={`${id}-edit`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
