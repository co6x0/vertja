import "./style.css";
import type { DataFromPlugin, DataFromUI } from "../types";

const ButtonAction = document.getElementById(
  "ButtonAction"
) as HTMLButtonElement;
const InputTextContent = document.getElementById(
  "InputTextContent"
) as HTMLTextAreaElement;
const InputWidth = document.getElementById("InputWidth") as HTMLInputElement;
const InputHeight = document.getElementById("InputHeight") as HTMLInputElement;
const InputLetterSpacing = document.getElementById(
  "InputLetterSpacing"
) as HTMLInputElement;
const InputLineHeight = document.getElementById(
  "InputLineHeight"
) as HTMLInputElement;
const InputParagraphIndent = document.getElementById(
  "InputParagraphIndent"
) as HTMLInputElement;
const InputParagraphSpacing = document.getElementById(
  "InputParagraphSpacing"
) as HTMLInputElement;

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
      value: InputLineHeight.value ? Number(InputLineHeight.value) : undefined,
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
  InputLineHeight.value =
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
