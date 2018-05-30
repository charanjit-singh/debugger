/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

export * from "./source-documents";
export * from "./get-token-location";
export * from "./source-search";
export * from "../ui";
export { onMouseOver } from "./token-events";

import { createEditor } from "./create-editor";
import { shouldPrettyPrint } from "../source";
import { findNext, findPrev } from "./source-search";

import { isWasm, lineToWasmOffset, wasmOffsetToLine } from "../wasm";
import { isOriginalId } from "devtools-source-map";

import type { AstLocation } from "../../workers/parser";
import type { EditorPosition, EditorRange } from "../editor/types";
import type { Location } from "../../types";
type Editor = Object;

let editor: ?Editor;

export function getEditor() {
  if (editor) {
    return editor;
  }

  editor = createEditor();
  return editor;
}

export function removeEditor() {
  editor = null;
}

export function shouldShowPrettyPrint(selectedSource) {
  if (!selectedSource) {
    return false;
  }

  return shouldPrettyPrint(selectedSource);
}

export function shouldShowFooter(selectedSource, horizontal) {
  if (!horizontal) {
    return true;
  }
  if (!selectedSource) {
    return false;
  }
  return (
    shouldShowPrettyPrint(selectedSource) ||
    isOriginalId(selectedSource.get("id"))
  );
}

export function traverseResults(e, ctx, query, dir, modifiers) {
  e.stopPropagation();
  e.preventDefault();

  if (dir == "prev") {
    findPrev(ctx, query, true, modifiers);
  } else if (dir == "next") {
    findNext(ctx, query, true, modifiers);
  }
}

export function toEditorLine(sourceId: string, lineOrOffset: number): number {
  if (isWasm(sourceId)) {
    // TODO ensure offset is always "mappable" to edit line.
    return wasmOffsetToLine(sourceId, lineOrOffset) || 0;
  }

  return lineOrOffset ? lineOrOffset - 1 : 1;
}

export function toEditorPosition(location: Location): EditorPosition {
  return {
    line: toEditorLine(location.sourceId, location.line),
    column: isWasm(location.sourceId) || !location.column ? 0 : location.column
  };
}

export function toEditorRange(
  sourceId: string,
  location: AstLocation
): EditorRange {
  const { start, end } = location;
  return {
    start: toEditorPosition({ ...start, sourceId }),
    end: toEditorPosition({ ...end, sourceId })
  };
}

export function toSourceLine(sourceId: string, line: number): ?number {
  return isWasm(sourceId) ? lineToWasmOffset(sourceId, line) : line + 1;
}

export function scrollToColumn(codeMirror: any, line: number, column: number) {
  const { top, left } = codeMirror.charCoords(
    { line: line, ch: column },
    "local"
  );

  if (!isVisible(codeMirror, top, left)) {
    const scroller = codeMirror.getScrollerElement();
    const centeredX = Math.max(left - scroller.offsetWidth / 2, 0);
    const centeredY = Math.max(top - scroller.offsetHeight / 2, 0);

    codeMirror.scrollTo(centeredX, centeredY);
  }
}

function isVisible(codeMirror: any, top: number, left: number) {
  function withinBounds(x, min, max) {
    return x >= min && x <= max;
  }

  const scrollArea = codeMirror.getScrollInfo();

  const charWidth = codeMirror.defaultCharWidth();
  const inXView = withinBounds(
    left,
    scrollArea.left,
    scrollArea.left + (scrollArea.clientWidth - 30) - charWidth
  );

  const fontHeight = codeMirror.defaultTextHeight();
  const inYView = withinBounds(
    top,
    scrollArea.top,
    scrollArea.top + scrollArea.clientHeight - fontHeight
  );

  return inXView && inYView;
}

export function markText(_editor: any, className, { start, end }: EditorRange) {
  return _editor.codeMirror.markText(
    { ch: start.column, line: start.line },
    { ch: end.column, line: end.line },
    { className }
  );
}

export function lineAtHeight(_editor, sourceId, event) {
  const _editorLine = _editor.codeMirror.lineAtHeight(event.clientY);
  return toSourceLine(sourceId, _editorLine);
}

export function getSourceLocationFromMouseEvent(_editor, selectedLocation, e) {
  const { line, ch } = _editor.codeMirror.coordsChar({
    left: e.clientX,
    top: e.clientY
  });

  return {
    sourceId: selectedLocation.sourceId,
    line: line + 1,
    column: ch + 1
  };
}

export function forEachLine(codeMirror, iter) {
  codeMirror.operation(() => {
    codeMirror.doc.iter(0, codeMirror.lineCount(), iter);
  });
}

export function removeLineClass(codeMirror, line, className) {
  codeMirror.removeLineClass(line, "line", className);
}

export function clearLineClass(codeMirror, className) {
  forEachLine(codeMirror, line => {
    removeLineClass(codeMirror, line, className);
  });
}

export function getTextForLine(codeMirror, line) {
  return codeMirror.getLine(line - 1).trim();
}

export function getCursorLine(codeMirror) {
  return codeMirror.getCursor().line;
}
