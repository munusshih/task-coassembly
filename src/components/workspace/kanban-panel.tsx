"use client";

import { FormEvent } from "react";
import { ArrowRight, CalendarDays, Coins, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KanbanCard, KanbanColumn, Member, Project } from "@/lib/types";
import { formatMoney, getBudgetSnapshot } from "@/lib/utils";

interface KanbanPanelProps {
  selectedProject: Project;
  members: Member[];
  columns: KanbanColumn[];
  cardTitle: string;
  onCardTitleChange: (value: string) => void;
  cardDescription: string;
  onCardDescriptionChange: (value: string) => void;
  cardColumn: KanbanColumn;
  onCardColumnChange: (value: KanbanColumn) => void;
  cardOwnerId: string;
  onCardOwnerChange: (value: string) => void;
  projectCards: KanbanCard[];
  onSubmitCard: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateCard: (
    cardId: string,
    payload: Partial<Omit<KanbanCard, "id">>,
  ) => void;
  onSendToTaskBoard: (card: KanbanCard) => void;
  roleName: (id: string | undefined, members: Member[]) => string;
}

function formatProjectTypeLabel(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function KanbanPanel({
  selectedProject,
  members,
  columns,
  cardTitle,
  onCardTitleChange,
  cardDescription,
  onCardDescriptionChange,
  cardColumn,
  onCardColumnChange,
  cardOwnerId,
  onCardOwnerChange,
  projectCards,
  onSubmitCard,
  onUpdateCard,
  onSendToTaskBoard,
  roleName,
}: KanbanPanelProps) {
  const completedOfferings = (selectedProject.offerings || []).filter(
    (offering) => offering.completed,
  );
  const staffing = (selectedProject.staffing || []).filter(
    (assignment) => assignment.memberId,
  );
  const staffedPeople = new Set(
    staffing.map((assignment) => assignment.memberId),
  ).size;
  const budget = getBudgetSnapshot(selectedProject);
  const maxBillableHours = Number(selectedProject.maxBillableHours) || 0;
  const hourlyTwd =
    maxBillableHours > 0 ? budget.budgetTwd / maxBillableHours : 0;
  const hourlyUsd =
    maxBillableHours > 0 ? budget.budgetUsd / maxBillableHours : 0;
  const projectTypes = selectedProject.projectTypes?.length
    ? selectedProject.projectTypes
    : String(selectedProject.projectType || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
  const engagementLabels: Record<
    NonNullable<Project["engagementType"]>,
    string
  > = {
    commissioned: "Commissioned Work",
    selfFunded: "Self-funded Project",
    grant: "Grant Project",
    passThrough: "Pass-through Work",
  };
  const engagementLabel = selectedProject.engagementType
    ? engagementLabels[selectedProject.engagementType]
    : null;

  return (
    <section className="panel kanban">
      <div className="kanban__header">
        <div className="kanban__title-row">
          <div>
            <h2 className="t-h3">Project to-dos</h2>
            <p className="t-b2" style={{ color: "var(--c-ink-2)" }}>
              {selectedProject.purpose || "Purpose not set yet."}
            </p>
            {selectedProject.clientName ? (
              <p className="t-b2" style={{ color: "var(--c-ink-2)" }}>
                Client / org: {selectedProject.clientName}
              </p>
            ) : null}
          </div>
          {selectedProject.timelineSummary ? (
            <p className="tag">
              <CalendarDays className="icon-sm" />
              {selectedProject.timelineSummary}
            </p>
          ) : null}
        </div>

        <div className="kanban__project-meta">
          {engagementLabel ? (
            <span className="tag tag--accent">{engagementLabel}</span>
          ) : null}
          {projectTypes.slice(0, 3).map((typeValue) => (
            <span key={typeValue} className="tag">
              {formatProjectTypeLabel(typeValue)}
            </span>
          ))}
          <span className="tag">
            Lead: {roleName(selectedProject.leadId, members)}
          </span>
          <span className="tag">
            <Users className="icon-xs" />
            Team: {staffedPeople || selectedProject.collaboratorCount || 0}
          </span>
          {selectedProject.offerings?.length ? (
            <span className="tag">
              Offerings: {completedOfferings.length}/
              {selectedProject.offerings.length}
            </span>
          ) : null}
          {hourlyTwd ? (
            <span className="tag tag--accent">
              <Coins className="icon-xs" />
              {formatMoney(hourlyTwd, "TWD")}/hr
            </span>
          ) : null}
        </div>
      </div>

      <form className="kanban-form" onSubmit={onSubmitCard}>
        <div className="field">
          <Label htmlFor="project-card-title">To-do title</Label>
          <Input
            id="project-card-title"
            value={cardTitle}
            onChange={(event) => onCardTitleChange(event.target.value)}
            placeholder="Add project to-do"
            required
          />
        </div>
        <div className="field">
          <Label htmlFor="project-card-description">Context</Label>
          <Input
            id="project-card-description"
            value={cardDescription}
            onChange={(event) => onCardDescriptionChange(event.target.value)}
            placeholder="Details or handoff context"
          />
        </div>
        <div className="field">
          <Label htmlFor="project-card-column">Stage</Label>
          <select
            id="project-card-column"
            className={inputClassName}
            value={cardColumn}
            onChange={(event) =>
              onCardColumnChange(event.target.value as KanbanColumn)
            }
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <Label htmlFor="project-card-owner">Owner</Label>
          <select
            id="project-card-owner"
            className={inputClassName}
            value={cardOwnerId}
            onChange={(event) => onCardOwnerChange(event.target.value)}
          >
            <option value="">No owner yet</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <Label>&nbsp;</Label>
          <Button type="submit">
            <Plus className="icon-sm" />
            Add
          </Button>
        </div>
      </form>

      <div className="kanban-rows">
        {projectCards.length ? (
          projectCards.map((card) => (
            <div key={card.id} className="kanban-row">
              <div className="kanban-row__body">
                <div className="kanban-row__info">
                  <p>{card.title}</p>
                  {card.description ? <p>{card.description}</p> : null}
                </div>

                <select
                  className={inputClassName}
                  value={card.column}
                  onChange={(event) =>
                    onUpdateCard(card.id, {
                      column: event.target.value as KanbanColumn,
                    })
                  }
                >
                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>

                <select
                  className={inputClassName}
                  value={card.ownerId || ""}
                  onChange={(event) =>
                    onUpdateCard(card.id, {
                      ownerId: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">No owner yet</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={!card.ownerId}
                  onClick={() => onSendToTaskBoard(card)}
                >
                  Send to board
                  <ArrowRight className="icon-sm" />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">
            No project to-dos yet. Add one above to start planning work for this
            project.
          </div>
        )}
      </div>
    </section>
  );
}
