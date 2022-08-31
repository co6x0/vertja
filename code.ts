// types
type DataFromUI = {
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

// type guards
const hasProperty = <K extends keyof T, T extends Record<string, unknown>>(
  object: T,
  key: K
): boolean => {
  return !!object && Object.prototype.hasOwnProperty.call(object, key);
};
const nonNullable = <T>(value: T): value is NonNullable<T> => value != null;

// show plugin ui, set config
figma.showUI(__html__, { themeColors: true, width: 384, height: 424 });

// utils
const closePluginWithNotify = (message: string) => {
  figma.notify(message);
  figma.closePlugin();
};

const createTextData = (textNode: TextNode) => {
  const data = {
    nodeId: textNode.id,
    characters: textNode.characters,
    // 縦書きにするとwidthとheightの関係が反転するため
    width: textNode.height,
    height: textNode.width,
    lineHeight: textNode.lineHeight,
    letterSpacing: textNode.letterSpacing,
    resizing: textNode.textAutoResize,
    paragraphIndent: textNode.paragraphIndent,
    paragraphSpacing: textNode.paragraphSpacing,
  };
  return data;
};

// plugin main
const main = async () => {
  const selectionNodes = figma.currentPage.selection;
  if (selectionNodes.length === 0) {
    closePluginWithNotify("Node is not selected");
    return;
  }

  const prevData = selectionNodes[0].getPluginData(selectionNodes[0].id);
  const hasPrevData = prevData !== "";
  const nodeTypes = selectionNodes.map((node) => node.type);
  // 前回プラグイン実行時のデータを持っている場合は処理を続行する
  if (!hasPrevData && !nodeTypes.includes("TEXT")) {
    closePluginWithNotify("TextNode is not selected");
    return;
  }

  if (hasPrevData) {
    const textData = JSON.parse(prevData);
    figma.ui.postMessage(textData);
    return;
  }

  // TODO: convert multiple text node
  const textNodes = selectionNodes.filter(
    (node) => node.type === "TEXT"
  ) as TextNode[];
  const textNode = textNodes[0];
  const textData = createTextData(textNode);

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
  const textData = createTextData(textNode);

  figma.ui.postMessage(textData);
});

// On Message
figma.ui.on("message", async (event: { data?: DataFromUI }) => {
  const data = event.data;
  if (!data) return;
  if (!data.characters) return;

  const originNode = figma.getNodeById(data.nodeId) as
    | TextNode
    | FrameNode
    | null;
  if (!originNode) return;

  let textNode: TextNode;
  // Vertical Text WrapperのFrameかTextNodeかで分岐させる
  if (originNode.type === "FRAME") {
    const frameNode = originNode as FrameNode;
    // ここまで処理が進んでいるならVertical Text Wrapperであると考えられるので、最初の子Frameだけ抽出する
    const firstChild = frameNode.children[0] as FrameNode;
    const childTextNode = firstChild.findChild((node) => {
      return node.type === "TEXT";
    }) as TextNode | null;
    if (!childTextNode) return;
    textNode = childTextNode;
  } else {
    textNode = originNode as TextNode;
  }

  // cloneに備えてオリジナルのNodeを編集しておく
  // 使用フォントの読み込み
  // Ref: https://www.figma.com/plugin-docs/working-with-text
  await Promise.all(
    textNode
      .getRangeAllFontNames(0, textNode.characters.length)
      .map(figma.loadFontAsync)
  );

  const convertLetterSpacingToLineHeight = (letterSpacing: number) => {
    return 100 + letterSpacing;
  };
  textNode.lineHeight = {
    unit: "PERCENT",
    value: convertLetterSpacingToLineHeight(data.letterSpacing.value),
  };
  textNode.paragraphIndent = 0;

  // data.charactersの行ごとにTextNodeを分割する
  const nodeFontSize = textNode.fontSize as number;
  let textLines = data.characters.split("\n");
  const wordHeight = Math.round(
    (nodeFontSize * textNode.lineHeight.value) / 100
  );

  // heightに応じてtextLinesをより細かく分割する
  const maxWordPerLine = (height: number, indent: number) => {
    return Math.floor((height - indent) / wordHeight);
  };

  if (data.height) {
    const height = data.height;
    const formattedTextLines = textLines.flatMap((textLine) => {
      if (textLine.length < maxWordPerLine(height, data.paragraphIndent))
        return textLine;

      const indentWordCount = Math.floor(wordHeight / data.paragraphIndent);
      const lineCount = Math.ceil(
        (textLine.length + indentWordCount) / maxWordPerLine(height, 0)
      );

      let newLines = [];
      for (let i = 0; i < lineCount; i++) {
        const wordCount = (index: number) => {
          return index === 0
            ? maxWordPerLine(height, data.paragraphIndent)
            : maxWordPerLine(height, 0);
        };
        const sliceLine = textLine.slice(
          wordCount(i) * i,
          wordCount(i) * (i + 1)
        );
        newLines.push(sliceLine);
      }
      return newLines;
    });

    textLines = formattedTextLines;
  }

  const textNodes = textLines.map((textLine) => {
    const clonedNode = textNode.clone();
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
    frame.x = originNode.x;
    frame.y = originNode.y;
    frame.fills = [];
    frame.resize(frame.width, data.height ?? frame.height);
    return frame;
  };

  const textFrames = textNodes.map((textNode, index) => {
    const frame = createAutoLayoutFrame();
    frame.name = String(index + 1);

    if (data.lineHeight.value) {
      const lineWidth = (nodeFontSize * data.lineHeight.value) / 100;
      const frameHorizontalPadding = lineWidth - nodeFontSize;
      frame.paddingLeft = frameHorizontalPadding / 2;
      frame.paddingRight = frameHorizontalPadding / 2;
    }

    if (data.height && data.paragraphIndent !== 0) {
      // インデント込の1行あたりの文字数が同じ場合インデント分のpaddingを追加する
      if (
        textNode.characters.length ===
        maxWordPerLine(data.height, data.paragraphIndent)
      ) {
        frame.paddingTop = data.paragraphIndent;
      }
    } else if (data.paragraphIndent !== 0) {
      frame.paddingTop = data.paragraphIndent;
    }

    frame.appendChild(textNode);
    return frame;
  });

  // すべてのtextFrameを1つのAutoLayoutFrameで包む
  const wrapperFrame = createAutoLayoutFrame();
  data.nodeId = wrapperFrame.id;
  wrapperFrame.name = "Vertical Text Wrapper";
  wrapperFrame.setPluginData(wrapperFrame.id, JSON.stringify(data));
  wrapperFrame.setRelaunchData({
    edit: "Adjust the settings for vertically written text",
  });
  textFrames.forEach((textFrame) => wrapperFrame.insertChild(0, textFrame));

  // オリジナルのNodeを削除
  originNode.remove();

  // AutoLayoutFrameをフォーカスする
  figma.viewport.scrollAndZoomIntoView([wrapperFrame]);
  figma.currentPage.selection = [wrapperFrame];

  // data.nodeIdを上で更新しているのでUI側にも反映させる
  figma.ui.postMessage(data);

  figma.notify("Converted");
});

figma.on("currentpagechange", () => {
  closePluginWithNotify("Vertical Text plugin closed");
});
