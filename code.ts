// type guards
const hasProperty = <K extends keyof T, T extends Record<string, unknown>>(
  object: T,
  key: K
): boolean => {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
};
const nonNullable = <T>(value: T): value is NonNullable<T> => value != null;

// show plugin ui, set config
figma.showUI(__html__, { themeColors: true, width: 384, height: 400 });

// utils
const closePluginWithNotify = (message: string) => {
  figma.notify(message);
  figma.closePlugin();
};

// plugin main
const main = async () => {
  const selectionNodes = figma.currentPage.selection;
  if (selectionNodes.length === 0) {
    closePluginWithNotify("Node is not selected");
    return;
  }

  const nodeTypes = selectionNodes.map((node) => node.type);
  if (!nodeTypes.includes("TEXT")) {
    closePluginWithNotify("TextNode is not selected");
    return;
  }

  // TODO: convert multiple text node
  const textNodes = selectionNodes.filter(
    (node) => node.type === "TEXT"
  ) as TextNode[];
  const textNode = textNodes[0];

  const textData = {
    nodeId: textNode.id,
    characters: textNode.characters,
    width: textNode.width,
    height: textNode.height,
    lineHeight: textNode.lineHeight,
    letterSpacing: textNode.letterSpacing,
    resizing: textNode.textAutoResize,
  };

  figma.ui.postMessage(textData);
};

main();

figma.on("selectionchange", () => {
  const selectionNodes = figma.currentPage.selection;
  if (selectionNodes.length === 0) return;

  const nodeTypes = selectionNodes.map((node) => node.type);
  if (!nodeTypes.includes("TEXT")) return;

  // TODO: convert multiple text node
  const textNodes = selectionNodes.filter(
    (node) => node.type === "TEXT"
  ) as TextNode[];
  const textNode = textNodes[0];

  const textData = {
    nodeId: textNode.id,
    characters: textNode.characters,
    width: textNode.width,
    height: textNode.height,
    lineHeight: textNode.lineHeight,
    letterSpacing: textNode.letterSpacing,
    resizing: textNode.textAutoResize,
  };

  figma.ui.postMessage(textData);
});

// On Message
type DataFromUI = {
  nodeId: string;
  characters?: string;
  width?: number;
  height?: number;
  lineHeight?: number;
  letterSpacing: number;
};
figma.ui.on("message", async (event: { data?: DataFromUI }) => {
  console.log("on message");
  const _selection = figma.currentPage.selection;
  console.log(_selection[0].getPluginData("test"));

  const data = event.data;
  if (!data) return;

  const node = figma.getNodeById(data.nodeId) as TextNode | null;
  if (!node) return;

  if (!data.characters) return;

  // cloneに備えてオリジナルのNodeを編集しておく
  // 使用フォントの読み込み
  await Promise.all(
    node
      .getRangeAllFontNames(0, node.characters.length)
      .map(figma.loadFontAsync)
  );

  const convertLetterSpacingToLineHeight = (letterSpacing: number) => {
    return 100 + letterSpacing;
  };
  node.lineHeight = {
    unit: "PERCENT",
    value: convertLetterSpacingToLineHeight(data.letterSpacing),
  };

  // data.charactersの行ごとにTextNodeを分割する
  const nodeFontSize = node.fontSize as number;
  let textLines = data.characters.split("\n");
  const wordHeight = (nodeFontSize * node.lineHeight.value) / 100;

  // heightに応じてtextLinesをより細かく分割する
  if (data.height) {
    const maxWordPerLine = Math.floor(data.height / wordHeight);
    const formattedTextLines = textLines.flatMap((textLine) => {
      if (textLine.length < maxWordPerLine) return textLine;

      const lineCount = Math.ceil(textLine.length / maxWordPerLine);

      let newLines = [];
      for (let i = 0; i < lineCount; i++) {
        const sliceLine = textLine.slice(
          maxWordPerLine * i,
          maxWordPerLine * (i + 1)
        );
        newLines.push(sliceLine);
      }
      return newLines;
    });

    textLines = formattedTextLines;
  }

  const textNodes = textLines.map((textLine) => {
    const clonedNode = node.clone();
    clonedNode.textAutoResize = "HEIGHT";
    clonedNode.characters = textLine;
    clonedNode.resize(nodeFontSize, clonedNode.height);
    return clonedNode;
  });

  // lineHeightに対応するためにAutoLayoutのFrame[]を作成し、その中にTextNodeを入れる
  const createAutoLayoutFrame = () => {
    const frame = figma.createFrame();
    frame.layoutMode = "HORIZONTAL";
    frame.primaryAxisAlignItems = "MAX";
    frame.counterAxisAlignItems = "MIN";
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = data.height ? "FIXED" : "AUTO";
    frame.paddingLeft = 0;
    frame.paddingRight = 0;
    frame.x = node.x;
    frame.y = node.y;
    frame.fills = [];
    frame.resize(frame.width, data.height ?? frame.height);
    return frame;
  };

  const textFrames = textNodes.map((textNode, index) => {
    const frame = createAutoLayoutFrame();
    frame.name = String(index + 1);

    if (data.lineHeight) {
      const lineWidth = (nodeFontSize * data.lineHeight) / 100;
      const frameHorizontalPadding = lineWidth - nodeFontSize;
      frame.paddingLeft = frameHorizontalPadding / 2;
      frame.paddingRight = frameHorizontalPadding / 2;
    }

    frame.appendChild(textNode);
    return frame;
  });

  // すべてのtextFrameを1つのAutoLayoutFrameで包む
  const wrapperFrame = createAutoLayoutFrame();
  wrapperFrame.name = "Vertical Text Wrapper";
  wrapperFrame.setPluginData("test", "hi");
  textFrames.forEach((textFrame) => wrapperFrame.insertChild(0, textFrame));

  // オリジナルのNodeを削除
  node.remove();

  figma.viewport.scrollAndZoomIntoView([wrapperFrame]);
  figma.currentPage.selection = [wrapperFrame];

  figma.notify("Converted");
});

figma.on("currentpagechange", () => {
  closePluginWithNotify("Vertical Text plugin closed");
});
