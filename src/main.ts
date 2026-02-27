import { Editor, MarkdownView, Plugin, PluginSettingTab, App, Setting } from "obsidian";

interface TodoTrailSettings {
  completedHeading: string;
}

const DEFAULT_SETTINGS: TodoTrailSettings = {
  completedHeading: "## Done",
};

export function getIndent(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

export function isListItem(line: string): boolean {
  return /^\s*- /.test(line);
}

export function isCheckedTask(line: string): boolean {
  return /^\s*- \[x\] /i.test(line);
}

export function isUncheckedTask(line: string): boolean {
  return /^\s*- \[ \] /.test(line);
}

/** Get children: consecutive lines after `start` with indent > parentIndent */
export function getChildren(lines: string[], start: number, parentIndent: number): number[] {
  const children: number[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") break;
    if (getIndent(lines[i]) <= parentIndent) break;
    children.push(i);
  }
  return children;
}

/** Walk backwards from `index` building the parent chain (list items with decreasing indent) */
export function getParentChain(lines: string[], index: number): number[] {
  const parents: number[] = [];
  let currentIndent = getIndent(lines[index]);

  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const indent = getIndent(line);
    if (indent < currentIndent && isListItem(line) && !isCheckedTask(line) && !isUncheckedTask(line)) {
      parents.unshift(i);
      currentIndent = indent;
      if (indent === 0) break;
    }
  }
  return parents;
}

/** Check if a parent line has any remaining children (list items with greater indent) */
export function hasChildren(lines: string[], index: number): boolean {
  const parentIndent = getIndent(lines[index]);
  for (let i = index + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const indent = getIndent(line);
    if (indent <= parentIndent) return false;
    if (isListItem(line)) return true;
  }
  return false;
}

/**
 * Find where a parent text exists in the completed section lines.
 * Returns the index within completedLines, or -1.
 */
export function findParentInCompleted(completedLines: string[], parentText: string, parentIndent: number): number {
  for (let i = 0; i < completedLines.length; i++) {
    if (getIndent(completedLines[i]) === parentIndent && completedLines[i].trim() === parentText.trim()) {
      return i;
    }
  }
  return -1;
}

/**
 * Find the end of a parent's block in completed lines (last line with greater indent).
 * Returns the index after the last child.
 */
export function findEndOfBlock(lines: string[], start: number): number {
  const parentIndent = getIndent(lines[start]);
  let end = start + 1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") {
      end = i;
      continue;
    }
    if (getIndent(lines[i]) <= parentIndent) break;
    end = i + 1;
  }
  return end;
}

/**
 * Pure function: given the full document text, cursor line, and completed heading,
 * returns the new document text with the checked task moved to the completed section,
 * or null if no change is needed.
 */
export function moveCheckedTask(text: string, cursorLine: number, completedHeading: string): string | null {
  const lines = text.split("\n");

  if (cursorLine < 0 || cursorLine >= lines.length) return null;
  if (!isCheckedTask(lines[cursorLine])) return null;

  const checkedLineIndex = cursorLine;
  const checkedIndent = getIndent(lines[checkedLineIndex]);

  // Don't process tasks already in/below the completed section
  for (let i = 0; i <= checkedLineIndex; i++) {
    if (lines[i].trim() === completedHeading.trim()) return null;
  }

  // Find children of the checked task
  const childIndices = getChildren(lines, checkedLineIndex, checkedIndent);

  // Build parent chain
  const parentIndices = getParentChain(lines, checkedLineIndex);

  // Find the completed section
  let completedIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === completedHeading.trim()) {
      completedIndex = i;
      break;
    }
  }

  if (completedIndex === -1) return null;

  // Collect the lines to move (checked task + its children)
  const linesToMove = [checkedLineIndex, ...childIndices];
  const movedContent = linesToMove.map(i => lines[i]);

  // Collect the indices to remove from source
  const indicesToRemove = new Set(linesToMove);

  // Remove from source
  const sourceLines = lines.filter((_, i) => !indicesToRemove.has(i));

  // Clean up empty parents (bottom-up)
  const removedParents: number[] = [];
  for (let p = parentIndices.length - 1; p >= 0; p--) {
    let adjustedIndex = parentIndices[p];
    for (const ri of [...linesToMove, ...removedParents].sort((a, b) => a - b)) {
      if (ri < parentIndices[p]) adjustedIndex--;
    }
    if (adjustedIndex >= 0 && adjustedIndex < sourceLines.length && !hasChildren(sourceLines, adjustedIndex)) {
      removedParents.push(parentIndices[p]);
      sourceLines.splice(adjustedIndex, 1);
    }
  }

  // Now find the completed section in the modified source
  let newCompletedIndex = -1;
  for (let i = 0; i < sourceLines.length; i++) {
    if (sourceLines[i].trim() === completedHeading.trim()) {
      newCompletedIndex = i;
      break;
    }
  }

  if (newCompletedIndex === -1) return null;

  // Extract completed section lines (after heading)
  const completedStart = newCompletedIndex + 1;
  const completedLines = sourceLines.slice(completedStart);

  // Build the parent texts (preserving indent)
  const parentTexts = parentIndices.map(i => lines[i]);

  // Determine where to insert in completed section
  let insertLines: string[] = [];

  if (parentTexts.length === 0) {
    insertLines = movedContent;
  } else {
    let matched = false;
    let insertPos = completedLines.length;

    for (let p = 0; p < parentTexts.length; p++) {
      const parentText = parentTexts[p];
      const parentIndent = getIndent(parentText);
      const idx = findParentInCompleted(completedLines, parentText, parentIndent);

      if (idx !== -1) {
        const blockEnd = findEndOfBlock(completedLines, idx);

        if (p === parentTexts.length - 1) {
          insertPos = blockEnd;
          insertLines = movedContent;
          matched = true;
        } else {
          const nextParentText = parentTexts[p + 1];
          const nextParentIndent = getIndent(nextParentText);
          let foundNext = false;
          for (let j = idx + 1; j < blockEnd; j++) {
            if (getIndent(completedLines[j]) === nextParentIndent && completedLines[j].trim() === nextParentText.trim()) {
              foundNext = true;
              break;
            }
          }
          if (!foundNext) {
            insertPos = blockEnd;
            insertLines = [...parentTexts.slice(p + 1), ...movedContent];
            matched = true;
            break;
          }
        }
      } else {
        insertPos = completedLines.length;
        insertLines = [...parentTexts.slice(p), ...movedContent];
        matched = true;
        break;
      }
    }

    if (!matched) {
      insertLines = movedContent;
      insertPos = completedLines.length;
    }

    completedLines.splice(insertPos, 0, ...insertLines);
  }

  if (parentTexts.length === 0) {
    completedLines.push(...insertLines);
  }

  // Rebuild the full document
  const result = [
    ...sourceLines.slice(0, completedStart),
    ...completedLines,
  ].join("\n");

  if (result === text) return null;
  return result;
}

export default class TodoTrailPlugin extends Plugin {
  settings: TodoTrailSettings = DEFAULT_SETTINGS;
  private processing = false;

  async onload() {
    await this.loadSettings();

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: Editor, info: MarkdownView) => {
        this.handleEditorChange(editor);
      })
    );

    this.addSettingTab(new TodoTrailSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  handleEditorChange(editor: Editor) {
    if (this.processing) return;

    const cursor = editor.getCursor();
    const fullText = editor.getValue();
    const result = moveCheckedTask(fullText, cursor.line, this.settings.completedHeading);

    if (result !== null) {
      this.processing = true;
      try {
        const cursorBefore = editor.getCursor();
        editor.setValue(result);
        const newLineCount = result.split("\n").length;
        editor.setCursor({
          line: Math.min(cursorBefore.line, newLineCount - 1),
          ch: 0,
        });
      } finally {
        this.processing = false;
      }
    }
  }
}

class TodoTrailSettingTab extends PluginSettingTab {
  plugin: TodoTrailPlugin;

  constructor(app: App, plugin: TodoTrailPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Completed section heading")
      .setDesc("The markdown heading that marks the completed section (e.g. ### Completed)")
      .addText(text =>
        text
          .setPlaceholder("### Completed")
          .setValue(this.plugin.settings.completedHeading)
          .onChange(async (value) => {
            this.plugin.settings.completedHeading = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
