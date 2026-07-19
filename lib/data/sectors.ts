// Startup / industry sector categories for the onboarding "field" step.
//
// Founder note: the field step previously reused the engineering-branch chips
// (CSE, ECE, Mechanical, ...) for startups and industry accounts, which read as
// "surface-level" for a founder picking what their company actually does. These
// are factual sector names - the kind a DPIIT/startup-ecosystem taxonomy uses -
// not cute marketing labels. Keep "Other" last so the free-text escape hatch in
// the field step keeps working for anything not listed.

export const STARTUP_SECTORS: string[] = [
  "SaaS",
  "FinTech",
  "EdTech",
  "HealthTech",
  "AgriTech",
  "DeepTech / AI",
  "D2C / Consumer",
  "Logistics",
  "CleanTech / Climate",
  "Gaming",
  "Creator economy",
  "Services",
  "Other",
];
