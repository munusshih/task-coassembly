"use client";

import { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, inputClassName } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProjectOffering } from "@/lib/types";

const USD_TO_TWD = 32;

function createOffering(name = ""): ProjectOffering {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    completed: false,
  };
}

interface ProjectFormPanelProps {
  memberOptions: Array<{ label: string; value: string }>;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  projectPurpose: string;
  onProjectPurposeChange: (value: string) => void;
  projectDescription: string;
  onProjectDescriptionChange: (value: string) => void;
  projectClientName: string;
  onProjectClientNameChange: (value: string) => void;
  projectClientContactName: string;
  onProjectClientContactNameChange: (value: string) => void;
  projectClientContactEmail: string;
  onProjectClientContactEmailChange: (value: string) => void;
  projectClientContactPhone: string;
  onProjectClientContactPhoneChange: (value: string) => void;
  projectProposalLink: string;
  onProjectProposalLinkChange: (value: string) => void;
  projectContractLink: string;
  onProjectContractLinkChange: (value: string) => void;
  projectType: string;
  onProjectTypeChange: (value: string) => void;
  projectStage: "discovery" | "design" | "delivery" | "support";
  onProjectStageChange: (
    value: "discovery" | "design" | "delivery" | "support",
  ) => void;
  projectPriority: "low" | "medium" | "high";
  onProjectPriorityChange: (value: "low" | "medium" | "high") => void;
  projectStartDate: string;
  onProjectStartDateChange: (value: string) => void;
  projectDueDate: string;
  onProjectDueDateChange: (value: string) => void;
  projectTimelineSummary: string;
  onProjectTimelineSummaryChange: (value: string) => void;
  projectBudgetUsd: number;
  onProjectBudgetUsdChange: (value: number) => void;
  projectLeadId: string;
  onProjectLeadIdChange: (value: string) => void;
  projectSuccessMetric: string;
  onProjectSuccessMetricChange: (value: string) => void;
  projectRisks: string;
  onProjectRisksChange: (value: string) => void;
  projectMaxBillableHours: number;
  onProjectMaxBillableHoursChange: (value: number) => void;
  projectOfferings: ProjectOffering[];
  onProjectOfferingsChange: (value: ProjectOffering[]) => void;
  projectCollaborators: number;
  onProjectCollaboratorsChange: (value: number) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ProjectFormPanel({
  memberOptions,
  projectName,
  onProjectNameChange,
  projectPurpose,
  onProjectPurposeChange,
  projectDescription,
  onProjectDescriptionChange,
  projectClientName,
  onProjectClientNameChange,
  projectClientContactName,
  onProjectClientContactNameChange,
  projectClientContactEmail,
  onProjectClientContactEmailChange,
  projectClientContactPhone,
  onProjectClientContactPhoneChange,
  projectProposalLink,
  onProjectProposalLinkChange,
  projectContractLink,
  onProjectContractLinkChange,
  projectType,
  onProjectTypeChange,
  projectStage,
  onProjectStageChange,
  projectPriority,
  onProjectPriorityChange,
  projectStartDate,
  onProjectStartDateChange,
  projectDueDate,
  onProjectDueDateChange,
  projectTimelineSummary,
  onProjectTimelineSummaryChange,
  projectBudgetUsd,
  onProjectBudgetUsdChange,
  projectLeadId,
  onProjectLeadIdChange,
  projectSuccessMetric,
  onProjectSuccessMetricChange,
  projectRisks,
  onProjectRisksChange,
  projectMaxBillableHours,
  onProjectMaxBillableHoursChange,
  projectOfferings,
  onProjectOfferingsChange,
  projectCollaborators,
  onProjectCollaboratorsChange,
  onSubmit,
}: ProjectFormPanelProps) {
  const budgetTwd = Math.round((Number(projectBudgetUsd) || 0) * USD_TO_TWD);
  const hourlyUsd =
    Number(projectMaxBillableHours) > 0
      ? (Number(projectBudgetUsd) || 0) / Number(projectMaxBillableHours)
      : 0;
  const hourlyTwd = Math.round(hourlyUsd * USD_TO_TWD);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create project</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Project name"
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              required
            />
            <Input
              placeholder="Client / organization"
              value={projectClientName}
              onChange={(event) =>
                onProjectClientNameChange(event.target.value)
              }
            />
            <Input
              placeholder="Project type"
              value={projectType}
              onChange={(event) => onProjectTypeChange(event.target.value)}
            />
            <select
              className={inputClassName}
              value={projectLeadId}
              onChange={(event) => onProjectLeadIdChange(event.target.value)}
            >
              <option value="">Select lead</option>
              {memberOptions.map((member) => (
                <option key={member.value} value={member.value}>
                  {member.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Client contact name"
              value={projectClientContactName}
              onChange={(event) =>
                onProjectClientContactNameChange(event.target.value)
              }
            />
            <Input
              placeholder="Client contact email"
              type="email"
              value={projectClientContactEmail}
              onChange={(event) =>
                onProjectClientContactEmailChange(event.target.value)
              }
            />
            <Input
              placeholder="Client contact phone"
              value={projectClientContactPhone}
              onChange={(event) =>
                onProjectClientContactPhoneChange(event.target.value)
              }
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Proposal link"
              type="url"
              value={projectProposalLink}
              onChange={(event) =>
                onProjectProposalLinkChange(event.target.value)
              }
            />
            <Input
              placeholder="Contract link"
              type="url"
              value={projectContractLink}
              onChange={(event) =>
                onProjectContractLinkChange(event.target.value)
              }
            />
          </div>

          <Textarea
            rows={2}
            placeholder="What is this project about?"
            value={projectPurpose}
            onChange={(event) => onProjectPurposeChange(event.target.value)}
            required
          />

          <Textarea
            rows={2}
            placeholder="Working scope or delivery notes"
            value={projectDescription}
            onChange={(event) => onProjectDescriptionChange(event.target.value)}
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              className={inputClassName}
              value={projectStage}
              onChange={(event) =>
                onProjectStageChange(
                  event.target.value as
                    | "discovery"
                    | "design"
                    | "delivery"
                    | "support",
                )
              }
            >
              <option value="discovery">Discovery</option>
              <option value="design">Design</option>
              <option value="delivery">Delivery</option>
              <option value="support">Support</option>
            </select>
            <select
              className={inputClassName}
              value={projectPriority}
              onChange={(event) =>
                onProjectPriorityChange(
                  event.target.value as "low" | "medium" | "high",
                )
              }
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <Input
              type="date"
              value={projectStartDate}
              onChange={(event) => onProjectStartDateChange(event.target.value)}
            />
            <Input
              type="date"
              value={projectDueDate}
              onChange={(event) => onProjectDueDateChange(event.target.value)}
            />
            <Input
              type="number"
              min={0}
              value={projectCollaborators}
              onChange={(event) =>
                onProjectCollaboratorsChange(Number(event.target.value) || 0)
              }
              placeholder="Collaborator count"
            />
          </div>

          <Textarea
            rows={2}
            placeholder="Timeline summary or milestone notes"
            value={projectTimelineSummary}
            onChange={(event) =>
              onProjectTimelineSummaryChange(event.target.value)
            }
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              type="number"
              min={0}
              placeholder="Budget (USD)"
              value={projectBudgetUsd}
              onChange={(event) =>
                onProjectBudgetUsdChange(Number(event.target.value) || 0)
              }
            />
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="Max billable hours"
              value={projectMaxBillableHours}
              onChange={(event) =>
                onProjectMaxBillableHoursChange(Number(event.target.value) || 0)
              }
            />
            <Input
              value={hourlyUsd ? hourlyUsd.toFixed(2) : ""}
              placeholder="Hourly rate (USD)"
              readOnly
            />
            <Input
              value={hourlyTwd ? String(hourlyTwd) : ""}
              placeholder="Hourly rate (TWD)"
              readOnly
            />
          </div>

          <p className="text-sm text-slate-500">
            Budget snapshot: ${Number(projectBudgetUsd || 0).toLocaleString()}{" "}
            USD · NT$
            {budgetTwd.toLocaleString()} TWD
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Success metric"
              value={projectSuccessMetric}
              onChange={(event) =>
                onProjectSuccessMetricChange(event.target.value)
              }
            />
            <Input
              placeholder="Risks or blockers"
              value={projectRisks}
              onChange={(event) => onProjectRisksChange(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">
                Other offerings
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onProjectOfferingsChange([
                    ...projectOfferings,
                    createOffering(),
                  ])
                }
              >
                Add offering
              </Button>
            </div>
            <div className="grid gap-2">
              {projectOfferings.map((offering) => (
                <div key={offering.id} className="flex gap-2">
                  <Input
                    placeholder="Offering or workstream"
                    value={offering.name}
                    onChange={(event) =>
                      onProjectOfferingsChange(
                        projectOfferings.map((item) =>
                          item.id === offering.id
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      onProjectOfferingsChange(
                        projectOfferings.filter(
                          (item) => item.id !== offering.id,
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-fit">
            Save project
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
