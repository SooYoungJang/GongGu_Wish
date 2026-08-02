import { createElement } from "react";

export function Image(props: Record<string, unknown>) {
  return createElement("ExpoImage", props);
}
