const APP_GUIDE_SECTIONS = new Set(['setup', 'four-bar', 'loads', 'setup-diff']);

export function isAppGuideSection(section?: string): boolean {
  return !!section && APP_GUIDE_SECTIONS.has(section);
}
