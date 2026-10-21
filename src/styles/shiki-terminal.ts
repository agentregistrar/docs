/**
 * Neutral Shiki theme for the Terminal identity.
 *
 * Values resolve to D8 tokens only: default text foreground, comments faint,
 * strings muted, invalid/error danger. No rainbow syntax, no second palette.
 */
export const terminalShikiTheme = {
  name: "terminal",
  type: "dark" as const,
  colors: {
    "editor.background": "#050505",
    "editor.foreground": "#e8e8e8",
  },
  settings: [
    {
      settings: { foreground: "#e8e8e8" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#7c7c7c" },
    },
    {
      scope: ["string", "constant.other.symbol", "markup.inline.raw"],
      settings: { foreground: "#9a9a9a" },
    },
    {
      scope: ["keyword", "storage", "entity.name.tag", "support.type"],
      settings: { foreground: "#e8e8e8", fontStyle: "bold" },
    },
    {
      scope: ["constant.numeric", "constant.language", "variable.other"],
      settings: { foreground: "#e8e8e8" },
    },
    {
      scope: ["entity.name.function", "support.function", "entity.name.type"],
      settings: { foreground: "#e8e8e8" },
    },
    {
      scope: ["invalid", "invalid.illegal", "message.error"],
      settings: { foreground: "#f85149" },
    },
    {
      scope: ["markup.inserted"],
      settings: { foreground: "#3fb950" },
    },
    {
      scope: ["markup.deleted"],
      settings: { foreground: "#f85149" },
    },
  ],
};
