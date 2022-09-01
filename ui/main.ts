import "./style.css";
import "tippy.js/dist/tippy.css";
import tippy, { createSingleton } from "tippy.js";
import type { DataFromPlugin, DataFromUI } from "../types";

const ButtonAction = document.getElementById(
  "ButtonAction"
) as HTMLButtonElement;
const PluginNote = document.getElementById("PluginNote") as HTMLElement;
const InputTextContent = document.getElementById(
  "InputTextContent"
) as HTMLTextAreaElement;
const InputWidth = document.getElementById("InputWidth") as HTMLInputElement;
const InputHeight = document.getElementById("InputHeight") as HTMLInputElement;
const InputLetterSpacing = document.getElementById(
  "InputLetterSpacing"
) as HTMLInputElement;
const InputLineWidth = document.getElementById(
  "InputLineWidth"
) as HTMLInputElement;
const InputParagraphIndent = document.getElementById(
  "InputParagraphIndent"
) as HTMLInputElement;
const InputParagraphSpacing = document.getElementById(
  "InputParagraphSpacing"
) as HTMLInputElement;

tippy.setDefaultProps({
  duration: 100,
  delay: [1000, 0],
  offset: [0, 8],
  placement: "bottom",
});
createSingleton([
  tippy(InputWidth.parentElement!, {
    content: "Width",
  }),
  tippy(InputHeight.parentElement!, {
    content: "Height",
  }),
  tippy(InputLetterSpacing.parentElement!, {
    content: "Letter spacing",
  }),
  tippy(InputLineWidth.parentElement!, {
    content: "Line width",
  }),
  tippy(InputParagraphIndent.parentElement!, {
    content: "Paragraph indent",
  }),
  tippy(InputParagraphSpacing.parentElement!, {
    content: "Paragraph spacing",
  }),
]);
tippy(PluginNote, {
  content: `
  <p>
    This plugin converts only text <strong>layout</strong> for vertical
    writing. To make the glyphs suitable for vertical writing, enable
    "Vertical alternates" and, if including alphabet and half glyphs, "Full
    widths"
    <a
      href="https://help.figma.com/hc/en-us/articles/4913951097367-Use-OpenType-features"
      target="_blank"
      rel="noopener noreferrer"
      >using OpenType features</a
    >.
  </p>
  `,
  allowHTML: true,
  interactive: true,
  maxWidth: 280,
});

let nodeId = "";

// Ref: ./code.ts DataFromUI type
const createDataForPlugin = () => {
  const data: DataFromUI = {
    nodeId: nodeId,
    characters: InputTextContent.value ?? undefined,
    width: InputWidth.value ? Number(InputWidth.value) : undefined,
    height: InputHeight.value ? Number(InputHeight.value) : undefined,
    letterSpacing: {
      value: InputLetterSpacing.value ? Number(InputLetterSpacing.value) : 0,
      unit: "PERCENT",
    },
    lineHeight: {
      value: InputLineWidth.value ? Number(InputLineWidth.value) : undefined,
      unit: "PERCENT",
    },
    resizing: InputHeight.value ? undefined : "WIDTH_AND_HEIGHT",
    paragraphIndent: Number(InputParagraphIndent.value) ?? 0,
    paragraphSpacing: Number(InputParagraphSpacing.value) ?? 0,
  };
  return data;
};

const formatNumberToString = (number: number, digit: number) => {
  const fixedNumber = number.toFixed(digit);
  const formattedString = Number(fixedNumber).toString();
  return formattedString;
};

ButtonAction.addEventListener("click", () => {
  const data = createDataForPlugin();
  // Ref: https://www.figma.com/plugin-docs/creating-ui/#non-null-origin-iframes
  parent.postMessage(
    {
      pluginMessage: { data },
      pluginId: "1146329653004129345",
    },
    "https://www.figma.com"
  );
});

onmessage = (event) => {
  const data = event.data.pluginMessage as DataFromPlugin;
  if (!data) return;

  nodeId = data.nodeId;
  InputTextContent.value = data.characters;
  // InputWidth.value =
  //   data.resizing === "HEIGHT" || data.resizing === "WIDTH_AND_HEIGHT"
  //     ? null
  //     : data.width;
  InputHeight.value =
    data.resizing === "WIDTH_AND_HEIGHT" ? "" : String(data.height);
  InputLetterSpacing.value = data.letterSpacing.value
    ? formatNumberToString(data.letterSpacing.value, 3)
    : "";
  InputLineWidth.value =
    data.lineHeight.unit !== "AUTO"
      ? formatNumberToString(data.lineHeight.value, 3)
      : "";
  InputParagraphIndent.value = formatNumberToString(data.paragraphIndent, 3);
  InputParagraphSpacing.value = formatNumberToString(data.paragraphSpacing, 3);

  if (!nodeId) {
    ButtonAction.setAttribute("disabled", "true");
  } else {
    ButtonAction.removeAttribute("disabled");
  }
};
