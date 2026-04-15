"use client";

import { FormEvent } from "react";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, inputClassName } from "@/components/ui/input";
import { KanbanCard, KanbanColumn, Member, Project } from "@/lib/types";

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

  return (
    <section className="grid gap-5">
      <div className="grid gap-2 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Project to-dos
            </h2>
            <p className="text-sm text-slate-500">
              {selectedProject.purpose || "Purpose not set yet."}
            </p>
          </div>
          {selectedProject.timelineSummary ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {selectedProject.timelineSummary}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Lead: {roleName(selectedProject.leadId, members)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1">
            Collaborators: {selectedProject.collaboratorCount}
          </span>
          {selectedProject.offerings?.length ? (
            <span className="rounded-full bg-slate-100 px-3 py-1">
              Offerings: {completedOfferings.length}/
              {selectedProject.offerings.length}
            </span>
          ) : null}
        </div>
      </div>

      <form
        className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_150px_150px_100px]"
        onSubmit={onSubmitCard}
      >
        <Input
          value={cardTitle}
          onChange={(event) => onCardTitleChange(event.target.value)}
          placeholder="Add project to-do"
          required
        />
        <Input
          value={cardDescription}
          onChange={(event) => onCardDescriptionChange(event.target.value)}
          placeholder="Details or handoff context"
        />
        <select
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
        <select
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
        <Button type="submit" className="gap-2">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>

      <div className="grid gap-2">
        {projectCards.length ? (
          projectCards.map((card) => (
            <div
              key={card.id}
              className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 md:grid-cols-[minmax(0,2fr)_150px_150px_140px] md:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {card.title}
                </p>
                {card.description ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {card.description}
                  </p>
                ) : null}
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
                className="justify-between rounded-xl border border-slate-200 px-3 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                disabled={!card.ownerId}
                onClick={() => onSendToTaskBoard(card)}
              >
                Send to board
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            No project to-dos yet.
          </div>
        )}
      </div>
    </section>
  );
}
