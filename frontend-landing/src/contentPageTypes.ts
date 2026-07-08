export type TextBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string }
  | { type: "link"; href: string; label: string; text?: string };

export type Section = {
  heading: string;
  blocks: TextBlock[];
};

export type Table = {
  columns: [string, string, string];
  rows: [string, string, string][];
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type LocalizedContentPage = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string[];
  sections: Section[];
  table?: Table;
  faq?: FaqItem[];
};
