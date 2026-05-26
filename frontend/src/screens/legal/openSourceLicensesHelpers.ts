export type OpenSourceComponent = {
  source: "frontend" | "backend";
  name: string;
  license: string;
  homepage?: string;
  author?: string;
  noticeText?: string;
  licenseText?: string;
};

export type OpenSourceSection = {
  id: string;
  title: string;
  components: OpenSourceComponent[];
};

export type OpenSourcePayload = {
  generatedAt: string;
  app: {
    name: string;
    license: string;
    licenseText: string;
    copyright?: string;
    thirdPartyNotice?: string;
  };
  sections: OpenSourceSection[];
};

export function visibleSections(sections: OpenSourceSection[]): OpenSourceSection[] {
  return sections.filter((section) => section.components.length > 0);
}

export function componentSummary(component: OpenSourceComponent): string {
  return component.license || "UNKNOWN";
}