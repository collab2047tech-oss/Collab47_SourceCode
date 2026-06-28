"use server";

import {
  upsertExperience, deleteExperience,
  upsertEducation, deleteEducation,
  addSkill, deleteSkill,
  type ExperienceInput, type EducationInput, type SkillCategory,
} from "@/lib/db/resume";

export async function saveExperienceAction(input: ExperienceInput & { id?: string }) {
  return upsertExperience(input);
}
export async function deleteExperienceAction(id: string) {
  return deleteExperience(id);
}
export async function saveEducationAction(input: EducationInput & { id?: string }) {
  return upsertEducation(input);
}
export async function deleteEducationAction(id: string) {
  return deleteEducation(id);
}
export async function addSkillAction(name: string, category: SkillCategory) {
  return addSkill(name, category);
}
export async function deleteSkillAction(id: string) {
  return deleteSkill(id);
}
