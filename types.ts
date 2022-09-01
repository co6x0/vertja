import "@figma/plugin-typings";

export type DataFromUI = {
  nodeId: string;
  characters?: string;
  width?: number;
  height?: number;
  lineHeight: {
    value?: number;
    unit: "PERCENT";
  };
  letterSpacing: {
    value: number;
    unit: "PERCENT";
  };
  resizing?: "WIDTH_AND_HEIGHT";
  paragraphIndent: number;
  paragraphSpacing: number;
};

export type DataFromPlugin = {
  nodeId: string;
  characters: string;
  width: number;
  height: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  resizing: TextNode["textAutoResize"];
  paragraphIndent: number;
  paragraphSpacing: number;
};
