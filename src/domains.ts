export const createTextData = (textNode: TextNode) => {
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

// TODO: 型定義がかなり雑
export const getTextNode = (node: readonly SceneNode[] | SceneNode) => {
  let refNode: SceneNode;
  if (Array.isArray(node)) {
    refNode = node[0];
  } else {
    refNode = node as SceneNode;
  }

  let textNode: TextNode;
  // Vertical Text WrapperのFrameかTextNodeかで分岐させる
  if (refNode.type === "FRAME") {
    const frameNode = refNode as FrameNode;
    // ここまで処理が進んでいるならVertical Text Wrapperであると考えられる (?)
    const childHasTextNode = frameNode.children.find((nodes) => {
      if (nodes.type !== "FRAME") {
        return false;
      }
      return nodes.findChild(
        (node) => node.type === "TEXT" && node.characters.length !== 0
      );
    }) as FrameNode;

    const childTextNode = childHasTextNode.findChild((node) => {
      return node.type === "TEXT";
    }) as TextNode | null;

    if (!childTextNode) return;
    textNode = childTextNode;
  } else {
    if (Array.isArray(node)) {
      // TODO: convert multiple text node
      const textNodes = node.filter(
        (node) => node.type === "TEXT"
      ) as TextNode[];
      textNode = textNodes[0];
    } else {
      textNode = node as TextNode;
    }
  }

  return textNode;
};
