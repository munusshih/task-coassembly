"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  Clock3,
  Coins,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  FolderOpen,
  GripVertical,
  Mail,
  Pencil,
  type LucideIcon,
  Plus,
  Search,
  Shield,
  Target,
  Trash2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Member,
  MemberCategory,
  MemberMonthlyRole,
  Project,
  ProjectBudgetCurrency,
  ProjectEngagementType,
  ProjectOffering,
  ProjectStagePlan,
  ProjectStaffingAssignment,
  ProjectTeamRole,
} from "@/lib/types";
import { cn, formatMoney, getBudgetSnapshot } from "@/lib/utils";

type AdminView = "members" | "projects";

interface AdminWorkspaceProps {
  members: Member[];
  projects: Project[];
  onCreateMember: (payload: Omit<Member, "id">) => Promise<string>;
  onUpdateMember: (
    id: string,
    payload: Partial<Omit<Member, "id">>,
  ) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onCreateProject: (payload: Omit<Project, "id">) => Promise<string>;
  onUpdateProject: (
    id: string,
    payload: Partial<Omit<Project, "id">>,
  ) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
}

const NEW_MEMBER_SELECTION = "__new_member__";
const NEW_PROJECT_SELECTION = "__new_project__";
const NEW_MEMBER_DRAFT_STORAGE_KEY = "coassembly:new-member-draft";
const NEW_PROJECT_DRAFT_STORAGE_KEY = "coassembly:new-project-draft";

const memberCategoryOptions: Array<{
  label: string;
  value: MemberCategory;
}> = [
  { label: "Worker owner", value: "workerOwner" },
  { label: "Associate", value: "associate" },
  { label: "Collaborator", value: "collaborator" },
  { label: "Member", value: "member" },
];

const monthlyRoleOptions: Array<{
  label: string;
  value: MemberMonthlyRole;
}> = [
  { label: "None", value: "none" },
  { label: "Facilitator", value: "facilitator" },
  { label: "Time keeper", value: "timeKeeper" },
  { label: "Note taker", value: "noteTaker" },
];

const DEFAULT_PROJECT_STAGES = [
  "Discovery",
  "Design",
  "Delivery",
  "Support",
] as const;

const projectPriorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
] as const;

const projectTypeOptions = [
  { label: "Branding", value: "branding" },
  { label: "Website", value: "website" },
  { label: "Workshop", value: "workshop" },
  { label: "Strategy", value: "strategy" },
  { label: "Research", value: "research" },
  { label: "Facilitation", value: "facilitation" },
  { label: "Campaign", value: "campaign" },
  { label: "Operations", value: "operations" },
] as const;

const engagementTypeOptions: Array<{
  label: string;
  value: ProjectEngagementType;
  toneClassName: string;
}> = [
  {
    label: "Commissioned Work",
    value: "commissioned",
    toneClassName:
      "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100",
  },
  {
    label: "Self-funded Project",
    value: "selfFunded",
    toneClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100",
  },
  {
    label: "Grant Project",
    value: "grant",
    toneClassName:
      "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100",
  },
  {
    label: "Pass-through Work",
    value: "passThrough",
    toneClassName:
      "border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300 hover:bg-violet-100",
  },
];

const staffingRoleOptions: Array<{
  label: string;
  value: ProjectTeamRole;
  toneClassName: string;
}> = [
  {
    label: "Lead",
    value: "lead",
    toneClassName:
      "border-slate-300 bg-slate-900 text-white hover:bg-slate-800",
  },
  {
    label: "Doer",
    value: "doer",
    toneClassName:
      "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100",
  },
  {
    label: "Consultant",
    value: "consultant",
    toneClassName:
      "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100",
  },
];

const pronounOptions = ["she/her", "he/him", "they/them", "any"];

const locationSuggestions = [
  "Taipei",
  "New Taipei",
  "Taoyuan",
  "Hsinchu",
  "Taichung",
  "Tainan",
  "Kaohsiung",
  "Remote",
  "Hybrid",
];

type AutosaveState = "idle" | "local" | "saving" | "saved" | "error";

function createLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createOffering(name = ""): ProjectOffering {
  return {
    id: createLocalId(),
    name,
    completed: false,
  };
}

function createStaffingAssignment(): ProjectStaffingAssignment {
  return {
    id: createLocalId(),
    memberId: "",
    roles: [],
    maxHours: 0,
  };
}

function createStagePlan(name = "", order = 0): ProjectStagePlan {
  return {
    id: createLocalId(),
    name,
    weeks: 1,
    delayWeeks: 0,
    perspectiveHours: 0,
    order,
  };
}

function createEmptyMemberDraft(): Omit<Member, "id"> {
  return {
    name: "",
    email: "",
    role: "",
    pronouns: [],
    phone: "",
    location: "",
    category: "member",
    active: true,
    monthlyRole: "none",
    status: "active",
    workerOwner: false,
    capacityPerWeek: 0,
    vacationDays: 0,
    notes: "",
  };
}

function createEmptyProjectDraft(): Omit<Project, "id"> {
  return {
    name: "",
    purpose: "",
    description: "",
    clientName: "",
    clientContactName: "",
    clientContactEmail: "",
    clientContactPhone: "",
    proposalLink: "",
    contractLink: "",
    projectType: "",
    projectTypes: [],
    engagementType: undefined,
    stage: DEFAULT_PROJECT_STAGES[0],
    stages: [...DEFAULT_PROJECT_STAGES],
    stagePlans: DEFAULT_PROJECT_STAGES.map((stageName, index) =>
      createStagePlan(stageName, index),
    ),
    priority: "medium",
    startDate: "",
    dueDate: "",
    timelineSummary: "",
    budgetAmount: 0,
    budgetCurrency: "TWD",
    budgetTwd: 0,
    budgetUsd: 0,
    successMetric: "",
    risks: "",
    collaboratorCount: 0,
    offerings: [],
    staffing: [],
    leadId: "",
    doerId: "",
    consultantId: "",
    maxBillableHours: 0,
    createdAt: 0,
  };
}

function normalizeMember(member?: Member): Omit<Member, "id"> {
  if (!member) {
    return createEmptyMemberDraft();
  }

  return {
    ...createEmptyMemberDraft(),
    ...member,
    pronouns: Array.isArray(member.pronouns) ? member.pronouns : [],
    category:
      member.category || (member.workerOwner ? "workerOwner" : "member"),
    active:
      typeof member.active === "boolean"
        ? member.active
        : member.status !== "inactive" && member.status !== "alumni",
    monthlyRole: member.monthlyRole || "none",
    status:
      member.status ||
      (member.active === false || member.status === "inactive"
        ? "inactive"
        : "active"),
    phone: member.phone || "",
    location: member.location || "",
    role: member.role || "",
    capacityPerWeek: member.capacityPerWeek ?? 0,
    vacationDays: member.vacationDays ?? 0,
    notes: member.notes || "",
  };
}

function normalizeProject(project?: Project): Omit<Project, "id"> {
  if (!project) {
    return createEmptyProjectDraft();
  }

  const stagePlans = normalizeProjectStagePlans(project);
  const stages = deriveStageNamesFromPlans(stagePlans);
  const budget = getBudgetSnapshot(project);

  return {
    ...createEmptyProjectDraft(),
    ...project,
    description: project.description || "",
    clientName: project.clientName || "",
    clientContactName: project.clientContactName || "",
    clientContactEmail: project.clientContactEmail || "",
    clientContactPhone: project.clientContactPhone || "",
    proposalLink: project.proposalLink || "",
    contractLink: project.contractLink || "",
    projectType: project.projectType || "",
    projectTypes: normalizeProjectTypes(project),
    engagementType: project.engagementType,
    stage: resolveCurrentStage(project?.stage, stages),
    stages,
    stagePlans,
    priority: project.priority || "medium",
    startDate: project.startDate || "",
    dueDate: project.dueDate || "",
    timelineSummary: project.timelineSummary || "",
    budgetAmount: budget.amount,
    budgetCurrency: budget.currency,
    budgetTwd: budget.budgetTwd,
    budgetUsd: budget.budgetUsd,
    successMetric: project.successMetric || "",
    risks: project.risks || "",
    collaboratorCount: project.collaboratorCount ?? 0,
    offerings: (project.offerings || []).map((offering) => ({
      ...offering,
      completed: Boolean(offering.completed),
    })),
    staffing: normalizeStaffing(project),
    leadId: project.leadId || "",
    doerId: project.doerId || "",
    consultantId: project.consultantId || "",
    maxBillableHours: project.maxBillableHours ?? 0,
  };
}

function serializeMember(draft: Omit<Member, "id">): Omit<Member, "id"> {
  const monthlyRole = draft.monthlyRole || "none";
  const active = Boolean(draft.active);

  return {
    ...draft,
    name: draft.name.trim(),
    email: draft.email.trim(),
    role: monthlyRole !== "none" ? monthlyRole : "",
    pronouns: Array.from(
      new Set(
        (draft.pronouns || []).map((value) => value.trim()).filter(Boolean),
      ),
    ),
    phone: String(draft.phone || "").trim(),
    location: String(draft.location || "").trim(),
    category: draft.category,
    active,
    monthlyRole,
    status: active ? "active" : "inactive",
    workerOwner: draft.category === "workerOwner",
    capacityPerWeek: Number(draft.capacityPerWeek) || 0,
    vacationDays: Number(draft.vacationDays) || 0,
    notes: String(draft.notes || "").trim(),
  };
}

function serializeProject(draft: Omit<Project, "id">): Omit<Project, "id"> {
  const projectTypes = Array.from(
    new Set(
      (draft.projectTypes || []).map((value) => value.trim()).filter(Boolean),
    ),
  );
  const staffing = (draft.staffing || [])
    .map((assignment) => ({
      id: assignment.id || createLocalId(),
      memberId: String(assignment.memberId || "").trim(),
      roles: Array.from(
        new Set(
          (assignment.roles || []).filter((role): role is ProjectTeamRole =>
            staffingRoleOptions.some((option) => option.value === role),
          ),
        ),
      ),
      maxHours: Number(assignment.maxHours) || 0,
    }))
    .filter((assignment) => assignment.memberId && assignment.roles.length);
  const collaboratorCount = new Set(
    staffing.map((assignment) => assignment.memberId),
  ).size;
  const leadId =
    staffing.find((assignment) => assignment.roles.includes("lead"))
      ?.memberId || "";
  const doerId =
    staffing.find((assignment) => assignment.roles.includes("doer"))
      ?.memberId || "";
  const consultantId =
    staffing.find((assignment) => assignment.roles.includes("consultant"))
      ?.memberId || "";

  const stagePlans = normalizeProjectStagePlans({
    ...draft,
    stagePlans: draft.stagePlans,
  });
  const stages = deriveStageNamesFromPlans(stagePlans);
  const stage = resolveCurrentStage(draft.stage, stages);
  const maxBillableHours = stagePlans.reduce(
    (sum, stagePlan) => sum + (Number(stagePlan.perspectiveHours) || 0),
    0,
  );
  const budget = getBudgetSnapshot(draft);

  return {
    ...draft,
    name: draft.name.trim(),
    purpose: draft.purpose.trim(),
    description: String(draft.description || "").trim(),
    clientName: String(draft.clientName || "").trim(),
    clientContactName: String(draft.clientContactName || "").trim(),
    clientContactEmail: String(draft.clientContactEmail || "").trim(),
    clientContactPhone: String(draft.clientContactPhone || "").trim(),
    proposalLink: String(draft.proposalLink || "").trim(),
    contractLink: String(draft.contractLink || "").trim(),
    projectType: projectTypes.join(", "),
    projectTypes,
    engagementType: draft.engagementType,
    stage,
    stages,
    stagePlans,
    startDate: String(draft.startDate || ""),
    dueDate: String(draft.dueDate || ""),
    timelineSummary: String(draft.timelineSummary || "").trim(),
    budgetAmount: budget.amount,
    budgetCurrency: budget.currency,
    budgetTwd: budget.budgetTwd,
    budgetUsd: budget.budgetUsd,
    successMetric: String(draft.successMetric || "").trim(),
    risks: String(draft.risks || "").trim(),
    collaboratorCount,
    staffing,
    leadId,
    doerId,
    consultantId,
    maxBillableHours,
    offerings: (draft.offerings || [])
      .map((offering) => ({
        ...offering,
        name: offering.name.trim(),
        completed: Boolean(offering.completed),
      }))
      .filter((offering) => offering.name),
    createdAt: draft.createdAt || 0,
  };
}

function formatStageLabel(value?: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStages(value?: string[]): string[] {
  return Array.from(
    new Set(
      (value || []).map((item) => formatStageLabel(item)).filter(Boolean),
    ),
  );
}

function resolveCurrentStage(
  stage: string | undefined,
  stages: string[],
): string {
  const normalizedStage = formatStageLabel(stage);
  if (normalizedStage && stages.includes(normalizedStage)) {
    return normalizedStage;
  }

  return stages[0] || "";
}

function normalizeProjectStages(project?: Partial<Project>): string[] {
  const stageList = normalizeStages(project?.stages);
  if (stageList.length) {
    return stageList;
  }

  const fallback = formatStageLabel(project?.stage);
  if (fallback) {
    return [fallback];
  }

  return [...DEFAULT_PROJECT_STAGES];
}

function normalizeProjectStagePlans(
  project?: Partial<Project>,
): ProjectStagePlan[] {
  if (project?.stagePlans?.length) {
    const normalized = project.stagePlans
      .map((stagePlan, index) => ({
        id: stagePlan.id || createLocalId(),
        name: formatStageLabel(stagePlan.name),
        weeks: Math.max(0, Number(stagePlan.weeks) || 0),
        delayWeeks: Math.max(0, Number(stagePlan.delayWeeks) || 0),
        perspectiveHours: Math.max(0, Number(stagePlan.perspectiveHours) || 0),
        order: Number(stagePlan.order) || index,
      }))
      .filter((stagePlan) => stagePlan.name);

    if (normalized.length) {
      return normalized
        .sort((left, right) => left.order - right.order)
        .map((stagePlan, index) => ({
          ...stagePlan,
          order: index,
        }));
    }
  }

  const stageNames = normalizeProjectStages(project);
  return stageNames.map((stageName, index) =>
    createStagePlan(stageName, index),
  );
}

function deriveStageNamesFromPlans(stagePlans: ProjectStagePlan[]): string[] {
  const names = normalizeStages(stagePlans.map((stagePlan) => stagePlan.name));
  if (names.length) {
    return names;
  }

  return [...DEFAULT_PROJECT_STAGES];
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const nextDate = new Date(value);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getInitials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "NA"
  );
}

function normalizeProjectTypes(project?: Partial<Project>): string[] {
  const rawValues =
    Array.isArray(project?.projectTypes) && project?.projectTypes.length
      ? project.projectTypes
      : String(project?.projectType || "").split(",");

  return Array.from(
    new Set(rawValues.map((value) => value.trim()).filter(Boolean)),
  );
}

function normalizeStaffing(
  project?: Partial<Project>,
): ProjectStaffingAssignment[] {
  if (project?.staffing?.length) {
    return project.staffing.map((assignment) => ({
      id: assignment.id || createLocalId(),
      memberId: assignment.memberId || "",
      roles: Array.from(
        new Set(
          (assignment.roles || []).filter((role): role is ProjectTeamRole =>
            staffingRoleOptions.some((option) => option.value === role),
          ),
        ),
      ),
      maxHours: Number(assignment.maxHours) || 0,
    }));
  }

  const assignmentMap = new Map<string, ProjectStaffingAssignment>();

  function appendRole(memberId: string | undefined, role: ProjectTeamRole) {
    if (!memberId) {
      return;
    }
    const existing =
      assignmentMap.get(memberId) ||
      ({
        id: createLocalId(),
        memberId,
        roles: [],
        maxHours: 0,
      } satisfies ProjectStaffingAssignment);

    if (!existing.roles.includes(role)) {
      existing.roles = [...existing.roles, role];
    }
    assignmentMap.set(memberId, existing);
  }

  appendRole(project?.leadId, "lead");
  appendRole(project?.doerId, "doer");
  appendRole(project?.consultantId, "consultant");

  return Array.from(assignmentMap.values());
}

function statusPillClass(isSelected: boolean): string {
  return isSelected
    ? "bg-white/15 text-white ring-white/20"
    : "bg-slate-100 text-slate-700 ring-slate-200";
}

function stageLabel(value: Project["stage"]): string {
  return formatStageLabel(value) || "Stage";
}

function priorityLabel(value: Project["priority"]): string {
  return (
    projectPriorityOptions.find((option) => option.value === value)?.label ||
    "Priority"
  );
}

function projectTypeLabel(value: string): string {
  return (
    projectTypeOptions.find((option) => option.value === value)?.label || value
  );
}

function engagementTypeLabel(value?: ProjectEngagementType): string {
  return (
    engagementTypeOptions.find((option) => option.value === value)?.label ||
    "Engagement type"
  );
}

function engagementTypeToneClass(value?: ProjectEngagementType): string {
  return (
    engagementTypeOptions.find((option) => option.value === value)
      ?.toneClassName || "border-slate-200 bg-slate-50 text-slate-700"
  );
}

function memberNameById(
  memberId: string | undefined,
  memberOptions: Array<{ label: string; value: string }>,
): string {
  return (
    memberOptions.find((memberOption) => memberOption.value === memberId)
      ?.label || "Unassigned"
  );
}

function readStoredDraft<T extends Record<string, unknown>>(
  key: string,
  fallback: T,
): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function writeStoredDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function clearStoredDraft(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}

export function AdminWorkspace({
  members,
  projects,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
}: AdminWorkspaceProps) {
  const [activeView, setActiveView] = useState<AdminView>("members");
  const [memberQuery, setMemberQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [memberSelection, setMemberSelection] = useState<string | null>(null);
  const [projectSelection, setProjectSelection] = useState<string | null>(null);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        label: member.name,
        value: member.id,
      })),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase();
    if (!query) {
      return members;
    }
    return members.filter((member) => {
      const searchableValues = [
        member.name,
        member.email,
        member.location || "",
        member.category || "",
        member.monthlyRole || "",
      ];
      return searchableValues.some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [memberQuery, members]);

  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase();
    if (!query) {
      return projects;
    }
    return projects.filter((project) => {
      const searchableValues = [
        project.name,
        project.clientName || "",
        project.purpose || "",
        project.description || "",
        stageLabel(project.stage),
        engagementTypeLabel(project.engagementType),
        normalizeProjectTypes(project).join(" "),
      ];
      return searchableValues.some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [projectQuery, projects]);

  const resolvedMemberSelection =
    memberSelection === NEW_MEMBER_SELECTION
      ? NEW_MEMBER_SELECTION
      : members.some((member) => member.id === memberSelection)
        ? memberSelection
        : members[0]?.id || NEW_MEMBER_SELECTION;

  const resolvedProjectSelection =
    projectSelection === NEW_PROJECT_SELECTION
      ? NEW_PROJECT_SELECTION
      : projects.some((project) => project.id === projectSelection)
        ? projectSelection
        : projects[0]?.id || NEW_PROJECT_SELECTION;

  const selectedMember =
    resolvedMemberSelection === NEW_MEMBER_SELECTION
      ? undefined
      : members.find((member) => member.id === resolvedMemberSelection);

  const selectedProject =
    resolvedProjectSelection === NEW_PROJECT_SELECTION
      ? undefined
      : projects.find((project) => project.id === resolvedProjectSelection);

  const activeMembers = members.filter(
    (member) => member.status === "active" || member.active,
  ).length;
  const projectsInDelivery = projects.filter(
    (project) =>
      String(project.stage || "")
        .trim()
        .toLowerCase() === "delivery",
  ).length;
  const staffedProjects = projects.filter(
    (project) =>
      (project.staffing || []).some((assignment) => assignment.memberId) ||
      Boolean(project.leadId),
  ).length;
  const totalBudgetTwd = projects.reduce(
    (sum, project) => sum + getBudgetSnapshot(project).budgetTwd,
    0,
  );
  const totalBudgetUsd = projects.reduce(
    (sum, project) => sum + getBudgetSnapshot(project).budgetUsd,
    0,
  );

  return (
    <div className="swiss-shell">
      <div className="swiss-shell__metrics md:grid md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Members"
          value={members.length.toString()}
          detail={`${activeMembers} active this month`}
        />
        <SummaryCard
          icon={FolderOpen}
          label="Projects"
          value={projects.length.toString()}
          detail={`${projectsInDelivery} in delivery`}
        />
        <SummaryCard
          icon={Shield}
          label="Staffed"
          value={staffedProjects.toString()}
          detail="Projects with team assignments"
        />
        <SummaryCard
          icon={Target}
          label="Budget"
          value={formatMoney(totalBudgetTwd, "TWD")}
          detail={`${formatMoney(totalBudgetUsd, "USD")} combined`}
        />
      </div>

      <div className="swiss-shell__main">
        <Card className="border-slate-300 bg-white">
          <CardHeader className="gap-4 border-b border-slate-200 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-end">
            <div className="swiss-segment">
              <button
                type="button"
                className={cn(
                  "swiss-segment__button inline-flex flex-1 items-center justify-center gap-2 text-sm font-medium",
                )}
                data-active={activeView === "members"}
                onClick={() => setActiveView("members")}
              >
                <Users className="h-4 w-4" />
                Members
              </button>
              <button
                type="button"
                className={cn(
                  "swiss-segment__button inline-flex flex-1 items-center justify-center gap-2 text-sm font-medium",
                )}
                data-active={activeView === "projects"}
                onClick={() => setActiveView("projects")}
              >
                <FolderOpen className="h-4 w-4" />
                Projects
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="t-h3">
                  {activeView === "members"
                    ? "Team directory"
                    : "Project register"}
                </CardTitle>
                <CardDescription className="mt-1">
                  {activeView === "members"
                    ? "Search, select, and edit people records in one place."
                    : "Search, select, and edit project records in one place."}
                </CardDescription>
              </div>
              <Button
                type="button"
                className="gap-2"
                onClick={() => {
                  if (activeView === "members") {
                    setMemberSelection(NEW_MEMBER_SELECTION);
                    return;
                  }
                  setProjectSelection(NEW_PROJECT_SELECTION);
                }}
              >
                {activeView === "members" ? (
                  <UserPlus className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {activeView === "members" ? "New member" : "New project"}
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="admin-record-search">
                {activeView === "members"
                  ? "Search members"
                  : "Search projects"}
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="admin-record-search"
                  value={activeView === "members" ? memberQuery : projectQuery}
                  onChange={(event) => {
                    if (activeView === "members") {
                      setMemberQuery(event.target.value);
                      return;
                    }
                    setProjectQuery(event.target.value);
                  }}
                  className="pl-9"
                  placeholder={
                    activeView === "members"
                      ? "Search by name, email, location, or role"
                      : "Search by name, client, purpose, or stage"
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {activeView === "members" ? (
                <>
                  <span className="swiss-tag">{members.length} total</span>
                  <span className="swiss-tag">{activeMembers} active</span>
                  <span className="swiss-tag">
                    {filteredMembers.length} visible
                  </span>
                </>
              ) : (
                <>
                  <span className="swiss-tag">{projects.length} total</span>
                  <span className="swiss-tag">
                    {projectsInDelivery} in delivery
                  </span>
                  <span className="swiss-tag">
                    {filteredProjects.length} visible
                  </span>
                </>
              )}
            </div>
          </CardHeader>

          <CardContent className="grid gap-1.5 p-2 md:grid-cols-2 xl:grid-cols-3">
            {activeView === "members" ? (
              filteredMembers.length ? (
                filteredMembers.map((member) => {
                  const isSelected = resolvedMemberSelection === member.id;
                  const isActive = member.status === "active" || member.active;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      className={cn(
                        "grid w-full gap-2.5 border px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-transparent bg-white text-slate-900 hover:border-slate-200",
                      )}
                      onClick={() => setMemberSelection(member.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center border text-sm font-semibold",
                            isSelected
                              ? "bg-white/15 text-white"
                              : "border-slate-300 text-slate-700",
                          )}
                        >
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">
                              {member.name}
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] ring-1",
                                statusPillClass(isSelected),
                              )}
                            >
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "truncate text-sm",
                              isSelected ? "text-slate-200" : "text-slate-500",
                            )}
                          >
                            {member.email}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 ring-1",
                                statusPillClass(isSelected),
                              )}
                            >
                              {memberCategoryOptions.find(
                                (option) => option.value === member.category,
                              )?.label || "Member"}
                            </span>
                            {member.monthlyRole &&
                            member.monthlyRole !== "none" ? (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 ring-1",
                                  statusPillClass(isSelected),
                                )}
                              >
                                {monthlyRoleOptions.find(
                                  (option) =>
                                    option.value === member.monthlyRole,
                                )?.label || member.monthlyRole}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <EmptyListState
                  icon={Users}
                  title="No members match"
                  description="Try a different search, or create a new member record."
                />
              )
            ) : filteredProjects.length ? (
              filteredProjects.map((project) => {
                const isSelected = resolvedProjectSelection === project.id;

                return (
                  <button
                    key={project.id}
                    type="button"
                    className={cn(
                      "grid w-full gap-2.5 border px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-transparent bg-white text-slate-900 hover:border-slate-200",
                    )}
                    onClick={() => setProjectSelection(project.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center border",
                          isSelected
                            ? "bg-white/15 text-white"
                            : "border-slate-300 text-slate-700",
                        )}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium">{project.name}</p>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] ring-1",
                              statusPillClass(isSelected),
                            )}
                          >
                            {stageLabel(project.stage)}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "truncate text-sm",
                            isSelected ? "text-slate-200" : "text-slate-500",
                          )}
                        >
                          {project.clientName || "Internal project"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {project.engagementType ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 ring-1",
                                statusPillClass(isSelected),
                              )}
                            >
                              {engagementTypeLabel(project.engagementType)}
                            </span>
                          ) : null}
                          {normalizeProjectTypes(project)
                            .slice(0, 2)
                            .map((typeValue) => (
                              <span
                                key={typeValue}
                                className={cn(
                                  "rounded-full px-2 py-0.5 ring-1",
                                  statusPillClass(isSelected),
                                )}
                              >
                                {projectTypeLabel(typeValue)}
                              </span>
                            ))}
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 ring-1",
                              statusPillClass(isSelected),
                            )}
                          >
                            {priorityLabel(project.priority)} priority
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 ring-1",
                              statusPillClass(isSelected),
                            )}
                          >
                            {project.collaboratorCount || 0} staffed
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyListState
                icon={FolderOpen}
                title="No projects match"
                description="Try a different search, or create a new project record."
              />
            )}
          </CardContent>
        </Card>

        {activeView === "members" ? (
          <MemberEditor
            key={selectedMember?.id || NEW_MEMBER_SELECTION}
            member={selectedMember}
            onCreateMember={onCreateMember}
            onUpdateMember={onUpdateMember}
            onDeleteMember={onDeleteMember}
            onSelectMember={setMemberSelection}
          />
        ) : (
          <ProjectEditor
            key={selectedProject?.id || NEW_PROJECT_SELECTION}
            memberOptions={memberOptions}
            projects={projects}
            project={selectedProject}
            onCreateProject={onCreateProject}
            onUpdateProject={onUpdateProject}
            onDeleteProject={onDeleteProject}
            onSelectProject={setProjectSelection}
          />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-slate-300 bg-white">
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="t-b2 text-slate-500">{label}</p>
          <p className="t-h2 text-slate-950">{value}</p>
          <p className="t-b2 text-slate-500">{detail}</p>
        </div>
        <div className="border border-slate-200 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyListState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="swiss-empty-state grid place-items-center gap-2 px-5 py-10 text-center">
      <div className="text-slate-500">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-medium text-slate-900">{title}</p>
      <p className="max-w-xs text-sm text-slate-500">{description}</p>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-slate-500" />
        {title}
      </div>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

function AutosaveBadge({
  state,
  message,
}: {
  state: AutosaveState;
  message: string;
}) {
  const iconMap: Record<AutosaveState, LucideIcon> = {
    idle: Clock3,
    local: Clock3,
    saving: Clock3,
    saved: Check,
    error: CircleAlert,
  };
  const toneMap: Record<AutosaveState, string> = {
    idle: "text-slate-600",
    local: "text-slate-700",
    saving: "text-slate-700",
    saved: "text-slate-700",
    error: "text-red-700",
  };
  const Icon = iconMap[state];

  return (
    <span
      className={cn(
        "swiss-tag inline-flex items-center gap-2 text-xs font-medium",
        toneMap[state],
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {message}
    </span>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
  toneClassName = "text-slate-900",
}: {
  label: string;
  value: string;
  detail: string;
  toneClassName?: string;
}) {
  return (
    <div className={cn("metric-card px-4 py-3", toneClassName)}>
      <p className="t-label">{label}</p>
      <p className="t-h3 mt-2">{value}</p>
      <p className="t-b2 mt-1 text-slate-500">{detail}</p>
    </div>
  );
}

// ─── Shared editor primitives ─────────────────────────────────────────────────

function TabNav({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: readonly string[];
  activeTab: string;
  onChange: (tab: string) => void;
}) {
  return (
    <nav className="flex overflow-x-auto border-b border-slate-200 px-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === tab
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-700",
          )}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

function SectionPanel({
  title,
  description,
  isEditing,
  onEdit,
  onSave,
  onDiscard,
  isSaving,
  alwaysEditing,
  children,
}: {
  title: string;
  description?: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void | Promise<void>;
  onDiscard: () => void;
  isSaving?: boolean;
  alwaysEditing?: boolean;
  children: ReactNode;
}) {
  const editing = alwaysEditing || isEditing;
  return (
    <div
      className={cn(
        "border bg-white p-4 transition-colors duration-150",
        editing ? "border-slate-900" : "border-slate-300",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description && (
            <p className="text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
        {!alwaysEditing && (
          <div className="flex shrink-0 gap-2">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void onSave();
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onDiscard}
                >
                  Discard
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 px-0"
                onClick={onEdit}
                aria-label={`Edit ${title}`}
                title={`Edit ${title}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
      <fieldset
        disabled={!editing}
        className={cn("min-w-0", !editing && "[&_select]:appearance-none")}
      >
        {children}
      </fieldset>
    </div>
  );
}

// ─── Member editor ────────────────────────────────────────────────────────────

const MEMBER_TABS = ["Identity", "Profile"] as const;
type MemberTab = (typeof MEMBER_TABS)[number];

function MemberEditor({
  member,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onSelectMember,
}: {
  member?: Member;
  onCreateMember: (payload: Omit<Member, "id">) => Promise<string>;
  onUpdateMember: (
    id: string,
    payload: Partial<Omit<Member, "id">>,
  ) => Promise<void>;
  onDeleteMember: (id: string) => Promise<void>;
  onSelectMember: (value: string | null) => void;
}) {
  const isNew = !member;
  const normalizedMember = useMemo(() => normalizeMember(member), [member]);
  const sourceSnapshot = member
    ? JSON.stringify(serializeMember(normalizedMember))
    : null;
  const [draft, setDraft] = useState<Omit<Member, "id">>(() =>
    member
      ? normalizedMember
      : readStoredDraft(NEW_MEMBER_DRAFT_STORAGE_KEY, createEmptyMemberDraft()),
  );
  const [customPronoun, setCustomPronoun] = useState("");
  const [activeTab, setActiveTab] = useState<MemberTab>("Identity");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<AutosaveState>("idle");
  const [saveMessage, setSaveMessage] = useState(
    isNew ? "Fill in the fields and click Create." : "Saved.",
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const lastSavedSnapshotRef = useRef<string | null>(sourceSnapshot);
  const serializedDraft = useMemo(() => serializeMember(draft), [draft]);

  useEffect(() => {
    if (member && sourceSnapshot) {
      setDraft(normalizedMember);
      lastSavedSnapshotRef.current = sourceSnapshot;
      setSaveState("idle");
      setSaveMessage("Saved.");
      setEditingSection(null);
      return;
    }
    if (!member) {
      const stored = readStoredDraft(
        NEW_MEMBER_DRAFT_STORAGE_KEY,
        createEmptyMemberDraft(),
      );
      setDraft(stored);
      lastSavedSnapshotRef.current = null;
    }
  }, [member, normalizedMember, sourceSnapshot]);

  useEffect(() => {
    if (!member) writeStoredDraft(NEW_MEMBER_DRAFT_STORAGE_KEY, draft);
  }, [draft, member]);

  async function saveSection(sectionId: string) {
    if (!member) return;
    void sectionId;
    setSaveState("saving");
    setSaveMessage("Saving...");
    try {
      await onUpdateMember(member.id, serializedDraft);
      lastSavedSnapshotRef.current = JSON.stringify(serializedDraft);
      setSaveState("saved");
      setSaveMessage("Saved.");
      setEditingSection(null);
    } catch {
      setSaveState("error");
      setSaveMessage("Could not save. Try again.");
    }
  }

  async function createRecord() {
    if (!serializedDraft.name || !serializedDraft.email) {
      setSaveState("error");
      setSaveMessage("Name and email are required.");
      return;
    }
    setSaveState("saving");
    setSaveMessage("Creating...");
    try {
      const id = await onCreateMember(serializedDraft);
      lastSavedSnapshotRef.current = JSON.stringify(serializedDraft);
      clearStoredDraft(NEW_MEMBER_DRAFT_STORAGE_KEY);
      setSaveState("saved");
      setSaveMessage("Created.");
      onSelectMember(id);
    } catch {
      setSaveState("error");
      setSaveMessage("Could not create. Try again.");
    }
  }

  function discardSection(fields: (keyof Omit<Member, "id">)[]) {
    const base = normalizedMember;
    setDraft((prev) => {
      const patch = Object.fromEntries(
        fields.map((f) => [f, base[f as keyof typeof base]]),
      ) as Partial<Omit<Member, "id">>;
      return { ...prev, ...patch };
    });
    setEditingSection(null);
    setSaveState("idle");
    setSaveMessage("Saved.");
  }

  function sp(id: string, fields: (keyof Omit<Member, "id">)[]) {
    return {
      isEditing: editingSection === id,
      onEdit: () => setEditingSection(id),
      onSave: () => saveSection(id),
      onDiscard: () => discardSection(fields),
      isSaving: saveState === "saving",
      alwaysEditing: isNew,
    };
  }

  async function handleDelete() {
    if (!member) return;
    if (
      !window.confirm(
        `Delete ${member.name}? This removes them from the admin panel.`,
      )
    )
      return;
    setIsDeleting(true);
    try {
      await onDeleteMember(member.id);
      onSelectMember(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function togglePronoun(value: string) {
    setDraft((c) => ({
      ...c,
      pronouns: (c.pronouns || []).includes(value)
        ? (c.pronouns || []).filter((p) => p !== value)
        : [...(c.pronouns || []), value],
    }));
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* Record header */}
      <div className="flex flex-col gap-4 border border-slate-300 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            {isNew ? (
              <UserRound className="h-5 w-5" />
            ) : (
              getInitials(draft.name)
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {draft.name.trim() || (member ? member.name : "New member")}
              </h2>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  isNew
                    ? "bg-slate-100 text-slate-500"
                    : draft.active
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                )}
              >
                {isNew ? "New member" : draft.active ? "Active" : "Inactive"}
              </span>
              {!isNew && draft.monthlyRole && draft.monthlyRole !== "none" && (
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                  {
                    monthlyRoleOptions.find(
                      (o) => o.value === draft.monthlyRole,
                    )?.label
                  }
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {isNew
                ? "Fill in the fields and click Create"
                : draft.email || "No email set"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutosaveBadge state={saveState} message={saveMessage} />
          {isNew && (
            <Button
              type="button"
              onClick={() => {
                void createRecord();
              }}
              disabled={
                saveState === "saving" ||
                !draft.name.trim() ||
                !draft.email.trim()
              }
            >
              {saveState === "saving" ? "Creating..." : "Create member"}
            </Button>
          )}
          {member && (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
              onClick={() => {
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabbed sections */}
      <div className="overflow-hidden border border-slate-300 bg-white">
        <TabNav
          tabs={MEMBER_TABS}
          activeTab={activeTab}
          onChange={(t) => setActiveTab(t as MemberTab)}
        />
        <div className="space-y-3 p-4">
          {activeTab === "Identity" && (
            <>
              <SectionPanel
                title="Identity"
                description="Name, email, membership type, and active status."
                {...sp("identity", [
                  "name",
                  "email",
                  "category",
                  "monthlyRole",
                  "role",
                  "active",
                  "status",
                  "workerOwner",
                ])}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FieldBlock label="Full name" required>
                    <Input
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, name: e.target.value }))
                      }
                      placeholder="Full name"
                    />
                  </FieldBlock>
                  <FieldBlock label="Email" required>
                    <Input
                      type="email"
                      value={draft.email}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, email: e.target.value }))
                      }
                      placeholder="name@example.com"
                    />
                  </FieldBlock>
                  <FieldBlock label="Category" required>
                    <select
                      className={inputClassName}
                      value={draft.category}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          category: e.target.value as MemberCategory,
                          workerOwner: e.target.value === "workerOwner",
                        }))
                      }
                    >
                      {memberCategoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="Monthly role" optional>
                    <select
                      className={inputClassName}
                      value={draft.monthlyRole || "none"}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          monthlyRole: e.target.value as MemberMonthlyRole,
                          role: e.target.value === "none" ? "" : e.target.value,
                        }))
                      }
                    >
                      {monthlyRoleOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                </div>
                <div className="mt-3">
                  <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 hover:bg-white">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.active)}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          active: e.target.checked,
                          status: e.target.checked ? "active" : "inactive",
                        }))
                      }
                    />
                    Active this month
                  </label>
                </div>
              </SectionPanel>

              <SectionPanel
                title="Availability"
                description="Contact info and working capacity."
                {...sp("availability", [
                  "phone",
                  "location",
                  "capacityPerWeek",
                  "vacationDays",
                ])}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FieldBlock label="Phone" optional>
                    <Input
                      value={draft.phone || ""}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, phone: e.target.value }))
                      }
                      placeholder="+1 (555) 000-0000"
                    />
                  </FieldBlock>
                  <FieldBlock label="Location" optional>
                    <Input
                      list="member-location-suggestions"
                      value={draft.location || ""}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, location: e.target.value }))
                      }
                      placeholder="City, country"
                    />
                  </FieldBlock>
                  <FieldBlock label="Capacity / week (hrs)" optional>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft.capacityPerWeek ?? 0}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          capacityPerWeek: Number(e.target.value) || 0,
                        }))
                      }
                      placeholder="30"
                    />
                  </FieldBlock>
                  <FieldBlock label="Vacation days" optional>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={draft.vacationDays ?? 0}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          vacationDays: Number(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                    />
                  </FieldBlock>
                </div>
                <datalist id="member-location-suggestions">
                  {locationSuggestions.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </SectionPanel>
            </>
          )}

          {activeTab === "Profile" && (
            <SectionPanel
              title="Profile & notes"
              description="Pronouns and any context relevant to working with this person."
              {...sp("profile", ["pronouns", "notes"])}
            >
              <div className="grid gap-5">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Label>Pronouns</Label>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                      optional
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pronounOptions.map((option) => {
                      const selected = (draft.pronouns || []).includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm transition-colors",
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                          onClick={() => togglePronoun(option)}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={customPronoun}
                      onChange={(e) => setCustomPronoun(e.target.value)}
                      placeholder="Custom pronoun"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const v = customPronoun.trim();
                        if (!v || (draft.pronouns || []).includes(v)) return;
                        setDraft((c) => ({
                          ...c,
                          pronouns: [...(c.pronouns || []), v],
                        }));
                        setCustomPronoun("");
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
                <FieldBlock label="Admin notes" optional>
                  <Textarea
                    rows={5}
                    value={draft.notes || ""}
                    onChange={(e) =>
                      setDraft((c) => ({ ...c, notes: e.target.value }))
                    }
                    placeholder="Availability context, working preferences, or admin notes"
                  />
                </FieldBlock>
              </div>
            </SectionPanel>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Project editor ───────────────────────────────────────────────────────────

const PROJECT_TABS = [
  "Overview",
  "Timeline",
  "Team",
  "Client",
  "Budget",
] as const;
type ProjectTab = (typeof PROJECT_TABS)[number];

function ProjectEditor({
  memberOptions,
  projects,
  project,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onSelectProject,
}: {
  memberOptions: Array<{ label: string; value: string }>;
  projects: Project[];
  project?: Project;
  onCreateProject: (payload: Omit<Project, "id">) => Promise<string>;
  onUpdateProject: (
    id: string,
    payload: Partial<Omit<Project, "id">>,
  ) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onSelectProject: (value: string | null) => void;
}) {
  const isNew = !project;
  const normalizedProject = useMemo(() => normalizeProject(project), [project]);
  const sourceSnapshot = project
    ? JSON.stringify(serializeProject(normalizedProject))
    : null;
  const [draft, setDraft] = useState<Omit<Project, "id">>(() =>
    project
      ? normalizedProject
      : readStoredDraft(
          NEW_PROJECT_DRAFT_STORAGE_KEY,
          createEmptyProjectDraft(),
        ),
  );
  const [activeTab, setActiveTab] = useState<ProjectTab>("Overview");
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<AutosaveState>("idle");
  const [saveMessage, setSaveMessage] = useState(
    isNew ? "Fill in the fields and click Create." : "Saved.",
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [draggingStageId, setDraggingStageId] = useState("");
  const lastSavedSnapshotRef = useRef<string | null>(sourceSnapshot);

  const serializedDraft = useMemo(() => serializeProject(draft), [draft]);

  const clientSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          projects
            .map((p) => String(p.clientName || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [projects],
  );

  const budget = getBudgetSnapshot(draft);
  const budgetAmount = budget.amount;
  const budgetCurrency = budget.currency;
  const budgetTwd = budget.budgetTwd;
  const budgetUsd = budget.budgetUsd;
  const stagePlans = normalizeProjectStagePlans({
    ...draft,
    stagePlans: draft.stagePlans,
  });
  const totalPerspectiveHours = stagePlans.reduce(
    (sum, sp) => sum + (Number(sp.perspectiveHours) || 0),
    0,
  );
  const maxBillableHours = totalPerspectiveHours;
  const hourlyUsd = maxBillableHours > 0 ? budgetUsd / maxBillableHours : 0;
  const hourlyTwd = maxBillableHours > 0 ? budgetTwd / maxBillableHours : 0;
  const staffing = draft.staffing || [];
  const staffedAssignments = staffing.filter((a) => a.memberId);
  const staffedMembers = new Set(staffedAssignments.map((a) => a.memberId))
    .size;
  const assignedHours = staffedAssignments.reduce(
    (sum, a) => sum + (Number(a.maxHours) || 0),
    0,
  );
  const allocatedPayUsd = assignedHours * hourlyUsd;
  const overAllocatedHours =
    maxBillableHours > 0 && assignedHours > maxBillableHours;
  const projectStartDate = parseIsoDate(draft.startDate);

  const stageSchedule = useMemo(() => {
    let weekCursor = 0;
    return stagePlans.map((sp) => {
      const delayWeeks = Math.max(0, Number(sp.delayWeeks) || 0);
      const weeks = Math.max(0, Number(sp.weeks) || 0);
      weekCursor += delayWeeks;
      const startDate = projectStartDate
        ? addDays(projectStartDate, weekCursor * 7)
        : null;
      const endDate =
        projectStartDate && weeks > 0
          ? addDays(projectStartDate, (weekCursor + weeks) * 7 - 1)
          : startDate;
      weekCursor += weeks;
      return { ...sp, startDate, endDate };
    });
  }, [projectStartDate, stagePlans]);

  useEffect(() => {
    if (project && sourceSnapshot) {
      setDraft(normalizedProject);
      lastSavedSnapshotRef.current = sourceSnapshot;
      setSaveState("idle");
      setSaveMessage("Saved.");
      setEditingSection(null);
      return;
    }
    if (!project) {
      const stored = readStoredDraft(
        NEW_PROJECT_DRAFT_STORAGE_KEY,
        createEmptyProjectDraft(),
      );
      setDraft(stored);
      lastSavedSnapshotRef.current = null;
    }
  }, [normalizedProject, project, sourceSnapshot]);

  useEffect(() => {
    if (!project) writeStoredDraft(NEW_PROJECT_DRAFT_STORAGE_KEY, draft);
  }, [draft, project]);

  async function saveSection(sectionId: string) {
    if (!project) return;
    void sectionId;
    setSaveState("saving");
    setSaveMessage("Saving...");
    try {
      await onUpdateProject(project.id, serializedDraft);
      lastSavedSnapshotRef.current = JSON.stringify(serializedDraft);
      setSaveState("saved");
      setSaveMessage("Saved.");
      setEditingSection(null);
    } catch {
      setSaveState("error");
      setSaveMessage("Could not save. Try again.");
    }
  }

  async function createRecord() {
    if (
      !serializedDraft.name ||
      !serializedDraft.purpose ||
      !serializedDraft.engagementType
    ) {
      setSaveState("error");
      setSaveMessage(
        "Project name, purpose, and engagement type are required.",
      );
      return;
    }
    setSaveState("saving");
    setSaveMessage("Creating...");
    try {
      const id = await onCreateProject({
        ...serializedDraft,
        createdAt: serializedDraft.createdAt || Date.now(),
      });
      lastSavedSnapshotRef.current = JSON.stringify(serializedDraft);
      clearStoredDraft(NEW_PROJECT_DRAFT_STORAGE_KEY);
      setSaveState("saved");
      setSaveMessage("Created.");
      onSelectProject(id);
    } catch {
      setSaveState("error");
      setSaveMessage("Could not create. Try again.");
    }
  }

  function discardSection(fields: (keyof Omit<Project, "id">)[]) {
    const base = normalizedProject;
    setDraft((prev) => {
      const patch = Object.fromEntries(
        fields.map((f) => [f, base[f as keyof typeof base]]),
      ) as Partial<Omit<Project, "id">>;
      return { ...prev, ...patch };
    });
    setEditingSection(null);
    setSaveState("idle");
    setSaveMessage("Saved.");
  }

  function sp(id: string, fields: (keyof Omit<Project, "id">)[]) {
    return {
      isEditing: editingSection === id,
      onEdit: () => setEditingSection(id),
      onSave: () => saveSection(id),
      onDiscard: () => discardSection(fields),
      isSaving: saveState === "saving",
      alwaysEditing: isNew,
    };
  }

  async function handleDelete() {
    if (!project) return;
    if (
      !window.confirm(
        `Delete ${project.name}? Existing tasks and notes may still reference it.`,
      )
    )
      return;
    setIsDeleting(true);
    try {
      await onDeleteProject(project.id);
      onSelectProject(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleProjectType(value: string) {
    setDraft((c) => {
      const types = c.projectTypes || [];
      return {
        ...c,
        projectTypes: types.includes(value)
          ? types.filter((t) => t !== value)
          : [...types, value],
      };
    });
  }

  function addProjectStage(rawValue: string) {
    const stageName = formatStageLabel(rawValue);
    if (!stageName) return;
    setDraft((c) => {
      const currentStages = normalizeStages(c.stages);
      if (currentStages.includes(stageName)) return c;
      const nextStages = [...currentStages, stageName];
      const nextStagePlans = [
        ...normalizeProjectStagePlans(c),
        createStagePlan(stageName, normalizeProjectStagePlans(c).length),
      ];
      return {
        ...c,
        stages: nextStages,
        stagePlans: nextStagePlans,
        stage: resolveCurrentStage(c.stage, nextStages),
      };
    });
  }

  function removeProjectStage(stageId: string) {
    setDraft((c) => {
      const current = normalizeProjectStagePlans(c);
      if (current.length <= 1) return c;
      const next = current
        .filter((s) => s.id !== stageId)
        .map((s, i) => ({ ...s, order: i }));
      const nextStages = deriveStageNamesFromPlans(next);
      return {
        ...c,
        stages: nextStages,
        stagePlans: next,
        stage: resolveCurrentStage(c.stage, nextStages),
      };
    });
  }

  function updateStagePlan(stageId: string, patch: Partial<ProjectStagePlan>) {
    setDraft((c) => {
      const next = normalizeProjectStagePlans(c)
        .map((s) =>
          s.id === stageId
            ? {
                ...s,
                ...patch,
                name: patch.name ? formatStageLabel(patch.name) : s.name,
              }
            : s,
        )
        .map((s, i) => ({ ...s, order: i }));
      const nextStages = deriveStageNamesFromPlans(next);
      return {
        ...c,
        stagePlans: next,
        stages: nextStages,
        stage: resolveCurrentStage(c.stage, nextStages),
      };
    });
  }

  function reorderStagePlans(sourceId: string, targetId: string) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setDraft((c) => {
      const current = normalizeProjectStagePlans(c);
      const si = current.findIndex((s) => s.id === sourceId);
      const ti = current.findIndex((s) => s.id === targetId);
      if (si < 0 || ti < 0) return c;
      const next = [...current];
      const [moved] = next.splice(si, 1);
      next.splice(ti, 0, moved);
      const normalized = next.map((s, i) => ({ ...s, order: i }));
      const nextStages = deriveStageNamesFromPlans(normalized);
      return {
        ...c,
        stagePlans: normalized,
        stages: nextStages,
        stage: resolveCurrentStage(c.stage, nextStages),
      };
    });
  }

  function moveStagePlan(stageId: string, direction: "up" | "down") {
    const idx = stagePlans.findIndex((s) => s.id === stageId);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= stagePlans.length) return;
    reorderStagePlans(stageId, stagePlans[target].id);
  }

  function toggleStaffingRole(assignmentId: string, role: ProjectTeamRole) {
    setDraft((c) => {
      const next = (c.staffing || []).map((a) => {
        if (a.id !== assignmentId) {
          return role === "lead"
            ? { ...a, roles: a.roles.filter((r) => r !== "lead") }
            : a;
        }
        const has = a.roles.includes(role);
        return {
          ...a,
          roles: has ? a.roles.filter((r) => r !== role) : [...a.roles, role],
        };
      });
      return { ...c, staffing: next };
    });
  }

  const engagementTone = engagementTypeToneClass(draft.engagementType);

  return (
    <div className="min-w-0 space-y-4">
      {/* Record header */}
      <div
        className={cn(
          "flex flex-col gap-4 border p-4 sm:flex-row sm:items-center sm:justify-between",
          draft.engagementType
            ? engagementTone
                .split(" ")
                .filter((c) => !c.startsWith("hover:"))
                .join(" ")
            : "border-slate-200 bg-white",
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-700">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {draft.name.trim() || (project ? project.name : "New project")}
              </h2>
              {draft.stage && (
                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {stageLabel(draft.stage)}
                </span>
              )}
              {draft.engagementType && (
                <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {engagementTypeLabel(draft.engagementType)}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {isNew
                ? "Fill in the fields and click Create"
                : draft.clientName || "Internal project"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutosaveBadge state={saveState} message={saveMessage} />
          {isNew && (
            <Button
              type="button"
              onClick={() => {
                void createRecord();
              }}
              disabled={
                saveState === "saving" ||
                !draft.name.trim() ||
                !draft.purpose.trim() ||
                !draft.engagementType
              }
            >
              {saveState === "saving" ? "Creating..." : "Create project"}
            </Button>
          )}
          {project && (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 border-red-200 bg-white/70 text-red-700 hover:bg-red-50"
              onClick={() => {
                void handleDelete();
              }}
              disabled={isDeleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          )}
        </div>
      </div>

      {/* Tabbed sections */}
      <div className="overflow-hidden border border-slate-300 bg-white">
        <TabNav
          tabs={PROJECT_TABS}
          activeTab={activeTab}
          onChange={(t) => setActiveTab(t as ProjectTab)}
        />
        <div className="space-y-3 p-4">
          {/* ── Overview ── */}
          {activeTab === "Overview" && (
            <SectionPanel
              title="Core details"
              description="Project identity, purpose, and engagement type."
              {...sp("overview", [
                "name",
                "purpose",
                "description",
                "engagementType",
                "projectType",
                "projectTypes",
              ])}
            >
              <div className="grid gap-4">
                <FieldBlock label="Project name" required>
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((c) => ({ ...c, name: e.target.value }))
                    }
                    placeholder="Project name"
                  />
                </FieldBlock>
                <FieldBlock label="Purpose" required>
                  <Textarea
                    rows={3}
                    value={draft.purpose}
                    onChange={(e) =>
                      setDraft((c) => ({ ...c, purpose: e.target.value }))
                    }
                    placeholder="What is this project trying to achieve?"
                  />
                </FieldBlock>
                <FieldBlock label="Working description" optional>
                  <Textarea
                    rows={3}
                    value={draft.description || ""}
                    onChange={(e) =>
                      setDraft((c) => ({ ...c, description: e.target.value }))
                    }
                    placeholder="Scope, constraints, or delivery notes"
                  />
                </FieldBlock>
                <FieldBlock label="Engagement type" required>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {engagementTypeOptions.map((option) => {
                      const selected = draft.engagementType === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={cn(
                            "rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors",
                            selected
                              ? option.toneClassName
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          )}
                          onClick={() =>
                            setDraft((c) => ({
                              ...c,
                              engagementType: option.value,
                            }))
                          }
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </FieldBlock>
                <FieldBlock label="Project types" optional>
                  <div className="flex flex-wrap gap-2">
                    {projectTypeOptions.map((option) => {
                      const selected = (draft.projectTypes || []).includes(
                        option.value,
                      );
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm transition-colors",
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                          onClick={() => toggleProjectType(option.value)}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </FieldBlock>
              </div>
            </SectionPanel>
          )}

          {/* ── Timeline ── */}
          {activeTab === "Timeline" && (
            <>
              <SectionPanel
                title="Stage plan"
                description="Define and sequence each stage with duration, delays, and perspective hours."
                {...sp("stageplan", ["stage", "stages", "stagePlans"])}
              >
                <div className="grid gap-3">
                  {stageSchedule.map((stagePlan) => {
                    const isCurrentStage =
                      resolveCurrentStage(
                        draft.stage,
                        deriveStageNamesFromPlans(stagePlans),
                      ) === stagePlan.name;
                    return (
                      <div
                        key={stagePlan.id}
                        draggable
                        onDragStart={() => setDraggingStageId(stagePlan.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          reorderStagePlans(draggingStageId, stagePlan.id);
                          setDraggingStageId("");
                        }}
                        className={cn(
                          "grid gap-3 rounded-xl border bg-white p-3 2xl:grid-cols-[auto_minmax(0,1.4fr)_100px_110px_100px_minmax(0,1fr)_auto]",
                          isCurrentStage
                            ? "border-slate-900"
                            : "border-slate-200",
                        )}
                      >
                        <div className="flex items-center">
                          <span className="cursor-grab rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-400">
                            <GripVertical className="h-4 w-4" />
                          </span>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-slate-500">
                            Stage
                          </Label>
                          <Input
                            list="project-stage-suggestions"
                            value={stagePlan.name}
                            onChange={(e) =>
                              updateStagePlan(stagePlan.id, {
                                name: e.target.value,
                              })
                            }
                            placeholder="Stage name"
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-slate-500">
                            Weeks
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={stagePlan.weeks}
                            onChange={(e) =>
                              updateStagePlan(stagePlan.id, {
                                weeks: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-slate-500">
                            Delay
                          </Label>
                          <div className="flex items-center gap-1">
                            <span className="inline-flex h-11 flex-1 items-center rounded-(--radius-input) border border-slate-300/85 bg-white px-3 text-sm text-slate-700">
                              {stagePlan.delayWeeks}w
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateStagePlan(stagePlan.id, {
                                  delayWeeks: stagePlan.delayWeeks + 1,
                                })
                              }
                            >
                              +1
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-slate-500">
                            Hours
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={stagePlan.perspectiveHours}
                            onChange={(e) =>
                              updateStagePlan(stagePlan.id, {
                                perspectiveHours: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs text-slate-500">
                            Timeline
                          </Label>
                          <div className="rounded-(--radius-input) border border-slate-300/85 bg-white px-3 py-2 text-sm text-slate-700">
                            {projectStartDate
                              ? `${formatDate(stagePlan.startDate || projectStartDate)} → ${formatDate(stagePlan.endDate || projectStartDate)}`
                              : "No start date"}
                            {stagePlan.delayWeeks ? (
                              <p className="mt-0.5 text-xs text-amber-700">
                                +{stagePlan.delayWeeks}w delay
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => moveStagePlan(stagePlan.id, "up")}
                            disabled={stagePlan.order === 0}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => moveStagePlan(stagePlan.id, "down")}
                            disabled={stagePlan.order === stagePlans.length - 1}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant={isCurrentStage ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              setDraft((c) => ({
                                ...c,
                                stage: stagePlan.name,
                              }))
                            }
                          >
                            {isCurrentStage ? "Current" : "Set"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeProjectStage(stagePlan.id)}
                            disabled={stagePlans.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {DEFAULT_PROJECT_STAGES.map((name) => (
                      <Button
                        key={name}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addProjectStage(name)}
                      >
                        + {name}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDraft((c) => {
                          const current = normalizeProjectStagePlans(c);
                          const next = [
                            ...current,
                            createStagePlan(
                              `Stage ${current.length + 1}`,
                              current.length,
                            ),
                          ];
                          return {
                            ...c,
                            stagePlans: next,
                            stages: deriveStageNamesFromPlans(next),
                            stage: resolveCurrentStage(
                              c.stage,
                              deriveStageNamesFromPlans(next),
                            ),
                          };
                        })
                      }
                    >
                      + Custom stage
                    </Button>
                  </div>
                  <datalist id="project-stage-suggestions">
                    {DEFAULT_PROJECT_STAGES.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </SectionPanel>

              <SectionPanel
                title="Schedule"
                description="Start date, due date, priority, and timeline summary."
                {...sp("schedule", [
                  "startDate",
                  "dueDate",
                  "priority",
                  "timelineSummary",
                ])}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FieldBlock label="Start date" required>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        type="date"
                        value={draft.startDate || ""}
                        onChange={(e) =>
                          setDraft((c) => ({ ...c, startDate: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setDraft((c) => ({ ...c, startDate: "" }))
                        }
                      >
                        Clear
                      </Button>
                    </div>
                  </FieldBlock>
                  <FieldBlock label="Due date" optional>
                    <Input
                      type="date"
                      value={draft.dueDate || ""}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, dueDate: e.target.value }))
                      }
                    />
                  </FieldBlock>
                  <FieldBlock label="Priority" required>
                    <select
                      className={inputClassName}
                      value={draft.priority}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          priority: e.target.value as Project["priority"],
                        }))
                      }
                    >
                      {projectPriorityOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                  <FieldBlock label="Timeline summary" optional>
                    <Input
                      value={draft.timelineSummary || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          timelineSummary: e.target.value,
                        }))
                      }
                      placeholder="Milestones or delivery plan"
                    />
                  </FieldBlock>
                </div>
                {projectStartDate && stageSchedule.length ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Auto project end:{" "}
                    <strong className="text-slate-900">
                      {formatDate(
                        stageSchedule[stageSchedule.length - 1]?.endDate ||
                          projectStartDate,
                      )}
                    </strong>{" "}
                    — calculated from stage order, duration, and delays.
                  </p>
                ) : null}
              </SectionPanel>
            </>
          )}

          {/* ── Team ── */}
          {activeTab === "Team" && (
            <SectionPanel
              title="Staffing"
              description="Assign people, define roles, and model hours and pay from the project budget."
              {...sp("staffing", [
                "staffing",
                "leadId",
                "doerId",
                "consultantId",
                "collaboratorCount",
                "maxBillableHours",
              ])}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryMetric
                  label="Staffed"
                  value={staffedMembers.toString()}
                  detail={
                    staffedMembers
                      ? `${staffedMembers} people assigned`
                      : "No one assigned yet"
                  }
                />
                <SummaryMetric
                  label="Hours assigned"
                  value={`${assignedHours.toFixed(1)}h`}
                  detail={
                    maxBillableHours
                      ? `${Math.max(maxBillableHours - assignedHours, 0).toFixed(1)}h remaining`
                      : "Set perspective hours in Timeline"
                  }
                  toneClassName={
                    overAllocatedHours
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                  }
                />
                <SummaryMetric
                  label="Hourly rate"
                  value={hourlyUsd ? `$${hourlyUsd.toFixed(2)}` : "$0.00"}
                  detail={
                    hourlyTwd
                      ? `NT$${hourlyTwd.toLocaleString()}`
                      : "Set budget & hours"
                  }
                  toneClassName="border-sky-200 bg-sky-50 text-slate-900"
                />
                <SummaryMetric
                  label="Modeled pay"
                  value={`$${allocatedPayUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  detail="Assigned hours × implied rate"
                  toneClassName="border-emerald-200 bg-emerald-50 text-slate-900"
                />
              </div>

              <div className="grid gap-3">
                {staffing.length ? (
                  staffing.map((assignment) => {
                    const pay = (Number(assignment.maxHours) || 0) * hourlyUsd;
                    return (
                      <div
                        key={assignment.id}
                        className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 xl:grid-cols-[minmax(0,200px)_minmax(0,1fr)_120px_140px_auto]"
                      >
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-slate-500">
                            Person
                          </Label>
                          <select
                            className={inputClassName}
                            value={assignment.memberId}
                            onChange={(e) =>
                              setDraft((c) => ({
                                ...c,
                                staffing: (c.staffing || []).map((item) =>
                                  item.id === assignment.id
                                    ? { ...item, memberId: e.target.value }
                                    : item,
                                ),
                              }))
                            }
                          >
                            <option value="">Select member</option>
                            {memberOptions.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-slate-500">
                            Roles
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {staffingRoleOptions.map((roleOption) => {
                              const sel = assignment.roles.includes(
                                roleOption.value,
                              );
                              return (
                                <button
                                  key={roleOption.value}
                                  type="button"
                                  className={cn(
                                    "rounded-xl border px-3 py-2 text-sm transition-colors",
                                    sel
                                      ? roleOption.toneClassName
                                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                                  )}
                                  onClick={() =>
                                    toggleStaffingRole(
                                      assignment.id,
                                      roleOption.value,
                                    )
                                  }
                                >
                                  {roleOption.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-slate-500">
                            Max hrs
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={assignment.maxHours ?? 0}
                            onChange={(e) =>
                              setDraft((c) => ({
                                ...c,
                                staffing: (c.staffing || []).map((item) =>
                                  item.id === assignment.id
                                    ? {
                                        ...item,
                                        maxHours: Number(e.target.value) || 0,
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-slate-500">
                            Implied pay
                          </Label>
                          <div className="flex h-11 items-center gap-2 rounded-(--radius-input) border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                            <Coins className="h-4 w-4 text-slate-400" />$
                            {pay.toLocaleString(undefined, {
                              maximumFractionDigits: 0,
                            })}
                          </div>
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() =>
                              setDraft((c) => ({
                                ...c,
                                staffing: (c.staffing || []).filter(
                                  (item) => item.id !== assignment.id,
                                ),
                              }))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                    No staffing rows yet. Add doers, consultants, and the lead.
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() =>
                      setDraft((c) => ({
                        ...c,
                        staffing: [
                          ...(c.staffing || []),
                          createStaffingAssignment(),
                        ],
                      }))
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add row
                  </Button>
                  {overAllocatedHours && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-700">
                      <CircleAlert className="h-4 w-4" />
                      Over-allocated
                    </span>
                  )}
                </div>
              </div>
            </SectionPanel>
          )}

          {/* ── Client ── */}
          {activeTab === "Client" && (
            <SectionPanel
              title="Client & contract"
              description="Client identity, contact details, and document links."
              {...sp("client", [
                "clientName",
                "clientContactName",
                "clientContactEmail",
                "clientContactPhone",
                "proposalLink",
                "contractLink",
              ])}
            >
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FieldBlock label="Client / organization" optional>
                    <Input
                      list="project-client-suggestions"
                      value={draft.clientName || ""}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, clientName: e.target.value }))
                      }
                      placeholder="Client or organization"
                    />
                  </FieldBlock>
                  <FieldBlock label="Contact name" optional>
                    <Input
                      value={draft.clientContactName || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          clientContactName: e.target.value,
                        }))
                      }
                      placeholder="Primary contact"
                    />
                  </FieldBlock>
                  <FieldBlock label="Contact email" optional>
                    <Input
                      type="email"
                      value={draft.clientContactEmail || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          clientContactEmail: e.target.value,
                        }))
                      }
                      placeholder="contact@example.com"
                    />
                  </FieldBlock>
                  <FieldBlock label="Contact phone" optional>
                    <Input
                      value={draft.clientContactPhone || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          clientContactPhone: e.target.value,
                        }))
                      }
                      placeholder="+1 (555) 000-0000"
                    />
                  </FieldBlock>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldBlock label="Proposal link" optional>
                    <Input
                      type="url"
                      value={draft.proposalLink || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          proposalLink: e.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </FieldBlock>
                  <FieldBlock label="Contract link" optional>
                    <Input
                      type="url"
                      value={draft.contractLink || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          contractLink: e.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </FieldBlock>
                </div>
              </div>
              <datalist id="project-client-suggestions">
                {clientSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </SectionPanel>
          )}

          {/* ── Budget ── */}
          {activeTab === "Budget" && (
            <>
              <SectionPanel
                title="Budget & planning"
                description="Budget amount, hourly modeling, and delivery context."
                {...sp("budget", [
                  "budgetAmount",
                  "budgetCurrency",
                  "budgetTwd",
                  "budgetUsd",
                  "successMetric",
                  "risks",
                  "maxBillableHours",
                ])}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FieldBlock label="Budget" optional>
                    <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
                      <select
                        className={inputClassName}
                        value={budgetCurrency}
                        onChange={(e) =>
                          setDraft((c) => ({
                            ...c,
                            budgetCurrency: e.target
                              .value as ProjectBudgetCurrency,
                          }))
                        }
                      >
                        <option value="TWD">TWD</option>
                        <option value="USD">USD</option>
                      </select>
                      <Input
                        type="number"
                        min={0}
                        step={budgetCurrency === "USD" ? 0.01 : 1}
                        value={budgetAmount}
                        onChange={(e) =>
                          setDraft((c) => ({
                            ...c,
                            budgetAmount: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </FieldBlock>
                  <SummaryMetric
                    label="Perspective hours"
                    value={`${totalPerspectiveHours.toFixed(1)}h`}
                    detail="Auto-summed from all stages"
                  />
                  <SummaryMetric
                    label="Budget"
                    value={formatMoney(budgetTwd, "TWD")}
                    detail={formatMoney(budgetUsd, "USD")}
                  />
                  <SummaryMetric
                    label="Implied rate"
                    value={
                      hourlyTwd
                        ? `${formatMoney(hourlyTwd, "TWD")}/hr`
                        : "NT$0/hr"
                    }
                    detail={
                      hourlyUsd
                        ? `${formatMoney(hourlyUsd, "USD")}/hr`
                        : "Set budget & hours"
                    }
                    toneClassName="border-sky-200 bg-sky-50 text-slate-900"
                  />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <FieldBlock label="Success metric" optional>
                    <Input
                      value={draft.successMetric || ""}
                      onChange={(e) =>
                        setDraft((c) => ({
                          ...c,
                          successMetric: e.target.value,
                        }))
                      }
                      placeholder="How success will be measured"
                    />
                  </FieldBlock>
                  <FieldBlock label="Risks or blockers" optional>
                    <Input
                      value={draft.risks || ""}
                      onChange={(e) =>
                        setDraft((c) => ({ ...c, risks: e.target.value }))
                      }
                      placeholder="Known delivery risks"
                    />
                  </FieldBlock>
                </div>
              </SectionPanel>

              <SectionPanel
                title="Offerings"
                description="Workstreams or deliverables that belong to this project."
                {...sp("offerings", ["offerings"])}
              >
                <div className="grid gap-3">
                  {(draft.offerings || []).length ? (
                    draft.offerings?.map((offering) => (
                      <div
                        key={offering.id}
                        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                      >
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={offering.completed}
                            onChange={(e) =>
                              setDraft((c) => ({
                                ...c,
                                offerings: (c.offerings || []).map((item) =>
                                  item.id === offering.id
                                    ? { ...item, completed: e.target.checked }
                                    : item,
                                ),
                              }))
                            }
                          />
                          Done
                        </label>
                        <Input
                          value={offering.name}
                          onChange={(e) =>
                            setDraft((c) => ({
                              ...c,
                              offerings: (c.offerings || []).map((item) =>
                                item.id === offering.id
                                  ? { ...item, name: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          placeholder="Deliverable or service line"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() =>
                            setDraft((c) => ({
                              ...c,
                              offerings: (c.offerings || []).filter(
                                (item) => item.id !== offering.id,
                              ),
                            }))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No offerings added yet.
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit gap-1.5"
                    onClick={() =>
                      setDraft((c) => ({
                        ...c,
                        offerings: [...(c.offerings || []), createOffering()],
                      }))
                    }
                  >
                    <Plus className="h-4 w-4" />
                    Add offering
                  </Button>
                </div>
              </SectionPanel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
function FieldBlock({
  label,
  required,
  optional,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label>{label}</Label>
        {required ? (
          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] text-white">
            Required
          </span>
        ) : null}
        {optional ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            Optional
          </span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      {children}
    </div>
  );
}
