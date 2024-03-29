import { createTextData, getTextNode } from "./domains";
import { closePluginWithNotify, nonNullable } from "./utils";
import type { DataFromUI } from "../types";

// show plugin ui, set config
figma.showUI(__html__, { themeColors: true, width: 296, height: 360 });

// 使用フォントの読み込み
// Ref: https://www.figma.com/plugin-docs/working-with-text
const loadFont = async (textNode: TextNode) => {
  await Promise.all(
    textNode.getRangeAllFontNames(0, 1).map(figma.loadFontAsync)
  );
};

/**
 * Plugin first processing
 */
const onLoadPlugin = async () => {
  const selectionNodes = figma.currentPage.selection;
  if (selectionNodes.length === 0) return;

  const prevData = selectionNodes[0].getPluginData(selectionNodes[0].id);
  const hasPrevData = prevData !== "";
  const nodeTypes = selectionNodes.map((node) => node.type);
  // 前回プラグイン実行時のデータを持っているか、TextNodeが含まれている場合は処理を続行する
  if (!hasPrevData && !nodeTypes.includes("TEXT")) {
    return;
  }

  const textNode = getTextNode(selectionNodes);
  if (!textNode) {
    closePluginWithNotify("Unhandled Error: 1");
    return;
  }

  await loadFont(textNode);

  if (hasPrevData) {
    const textData = JSON.parse(prevData);
    figma.ui.postMessage(textData);
    return;
  }

  const textData = createTextData(textNode);
  figma.ui.postMessage(textData);
};

onLoadPlugin();

/**
 * On change selecting node event
 */
figma.on("selectionchange", async () => {
  const selectionNodes = figma.currentPage.selection;
  if (selectionNodes.length === 0) return;

  const prevData = selectionNodes[0].getPluginData(selectionNodes[0].id);
  const hasPrevData = prevData !== "";
  const nodeTypes = selectionNodes.map((node) => node.type);
  // 前回プラグイン実行時のデータを持っているか、TextNodeが含まれている場合は処理を続行する
  if (!hasPrevData && !nodeTypes.includes("TEXT")) {
    return;
  }

  const textNode = getTextNode(selectionNodes);
  if (!textNode) {
    closePluginWithNotify("Unhandled Error: 2");
    return;
  }

  await loadFont(textNode);

  if (hasPrevData) {
    const textData = JSON.parse(prevData);
    figma.ui.postMessage(textData);
    return;
  }

  const textData = createTextData(textNode);
  figma.ui.postMessage(textData);
});

/**
 * On message from plugin UI
 */
figma.ui.on("message", async (event: { data?: DataFromUI }) => {
  const data = event.data;
  if (!data) return;
  if (!data.characters) return;

  const refNode = figma.getNodeById(data.nodeId);
  if (!refNode) return;
  if (refNode.type !== "FRAME" && refNode.type !== "TEXT") return;

  const textNode = getTextNode(refNode);
  if (!textNode) {
    closePluginWithNotify("Unhandled Error: 3");
    return;
  }

  // cloneに備えてオリジナルのNodeを編集しておく
  const convertLetterSpacingToLineHeight = (letterSpacing: number) => {
    return 100 + letterSpacing;
  };
  textNode.lineHeight = {
    unit: "PERCENT",
    value: convertLetterSpacingToLineHeight(data.letterSpacing.value),
  };
  textNode.paragraphIndent = 0;
  textNode.textAlignHorizontal = "CENTER";

  // data.charactersの行ごとにTextNodeを分割する
  const nodeFontSize = textNode.fontSize as number;
  let textLines = data.characters.split("\n");
  const wordHeight = Math.round(
    (nodeFontSize * textNode.lineHeight.value) / 100
  );

  // heightに応じてtextLinesをより細かく分割する
  const maxWordPerLine = (height: number, indent: number) => {
    return Math.floor(height / wordHeight) - Math.ceil(indent / wordHeight);
  };

  if (data.height) {
    const height = data.height;
    const formattedTextLines = textLines.flatMap((textLine) => {
      // インデントを含む1行あたりの最大文字数以下のテキストはそのまま返す
      if (textLine.length <= maxWordPerLine(height, data.paragraphIndent)) {
        return textLine;
      }

      const indentWordCount = Math.floor(data.paragraphIndent / wordHeight);
      const lineCount = Math.ceil(
        (textLine.length + indentWordCount) / maxWordPerLine(height, 0)
      );

      let newLines = [];
      for (let i = 0; i < lineCount; i++) {
        const wordCountStart = (index: number) => {
          if (index === 0) {
            return 0;
          }
          if (index === 1) {
            return maxWordPerLine(height, data.paragraphIndent);
          }
          if (index === 2) {
            return (
              maxWordPerLine(height, data.paragraphIndent) +
              maxWordPerLine(height, 0)
            );
          }
          return (
            maxWordPerLine(height, data.paragraphIndent) +
            maxWordPerLine(height, 0) +
            maxWordPerLine(height, 0) * (index - 2)
          );
        };
        const wordCountEnd = (index: number) => {
          if (index === 0) {
            return maxWordPerLine(height, data.paragraphIndent);
          }
          if (index === 1) {
            return (
              maxWordPerLine(height, data.paragraphIndent) +
              maxWordPerLine(height, 0)
            );
          }
          return (
            maxWordPerLine(height, data.paragraphIndent) +
            maxWordPerLine(height, 0) +
            maxWordPerLine(height, 0) * (index - 1)
          );
        };

        const sliceLine = textLine.slice(wordCountStart(i), wordCountEnd(i));
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
    // 全角文字以外に対応するためにwidthを2にする
    // 本当は0にしたいが、resize()は1以上にしかできないよう
    clonedNode.resize(2, clonedNode.height);
    return clonedNode;
  });
  // PseudoBody: 仮想ボディのことを指す
  // 2は上で設定した数値
  const pseudoBodyWidth = nodeFontSize - 2;

  // lineHeightに対応するためにAutoLayoutのFrame[]を作成し、その中にTextNodeを入れる
  const createAutoLayoutFrame = () => {
    const frame = figma.createFrame();
    frame.layoutMode = "HORIZONTAL";
    frame.primaryAxisAlignItems = "MAX";
    frame.counterAxisAlignItems = "MIN";
    frame.primaryAxisSizingMode = "AUTO";
    frame.counterAxisSizingMode = data.height ? "FIXED" : "AUTO";
    // 0にしたwidthの分をpaddingで確保する
    frame.paddingLeft = 0;
    frame.paddingRight = 0;
    frame.x = refNode.x;
    frame.y = refNode.y;
    frame.fills = [];
    frame.resize(frame.width, data.height ?? frame.height);
    return frame;
  };

  const height = data.height ?? 0;
  const originTextLines = data.characters!.split("\n");
  // インデントを含む1行あたりの最大文字数以上のテキストを抽出する
  const aboveMaxWordTexts = originTextLines
    .map((textLine) => {
      if (textLine.length >= maxWordPerLine(height, data.paragraphIndent))
        return textLine;
    })
    .filter(nonNullable);
  // インデントを含む1行あたりの最大文字数未満のテキストを抽出する
  const lessMaxWordTexts = originTextLines
    .map((textLine) => {
      if (textLine.length < maxWordPerLine(height, data.paragraphIndent))
        return textLine;
    })
    .filter(nonNullable);
  // 複数行を持つ段落の一番最後の行のテキストを抽出する
  const indentWordCount = Math.floor(data.paragraphIndent / wordHeight);
  const multiLineLastTexts = aboveMaxWordTexts.map((text: string) => {
    const lineCount = Math.ceil(
      (text.length + indentWordCount) / maxWordPerLine(height, 0)
    );
    const lastLineStart =
      (lineCount - 1) * maxWordPerLine(height, 0) - indentWordCount;
    const lastLineText = text.slice(lastLineStart - 1, text.length);
    return lastLineText;
  });

  const textFrames = textNodes.map((textNode, index) => {
    const frame = createAutoLayoutFrame();
    frame.name = String(index + 1);

    // １行だけの段落
    const isSingleLineText = lessMaxWordTexts.some(
      (singleLineText) => singleLineText === textNode.characters
    );
    const isLastLineText = multiLineLastTexts.some(
      (lastLineText) => lastLineText === textNode.characters
    );

    // 段落の最後の行にparagraphSpacingを適応する
    if (data.height && data.lineWidth.value && data.paragraphSpacing !== 0) {
      const lineWidth = (nodeFontSize * data.lineWidth.value) / 100;
      const frameHorizontalPadding = lineWidth - nodeFontSize;

      // 最終行
      if (textNodes[textNodes.length - 1].characters === textNode.characters) {
        frame.paddingLeft = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
        frame.paddingRight = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
        // 1行のみの段落か段落の最後の行
      } else if (isSingleLineText || isLastLineText) {
        frame.paddingLeft =
          pseudoBodyWidth / 2 +
          frameHorizontalPadding / 2 +
          data.paragraphSpacing;
        frame.paddingRight = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
      } else {
        frame.paddingLeft = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
        frame.paddingRight = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
      }
      // 通常のlineWidth付与処理
    } else if (data.lineWidth.value) {
      const lineWidth = (nodeFontSize * data.lineWidth.value) / 100;
      const frameHorizontalPadding = lineWidth - nodeFontSize;
      frame.paddingLeft = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
      frame.paddingRight = pseudoBodyWidth / 2 + frameHorizontalPadding / 2;
    }

    // インデントの追加
    if (data.height && data.paragraphIndent !== 0 && !isLastLineText) {
      // インデント込の1行あたりの文字数が同じ場合インデント分のpaddingを追加する
      if (
        textNode.characters.length ===
        maxWordPerLine(data.height, data.paragraphIndent)
      ) {
        frame.paddingTop = data.paragraphIndent;
      }
      // 一行だけの段落
      if (isSingleLineText) {
        frame.paddingTop = data.paragraphIndent;
      }
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
  refNode.remove();

  // AutoLayoutFrameをフォーカスする
  figma.currentPage.selection = [wrapperFrame];

  // data.nodeIdを上で更新しているのでUI側にも反映させる
  figma.ui.postMessage(data);

  figma.notify("Converted");
});

/**
 * On move page
 */
figma.on("currentpagechange", () => {
  closePluginWithNotify("Closed plugin Vertja");
});
