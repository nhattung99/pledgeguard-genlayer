export const categories = {
  writing: {
    label: "Writing",
    icon: "✎",
    unit: "words",
    options: [500, 1000, 1500, 2000],
    rule: (n) =>
      `Publish an original public article containing at least ${n} words.`,
    extras: [
      "The article must include at least two linked sources.",
      "The article must include a clear conclusion.",
    ],
  },
  code: {
    label: "Code",
    icon: "⌘",
    unit: "commit",
    options: [5, 10, 15, 30],
    rule: (n) =>
      `Make at least ${n} substantive commits to the public repository linked in the evidence.`,
    extras: [
      "The repository must include a README with setup instructions.",
      "A working demo must be publicly accessible.",
    ],
  },
  course: {
    label: "Course",
    icon: "▤",
    unit: "lessons",
    options: [3, 5, 10, 20],
    rule: (n) =>
      `Complete at least ${n} course lessons and publish verifiable public completion evidence.`,
    extras: [
      "Publish a public project demonstrating the course skills.",
      "Include a platform-issued public completion certificate.",
    ],
  },
  other: {
    label: "Other",
    icon: "↗",
    unit: "deliverables",
    options: [1, 2, 3, 5],
    rule: (n) =>
      `Create and publish at least ${n} original deliverables with publicly accessible evidence.`,
    extras: [
      "Provide a publicly accessible working demo.",
      "Include public documentation describing each deliverable.",
    ],
  },
};
export function buildCriteria(kind, count, extras = []) {
  const category = categories[kind];
  if (!category || !category.options.includes(Number(count)))
    throw new Error("Invalid criteria selection");
  return [
    category.rule(count),
    ...category.extras.filter((_, i) => extras.includes(i)),
    "All counted work must have platform-generated creation/publication/commit timestamps within the locked commitment window.",
  ].join("\n");
}
