export type ProjectRoleSlot = "leadId" | "doerId" | "consultantId";
export type ProjectTeamRole = "lead" | "doer" | "consultant";
export type ProjectBudgetCurrency = "TWD" | "USD";
export type ProjectEngagementType =
    | "commissioned"
    | "selfFunded"
    | "grant"
    | "passThrough";
export type MemberCategory =
    | "workerOwner"
    | "associate"
    | "collaborator"
    | "member";
export type MemberMonthlyRole =
    | "none"
    | "facilitator"
    | "timeKeeper"
    | "noteTaker";

export interface ProjectOffering {
    id: string;
    name: string;
    completed: boolean;
}

export interface ProjectStaffingAssignment {
    id: string;
    memberId: string;
    roles: ProjectTeamRole[];
    maxHours: number;
}

export interface ProjectStagePlan {
    id: string;
    name: string;
    weeks: number;
    delayWeeks: number;
    perspectiveHours: number;
    order: number;
}

export interface Member {
    id: string;
    name: string;
    email: string;
    role?: string;
    pronouns?: string[];
    phone?: string;
    location?: string;
    category: MemberCategory;
    active: boolean;
    monthlyRole?: MemberMonthlyRole;
    status?: "active" | "inactive" | "alumni";
    workerOwner: boolean;
    capacityPerWeek?: number;
    vacationDays?: number;
    notes?: string;
}

export interface Project {
    id: string;
    name: string;
    purpose: string;
    description?: string;
    clientName?: string;
    clientContactName?: string;
    clientContactEmail?: string;
    clientContactPhone?: string;
    proposalLink?: string;
    contractLink?: string;
    projectType?: string;
    projectTypes?: string[];
    engagementType?: ProjectEngagementType;
    stage?: string;
    stages?: string[];
    stagePlans?: ProjectStagePlan[];
    priority?: "low" | "medium" | "high";
    startDate?: string;
    dueDate?: string;
    timelineSummary?: string;
    budgetAmount?: number;
    budgetCurrency?: ProjectBudgetCurrency;
    budgetTwd?: number;
    budgetUsd?: number;
    successMetric?: string;
    risks?: string;
    collaboratorCount: number;
    offerings?: ProjectOffering[];
    staffing?: ProjectStaffingAssignment[];
    leadId?: string;
    doerId?: string;
    consultantId?: string;
    maxBillableHours?: number;
    createdAt: number;
}

export interface Task {
    id: string;
    title: string;
    projectId?: string;
    boardOwnerId: string;
    deadline?: string;
    billable: boolean;
    workstream: "client" | "admin" | "internal";
    status: "todo" | "review" | "done";
    estimateHours: number;
    archived: boolean;
    createdAt: number;
}

export type KanbanColumn = "backlog" | "inProgress" | "review" | "done";

export interface KanbanCard {
    id: string;
    projectId: string;
    title: string;
    description?: string;
    column: KanbanColumn;
    ownerId?: string;
    createdAt: number;
}

export interface MeetingNote {
    id: string;
    projectId: string;
    title: string;
    content: string;
    meetingDate: string;
    authorId?: string;
    localPath?: string;
    createdAt: number;
    updatedAt?: number;
}
