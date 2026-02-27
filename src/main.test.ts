import { describe, it, expect } from "vitest";
import {
  getIndent,
  isListItem,
  isCheckedTask,
  isUncheckedTask,
  getChildren,
  getParentChain,
  hasChildren,
  findParentInCompleted,
  findEndOfBlock,
  moveCheckedTask,
} from "./main";

// --- Helper function tests ---

describe("getIndent", () => {
  it("returns 0 for no indent", () => {
    expect(getIndent("- [ ] task")).toBe(0);
  });

  it("returns number of leading spaces", () => {
    expect(getIndent("    - [ ] task")).toBe(4);
    expect(getIndent("  - [ ] task")).toBe(2);
  });

  it("returns number of leading tab characters", () => {
    expect(getIndent("\t- [ ] task")).toBe(1);
  });

  it("returns 0 for empty string", () => {
    expect(getIndent("")).toBe(0);
  });
});

describe("isListItem", () => {
  it("returns true for list items", () => {
    expect(isListItem("- item")).toBe(true);
    expect(isListItem("  - indented item")).toBe(true);
    expect(isListItem("- [ ] task")).toBe(true);
    expect(isListItem("- [x] checked")).toBe(true);
  });

  it("returns false for non-list lines", () => {
    expect(isListItem("not a list")).toBe(false);
    expect(isListItem("### Heading")).toBe(false);
    expect(isListItem("")).toBe(false);
  });
});

describe("isCheckedTask", () => {
  it("returns true for checked tasks", () => {
    expect(isCheckedTask("- [x] done")).toBe(true);
    expect(isCheckedTask("  - [x] indented done")).toBe(true);
    expect(isCheckedTask("- [X] uppercase")).toBe(true);
  });

  it("returns false for unchecked tasks", () => {
    expect(isCheckedTask("- [ ] not done")).toBe(false);
  });

  it("returns false for non-tasks", () => {
    expect(isCheckedTask("- plain item")).toBe(false);
    expect(isCheckedTask("just text")).toBe(false);
  });
});

describe("isUncheckedTask", () => {
  it("returns true for unchecked tasks", () => {
    expect(isUncheckedTask("- [ ] not done")).toBe(true);
    expect(isUncheckedTask("  - [ ] indented")).toBe(true);
  });

  it("returns false for checked tasks", () => {
    expect(isUncheckedTask("- [x] done")).toBe(false);
  });

  it("returns false for non-tasks", () => {
    expect(isUncheckedTask("- plain item")).toBe(false);
    expect(isUncheckedTask("just text")).toBe(false);
  });
});

describe("getChildren", () => {
  it("returns direct children indices", () => {
    const lines = [
      "- parent",
      "  - child1",
      "  - child2",
      "- sibling",
    ];
    expect(getChildren(lines, 0, 0)).toEqual([1, 2]);
  });

  it("returns nested children", () => {
    const lines = [
      "- parent",
      "  - child",
      "    - grandchild",
      "- sibling",
    ];
    expect(getChildren(lines, 0, 0)).toEqual([1, 2]);
  });

  it("returns empty for no children", () => {
    const lines = [
      "- item1",
      "- item2",
    ];
    expect(getChildren(lines, 0, 0)).toEqual([]);
  });

  it("stops at blank line", () => {
    const lines = [
      "- parent",
      "  - child",
      "",
      "  - not-child",
    ];
    expect(getChildren(lines, 0, 0)).toEqual([1]);
  });
});

describe("getParentChain", () => {
  it("returns single parent", () => {
    const lines = [
      "- parent",
      "  - [x] child",
    ];
    expect(getParentChain(lines, 1)).toEqual([0]);
  });

  it("returns nested parents", () => {
    const lines = [
      "- grandparent",
      "  - parent",
      "    - [x] child",
    ];
    expect(getParentChain(lines, 2)).toEqual([0, 1]);
  });

  it("returns empty when no parents", () => {
    const lines = [
      "- [x] task",
      "- other",
    ];
    expect(getParentChain(lines, 0)).toEqual([]);
  });

  it("skips checked and unchecked task parents", () => {
    const lines = [
      "- [x] checked parent",
      "  - [x] child",
    ];
    expect(getParentChain(lines, 1)).toEqual([]);
  });
});

describe("hasChildren", () => {
  it("returns true when children exist", () => {
    const lines = [
      "- parent",
      "  - child",
    ];
    expect(hasChildren(lines, 0)).toBe(true);
  });

  it("returns false when no children", () => {
    const lines = [
      "- item1",
      "- item2",
    ];
    expect(hasChildren(lines, 0)).toBe(false);
  });

  it("returns false at end of document", () => {
    const lines = ["- item"];
    expect(hasChildren(lines, 0)).toBe(false);
  });

  it("skips blank lines when checking", () => {
    const lines = [
      "- parent",
      "",
      "- sibling",
    ];
    expect(hasChildren(lines, 0)).toBe(false);
  });
});

describe("findParentInCompleted", () => {
  it("finds matching parent", () => {
    const lines = [
      "- parent",
      "  - [x] child",
    ];
    expect(findParentInCompleted(lines, "- parent", 0)).toBe(0);
  });

  it("returns -1 when not found", () => {
    const lines = [
      "- other",
    ];
    expect(findParentInCompleted(lines, "- parent", 0)).toBe(-1);
  });

  it("returns -1 on indent mismatch", () => {
    const lines = [
      "  - parent",
    ];
    expect(findParentInCompleted(lines, "- parent", 0)).toBe(-1);
  });
});

describe("findEndOfBlock", () => {
  it("finds end of block with children", () => {
    const lines = [
      "- parent",
      "  - child1",
      "  - child2",
      "- sibling",
    ];
    expect(findEndOfBlock(lines, 0)).toBe(3);
  });

  it("returns start+1 when no children", () => {
    const lines = [
      "- item1",
      "- item2",
    ];
    expect(findEndOfBlock(lines, 0)).toBe(1);
  });

  it("handles nested children", () => {
    const lines = [
      "- parent",
      "  - child",
      "    - grandchild",
    ];
    expect(findEndOfBlock(lines, 0)).toBe(3);
  });
});

// --- Helpers for integration tests ---

/** Dedent a template literal: strip leading newline, trailing indent, and common whitespace */
function doc(s: string): string {
  const lines = s.split("\n");
  if (lines[0].trim() === "") lines.shift();
  if (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  const minIndent = lines
    .filter(l => l.trim() !== "")
    .reduce((min, l) => Math.min(min, l.match(/^ */)![0].length), Infinity);
  if (minIndent > 0 && minIndent < Infinity) {
    return lines.map(l => l.slice(minIndent)).join("\n");
  }
  return lines.join("\n");
}

/**
 * Simulates the full plugin flow:
 * 1. Diffs `input` (before check) and `edit` (after check) to find the changed line
 * 2. Calls moveCheckedTask with the edit text and changed line
 * 3. Asserts the result matches `expected`
 */
function simulateCheck(
  input: string,
  edit: string,
  expected: string,
  heading: string,
) {
  input = doc(input);
  edit = doc(edit);
  expected = doc(expected);

  const inputLines = input.split("\n");
  const editLines = edit.split("\n");

  let changedLine = -1;
  for (let i = 0; i < editLines.length; i++) {
    if (inputLines[i] !== editLines[i] && isCheckedTask(editLines[i])) {
      changedLine = i;
      break;
    }
  }

  if (changedLine === -1) {
    throw new Error("Could not find a newly checked task between input and edit");
  }

  const result = moveCheckedTask(edit, changedLine, heading);
  expect(result).toBe(expected);
}

// --- moveCheckedTask integration tests ---

describe("moveCheckedTask", () => {
  const heading = "### Completed";

  it("moves a simple task with no parents or children", () => {
    simulateCheck(
      `
        - [ ] todo1
        - [ ] done1
        - [ ] todo2
        ### Completed
      `,
      `
        - [ ] todo1
        - [x] done1
        - [ ] todo2
        ### Completed
      `,
      `
        - [ ] todo1
        - [ ] todo2
        ### Completed
        - [x] done1
      `,
      heading,
    );
  });

  it("moves a task together with its children", () => {
    simulateCheck(
      `
        - [ ] parent task
          - [ ] child1
          - [ ] child2
        ### Completed
      `,
      `
        - [x] parent task
          - [ ] child1
          - [ ] child2
        ### Completed
      `,
      `
        ### Completed
        - [x] parent task
          - [ ] child1
          - [ ] child2
      `,
      heading,
    );
  });

  it("preserves parent chain in completed section for nested task", () => {
    simulateCheck(
      `
        - grandparent
          - parent
            - [ ] done child
        ### Completed
      `,
      `
        - grandparent
          - parent
            - [x] done child
        ### Completed
      `,
      `
        ### Completed
        - grandparent
          - parent
            - [x] done child
      `,
      heading,
    );
  });

  it("removes parent from source when all children moved", () => {
    simulateCheck(
      `
        - parent
          - [ ] only child
        ### Completed
      `,
      `
        - parent
          - [x] only child
        ### Completed
      `,
      `
        ### Completed
        - parent
          - [x] only child
      `,
      heading,
    );
  });

  it("keeps parent in source when it still has other children", () => {
    simulateCheck(
      `
        - parent
          - [ ] done child
          - [ ] remaining child
        ### Completed
      `,
      `
        - parent
          - [x] done child
          - [ ] remaining child
        ### Completed
      `,
      `
        - parent
          - [ ] remaining child
        ### Completed
        - parent
          - [x] done child
      `,
      heading,
    );
  });

  it("reuses existing parent in completed section", () => {
    simulateCheck(
      `
        - parent
          - [ ] second child
        ### Completed
        - parent
          - [x] first child
      `,
      `
        - parent
          - [x] second child
        ### Completed
        - parent
          - [x] first child
      `,
      `
        ### Completed
        - parent
          - [x] first child
          - [x] second child
      `,
      heading,
    );
  });

  it("handles multiple levels of nesting", () => {
    simulateCheck(
      `
        - level0
          - level1
            - level2
              - [ ] deep task
        ### Completed
      `,
      `
        - level0
          - level1
            - level2
              - [x] deep task
        ### Completed
      `,
      `
        ### Completed
        - level0
          - level1
            - level2
              - [x] deep task
      `,
      heading,
    );
  });

  it("returns null when task is already in completed section", () => {
    const result = moveCheckedTask(doc(`
      ### Completed
      - [x] already done
    `), 1, heading);
    expect(result).toBeNull();
  });

  it("returns null when no completed heading exists", () => {
    const result = moveCheckedTask(doc(`
      - [x] done task
      - [ ] todo
    `), 0, heading);
    expect(result).toBeNull();
  });

  it("returns null when cursor line is not a checked task", () => {
    const result = moveCheckedTask(doc(`
      - [ ] not done
      ### Completed
    `), 0, heading);
    expect(result).toBeNull();
  });

  it("returns null for out-of-range cursor line", () => {
    const input = doc(`
      - [x] task
      ### Completed
    `);
    expect(moveCheckedTask(input, -1, heading)).toBeNull();
    expect(moveCheckedTask(input, 99, heading)).toBeNull();
  });
});

describe("integration: input → edit → expected", () => {
  it("moves a root-level checked task to Done section", () => {
    simulateCheck(
      `
        ## Now
        - [ ] Root

        ## Later

        ## Done
      `,
      `
        ## Now
        - [x] Root

        ## Later

        ## Done
      `,
      `
        ## Now

        ## Later

        ## Done
        - [x] Root
      `,
      "## Done",
    );
  });
});
