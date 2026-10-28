// Apply this only to members/tasks already filtered by the viewer's access.
export function splitTaskBoardByViewer(members, tasks, viewerMemberId) {
  const personalMembers = members.filter((member) => member.id === viewerMemberId);
  const teamMembers = members.filter((member) => member.id !== viewerMemberId);
  const personalIds = new Set(personalMembers.map((member) => member.id));
  const teamIds = new Set(teamMembers.map((member) => member.id));
  return {
    personal: {
      members: personalMembers,
      tasks: tasks.filter((task) => personalIds.has(task.data?.memberId)),
    },
    team: {
      members: teamMembers,
      tasks: tasks.filter((task) => teamIds.has(task.data?.memberId)),
    },
  };
}
