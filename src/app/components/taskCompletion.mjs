export function hasTaskLink(taskData) {
  return Array.isArray(taskData?.links) && taskData.links.some((link) => {
    const value = typeof link === "string" ? link : link?.url;
    return typeof value === "string" && value.trim().length > 0;
  });
}
