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
