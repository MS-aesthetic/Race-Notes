export const APP_GUIDE_ROOT = 'app-guide' as const;
export const APP_GUIDE_SECTIONS = ['setup', 'four-bar', 'loads', 'setup-diff'] as const;

export type AppGuideTopic = (typeof APP_GUIDE_SECTIONS)[number];
export type AppGuideSection = AppGuideTopic | typeof APP_GUIDE_ROOT;
export type ContextualHelpTab = 'dashboard' | 'setups' | 'raceweekend' | 'quickref' | 'settings' | 'trackers';

export interface ContextualAppGuideContext {
  activeTab: ContextualHelpTab;
  fourBarVisible: boolean;
  mappedSection?: AppGuideTopic;
}

const APP_GUIDE_SECTION_SET = new Set<string>([APP_GUIDE_ROOT, ...APP_GUIDE_SECTIONS]);

export function isAppGuideSection(section?: string): section is AppGuideSection {
  return !!section && APP_GUIDE_SECTION_SET.has(section);
}

export function resolveContextualAppGuideSection({
  activeTab,
  fourBarVisible,
  mappedSection,
}: ContextualAppGuideContext): AppGuideSection {
  if (fourBarVisible) return 'four-bar';
  if (activeTab === 'setups') return 'setup';
  if (mappedSection) return mappedSection;
  return APP_GUIDE_ROOT;
}
