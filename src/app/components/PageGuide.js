"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver } from "driver.js";

const SEEN_INTROS_KEY = "coassembly-page-intros-v4";

const copy = (en, zh) => ({ en, zh });

const PAGE_GUIDES = {
  members: {
    title: copy("Member To-do", "成員待辦"),
    intro: copy(
      "Hi—welcome to the team’s weekly planning hub! This is where a loose piece of work becomes a named task with an owner, project, week, time estimate, deadline, and review status.",
      "嗨，歡迎來到團隊的每週工作規劃中心！在這裡，一件零散的工作會變成有負責人、專案、週次、工時估算、期限與複核狀態的明確任務。",
    ),
    outro: copy(
      "You’re ready! Start with your own card: compare worked time with planned time, then add or update the next task you intend to finish this week.",
      "準備好了！先從自己的卡片開始：比較已投入工時與原定工時，再新增或更新這週下一件要完成的任務。",
    ),
    steps: [
      {
        element: ".members-page .page-header",
        title: copy("The selected week", "目前選擇的週次"),
        description: copy(
          "The title and quarter badge tell you which weekly board you are viewing. The subtitle shows how many members are included.",
          "標題與季度標籤會顯示目前查看的週次；副標則顯示這個工作台包含幾位成員。",
        ),
        side: "bottom",
      },
      {
        element: ".members-page .projects-view-toggle",
        title: copy("Member, project, or resources", "成員、專案或資源檢視"),
        description: copy(
          "Member view shows individual workloads. Project view regroups the same week’s tasks by project. Resource view collects task links by project across every week. Available views depend on your access.",
          "「成員」檢視呈現個人工作量；「專案」檢視依專案重組同一週的任務；「資源」檢視則跨週彙整各專案的任務連結。可用檢視會依你的權限而定。",
        ),
      },
      {
        element: ".members-page .week-select",
        title: copy("Move through weekly snapshots", "切換每週工作快照"),
        description: copy(
          "Use the week menu to plan or review another week. The current and immediately previous week can be edited; older weeks stay available as read-only history.",
          "用週次選單切換規劃或回顧的時間。目前週與前一週可以編輯；更早的週次會保留為唯讀紀錄。",
        ),
      },
      {
        element: ".members-page .notepad-add-active",
        reveal: {
          trigger: ".members-page .notepad-add-trigger",
          openSelector: ".members-page .notepad-add-active",
          closeTrigger:
            ".members-page .notepad-add-active .notepad-add-actions button:last-child",
        },
        title: copy("Build a task with useful detail", "建立資訊完整的任務"),
        description: copy(
          "The task composer opens during this step. Add a title, time estimate, project, deadline, subtasks, and reference links; the tour will close it without saving when you continue.",
          "導覽會在這一步自動開啟任務表單。你可以加入標題、工時估算、專案、期限、子任務與參考連結；繼續導覽時會自動關閉，而且不會儲存。",
        ),
      },
      {
        element:
          ".members-page .member-card, .members-page .project-member-paper, .members-page .project-resources-paper",
        title: copy("Plan, complete, then review", "規劃、完成，再複核"),
        description: copy(
          "Cards show worked time versus planned time. Add an estimate, project, deadline, subtasks, and links; completed work can then be reviewed, returned, or carried to the newest week.",
          "卡片會顯示已投入工時與原定工時。你可以加入工時估算、專案、期限、子任務與連結；完成後再進行複核、退回，或移到最新週次。",
        ),
        side: "top",
      },
    ],
  },
  memberDirectory: {
    title: copy("Members", "成員名錄"),
    intro: copy(
      "Hi, worker-owner—welcome to the team directory! This is the administrative home for member identity, Google sign-in access, membership type, meeting responsibilities, and workload history.",
      "嗨，社員你好，歡迎來到成員名錄！這裡集中管理成員身分、Google 登入權限、成員類型、會議分工與工作量紀錄。",
    ),
    outro: copy(
      "You’re ready! A good first check is to confirm every active member has the correct sign-in email, timezone, member type, and current meeting role.",
      "準備好了！建議先確認每位啟用中的成員都有正確的登入信箱、時區、成員類型與目前會議分工。",
    ),
    steps: [
      {
        element: ".member-directory-page .member-form-panel",
        reveal: {
          trigger:
            ".member-directory-page .member-form-panel .section-block-actions button",
          openSelector: ".member-directory-page .member-form-panel .member-form",
        },
        title: copy("Add a member and their access", "新增成員與登入權限"),
        description: copy(
          "Expand this panel to record a member’s name, aliases, type, Google sign-in email, timezone, start date, active status, and notes.",
          "展開這個區塊，可填寫成員姓名、別名、類型、Google 登入信箱、時區、加入日期、啟用狀態與備註。",
        ),
        side: "bottom",
      },
      {
        element:
          ".member-directory-page .member-directory-top .member-directory-panel:not(.member-form-panel)",
        reveal: {
          trigger:
            ".member-directory-page .member-directory-top .member-directory-panel:not(.member-form-panel) .section-block-actions button",
          openSelector:
            ".member-directory-page .rotation-timeline, .member-directory-page .member-directory-empty",
        },
        title: copy("Rotate meeting responsibilities", "輪替會議分工"),
        description: copy(
          "The monthly rotation assigns worker-owners to facilitation, timekeeping, and notes. Use the month controls when the team needs to swap roles or attendance.",
          "每月輪值會安排社員擔任主持、計時與記錄。需要交換職務或調整出席時，可使用各月份的控制項。",
        ),
      },
      {
        element: ".member-directory-page .member-directory-card--open",
        reveal: {
          trigger:
            ".member-directory-page .member-directory-card-actions button[aria-expanded]",
          openSelector:
            ".member-directory-page .member-directory-card--open",
        },
        title: copy("Read capacity and project history", "查看工作量與專案紀錄"),
        description: copy(
          "Each member card summarizes current workload and assignments. Expand a card for weekly and overall task metrics, project history, role details, and edit controls.",
          "每張成員卡會摘要目前工作量與任務分配。展開後可查看每週及整體任務數據、專案紀錄、角色資訊與編輯控制。",
        ),
        side: "top",
      },
    ],
  },
  projects: {
    title: copy("Projects", "專案"),
    intro: copy(
      "Hi—welcome to the project control room! Each project connects delivery status with its budget, cooperative contribution, dates, staffing capacity, task hours, and projected member pay.",
      "嗨，歡迎來到專案控制室！每個專案都會把執行狀態與預算、合作社提撥、起訖日期、人力配置、任務工時及成員預估報酬串在一起。",
    ),
    outro: copy(
      "You’re ready! Open the project that needs attention and compare its remaining task hours with the team’s assigned capacity before changing the plan.",
      "準備好了！請先展開最需要關注的專案，比較剩餘任務工時與團隊已配置的可用工時，再決定是否調整計畫。",
    ),
    steps: [
      {
        element: ".projects-page .page-header",
        title: copy("Portfolio totals", "專案組合總覽"),
        description: copy(
          "The header totals active project budgets, the cooperative pool contribution, and the portion available for member compensation.",
          "頁首會彙總進行中專案的預算、合作社共同基金提撥，以及可分配給成員的預算。",
        ),
        side: "bottom",
      },
      {
        element: ".projects-page .projects-view-toggle",
        title: copy("Ledger or Kanban", "明細表或看板"),
        description: copy(
          "Ledger view is best for comparing money and hours. Kanban view regroups projects by status so you can follow the delivery pipeline.",
          "「明細表」適合比較預算與工時；「看板」則依狀態分類專案，方便追蹤執行流程。",
        ),
      },
      {
        element: ".projects-page .project-create-section",
        title: copy("Set the project rules up front", "先設定專案規則"),
        description: copy(
          "Worker-owners can define kind, status, budget and currency, cooperative contribution, dates, and internal hourly assumptions. Self-funded projects use their own funding rules.",
          "社員可設定專案類型、狀態、預算與幣別、合作社提撥、起訖日期，以及內部時薪假設。自籌專案會套用不同的資金規則。",
        ),
      },
      {
        element:
          ".projects-page .project-row--open, .projects-page .project-kanban-section",
        reveal: {
          trigger:
            ".projects-page .project-list .project-row .project-row-summary",
          openSelector: ".projects-page .project-list .project-row--open",
        },
        title: copy("Open a project for the full picture", "展開專案查看全貌"),
        description: copy(
          "Project details combine stage plans, assigned people and capacity, task burn, projected rates, self-funding, and financial totals. Completing a project closes out its active workflow.",
          "專案詳情會整合階段規劃、成員與可用工時、任務消耗、預估費率、自籌資金與財務總計。完成專案後，進行中的工作流程也會一併結案。",
        ),
        side: "top",
      },
    ],
  },
  backlog: {
    title: copy("Wishes", "願望清單"),
    intro: copy(
      "Hi—welcome to the team’s idea garden! Wishes are valuable ideas that are not scheduled commitments yet, so they can gather context, reactions, and discussion before becoming work.",
      "嗨，歡迎來到團隊的想法花園！願望是有價值、但尚未排入工作承諾的想法；它們可以先累積脈絡、回應與討論，再變成正式任務。",
    ),
    outro: copy(
      "You’re ready! Add an idea to the closest project now; only push it to the weekly board once its owner and timing are clear.",
      "準備好了！現在先把想法加入最相關的專案欄；等負責人與執行時間明確後，再推到每週工作台。",
    ),
    steps: [
      {
        element: ".backlog-page .page-header",
        title: copy("Search the idea pool", "搜尋想法池"),
        description: copy(
          "The total shows the size of the current pool. Search checks wish text across every project column.",
          "數量標籤顯示目前想法池的規模；搜尋功能會檢查所有專案欄位中的願望文字。",
        ),
        side: "bottom",
      },
      {
        element: ".backlog-page .backlog-grid",
        title: copy("Ideas stay with their context", "讓想法保留專案脈絡"),
        description: copy(
          "Wishes are grouped by project, with an Unassigned column for ideas that do not have a home yet. Add new wishes directly to the relevant column.",
          "願望會依專案分組；還沒有歸屬的想法會放在「未指派」欄。請直接在對應專案欄中新增願望。",
        ),
      },
      {
        element: ".backlog-page .backlog-add-row",
        reveal: {
          trigger: ".backlog-page .backlog-create-trigger",
          openSelector: ".backlog-page .backlog-add-row",
          closeTrigger:
            ".backlog-page .backlog-add-row button:last-child",
        },
        title: copy("Capture an idea in place", "直接在專案欄中記下想法"),
        description: copy(
          "The Add wish row opens automatically here so you can see where an unscheduled idea is captured. It closes without saving when the tour moves on.",
          "這一步會自動展開「新增願望」欄位，示範尚未排程的想法要記在哪裡。繼續導覽時會自動關閉，而且不會儲存。",
        ),
      },
      {
        element: ".backlog-page .wish-item",
        title: copy("React, discuss, then push to the board", "回應、討論，再排入工作台"),
        description: copy(
          "Reactions help surface interest, comments preserve discussion, and Push to board turns the wish into a weekly task assigned to a member.",
          "表情回應可顯示關注度，留言會保留討論脈絡；「推到工作台」則會把願望轉成指派給成員的每週任務。",
        ),
        side: "top",
      },
    ],
  },
  finance: {
    title: copy("Finance", "財務"),
    intro: copy(
      "Hi—welcome to CoAssembly’s financial picture! This page compares accountant-recorded cash flow with project forecasts so the team can understand what should be received, paid, retained, or reconciled.",
      "嗨，歡迎查看 CoAssembly 的財務全貌！這個頁面會比較會計帳上的實際現金流與專案預測，讓團隊理解應收、應付、保留與待核對的金額。",
    ),
    outro: copy(
      "You’re ready! Refresh from the accounting sheet first, resolve unmatched categories, and only then compare expected versus actual project and member payouts.",
      "準備好了！請先從會計試算表更新資料、處理未對應的分類，再比較各專案與成員的預期和實際報酬。",
    ),
    steps: [
      {
        element: ".finance-page .page-header",
        title: copy("Actual plus projected", "實際與預估並看"),
        description: copy(
          "Project plans supply the forecast; categorized spreadsheet transactions supply actual cash flow. The page keeps the two sources visibly distinct.",
          "專案規劃提供預估資料；試算表中已分類的交易則提供實際現金流。頁面會清楚區分這兩種來源。",
        ),
        side: "bottom",
      },
      {
        element: ".finance-page .finance-actions",
        title: copy("Refresh from the accounting sheet", "從會計試算表更新"),
        description: copy(
          "Open spreadsheet goes to the source data. Refresh from sheet pulls the latest categorized transactions into this dashboard.",
          "「開啟試算表」會前往原始資料；「從試算表更新」則把最新的已分類交易載入這個儀表板。",
        ),
      },
      {
        element: ".finance-page .finance-category-tabs",
        title: copy("Follow money by project or person", "依專案或成員查看金流"),
        description: copy(
          "Project view compares project-level income, cost, receivables, payables, and expected payouts. Person view follows each member’s allocation and payment picture.",
          "「依專案」會比較各專案的收入、成本、應收、應付與預估報酬；「依成員」則追蹤每位成員的分配與付款狀況。",
        ),
      },
      {
        element: ".finance-page .finance-project-list",
        title: copy("Expand rows to reconcile details", "展開列項核對細節"),
        description: copy(
          "Open a row to compare expected and actual amounts, inspect category splits and transactions, and resolve any unmatched accounting category.",
          "展開列項後，可比較預期與實際金額、查看分類與交易明細，並處理尚未對應的會計分類。",
        ),
        side: "top",
      },
    ],
  },
  payouts: {
    title: copy("Requests", "請款申請"),
    intro: copy(
      "Hi—welcome to the request desk! This page tracks money moving between a member and the cooperative, including who owes whom, the reason, amount, receipt evidence, approval, and payment.",
      "嗨，歡迎來到請款櫃台！這個頁面會追蹤成員與合作社之間的金流，包括誰需要付給誰、款項原因、金額、收據證明、核准與付款狀態。",
    ),
    outro: copy(
      "You’re ready! Before submitting, confirm the direction: choose Reimbursement when the cooperative owes you, or Repayment when you owe the cooperative.",
      "準備好了！送出前請先確認金流方向：合作社需要還款給你時選「墊付款」；你需要歸還合作社款項時選「還款」。",
    ),
    steps: [
      {
        element: ".tab-page .page-header",
        title: copy("Pending and total requests", "待處理與全部申請"),
        description: copy(
          "The header separates requests still awaiting a decision from the full request history.",
          "頁首會分別顯示仍待處理的申請數，以及完整的申請紀錄總數。",
        ),
        side: "bottom",
      },
      {
        element: ".tab-page .member-card",
        title: copy("Each person has a request ledger", "每位成員都有自己的申請紀錄"),
        description: copy(
          "Members normally see their own card; worker-owners can see the team. Receipt-style records show direction, amount, evidence, date, reference number, and status.",
          "一般成員會看到自己的卡片；社員則可查看整個團隊。收據樣式的紀錄會顯示金流方向、金額、證明、日期、編號與狀態。",
        ),
      },
      {
        element: ".tab-page .req-add-form",
        reveal: {
          trigger: ".tab-page .notepad-add-trigger",
          openSelector: ".tab-page .req-add-form",
          closeTrigger:
            ".tab-page .req-add-form .req-add-actions button:last-child",
        },
        title: copy("Choose reimbursement or repayment", "選擇墊付款或還款"),
        description: copy(
          "Reimbursement means you paid personally and the cooperative owes you; a receipt link is required. Repayment means you owe money back to the cooperative.",
          "「墊付款」表示你先代墊、合作社需要還款，並且必須附上收據連結；「還款」則表示你需要把款項歸還合作社。",
        ),
      },
      {
        element: ".tab-page .thermal, .tab-page .req-receipt-list",
        title: copy("Approval has a clear status trail", "核准流程有清楚狀態"),
        description: copy(
          "Worker-owners can approve or reject submitted requests, then mark approved requests paid. The stamped state keeps that trail visible.",
          "社員可核准或退回已送出的申請，並在付款後標記為「已支付」。收據上的狀態章會清楚保留流程紀錄。",
        ),
        side: "top",
      },
    ],
  },
  meetingNotes: {
    title: copy("Notes / doc", "筆記／文件"),
    intro: copy(
      "Hi—welcome to the team library! A note can be a collaborative document, a meeting record, or a quick external link, with project scope, roles, attendance, and live editing when needed.",
      "嗨，歡迎來到團隊資料庫！一則筆記可以是協作文件、會議紀錄或外部連結，也能依需要加入專案範圍、會議分工、出席狀況與即時編輯。",
    ),
    outro: copy(
      "You’re ready! Create a quick link for something stored elsewhere, or create a project note and assign the facilitator, timekeeper, notetaker, and attendance before the meeting starts.",
      "準備好了！外部資料可建立快速連結；若是專案會議筆記，建議在會議開始前先指定主持、計時、記錄者與出席名單。",
    ),
    steps: [
      {
        element: ".notes-page .page-header",
        title: copy("Search, group, and change the shelf", "搜尋、分組與切換排列"),
        description: copy(
          "Search covers titles and content. Group notes by date or project, then switch between cover-grid and bookshelf layouts.",
          "搜尋會涵蓋標題與內文。你可以依日期或專案分組，再切換封面格狀或書架排列。",
        ),
        side: "bottom",
      },
      {
        element: ".notes-page .note-create-section",
        title: copy("Create a note or a link shortcut", "建立筆記或連結捷徑"),
        description: copy(
          "Give the item an emoji and title. Add a URL to create a shortcut, or leave it blank to create an editable note with a scope and optional project.",
          "先選擇表情符號並填寫標題。加入網址會建立連結捷徑；不填網址則會建立可編輯筆記，並可設定可見範圍與關聯專案。",
        ),
      },
      {
        element: ".notes-page .note-roles-disclosure",
        reveal: {
          details: ".notes-page .note-roles-disclosure",
        },
        title: copy("Record meeting roles and attendance", "記錄會議分工與出席"),
        description: copy(
          "For meeting notes, assign facilitator, timekeeper, and notetaker. Project-scoped notes can also record who was present or absent.",
          "建立會議筆記時，可指定主持、計時與記錄者；若筆記屬於某個專案，也能記錄出席與缺席成員。",
        ),
      },
      {
        element: ".notes-page .notes-sections",
        title: copy("Open a document to read or edit", "開啟文件閱讀或編輯"),
        description: copy(
          "Select a note to open its detail view. Editors can work in the rich-text document with autosave while other viewers remain visible.",
          "選取筆記即可開啟詳細內容。編輯者可在富文字文件中協作，系統會自動儲存，也會顯示正在查看的其他成員。",
        ),
        side: "top",
      },
    ],
  },
  resources: {
    title: copy("Resources", "資源庫"),
    intro: copy(
      "Hi—welcome to the shared resource shelf! This is where the team keeps reusable references, tools, vendors, services, and project material so useful knowledge does not disappear inside old tasks.",
      "嗨，歡迎來到共用資源架！團隊可在這裡保存能重複使用的參考資料、工具、廠商、服務與專案素材，避免重要知識埋在舊任務裡。",
    ),
    outro: copy(
      "You’re ready! Add one resource with a clear name, a sentence explaining when to use it, the right category, and any closely related sub-links.",
      "準備好了！新增資源時，請填寫清楚的名稱、一句使用情境說明、正確分類，以及密切相關的子連結。",
    ),
    steps: [
      {
        element: ".resources-page .page-header",
        title: copy("Search or change the organization", "搜尋或切換整理方式"),
        description: copy(
          "Search checks resource names, descriptions, URLs, categories, and sub-links. Switch between grouped categories and a free-arrange board.",
          "搜尋會檢查資源名稱、說明、網址、分類與子連結。你也可以在分類檢視和自由排列看板之間切換。",
        ),
        side: "bottom",
      },
      {
        element: ".resources-page .resource-form",
        reveal: {
          trigger: ".resources-page .resource-create-trigger",
          openSelector: ".resources-page .resource-form",
          closeTrigger: ".resources-page .edit-modal-close",
        },
        title: copy("Save enough context to reuse it", "補足資訊，讓資源能再次使用"),
        description: copy(
          "Add the main URL, a clear name and description, a category, and any related sub-links so teammates know what the resource is for.",
          "請加入主要網址、清楚的名稱與說明、分類，以及相關子連結，讓其他成員知道這項資源適合用在什麼情境。",
        ),
      },
      {
        element:
          ".resources-page .resources-by-category, .resources-page .resources-free-board",
        title: copy("Browse by category or arrange spatially", "依分類瀏覽或自由排列"),
        description: copy(
          "Category view builds a tidy shared directory. Free-arrange view lets you drag cards into a layout that is remembered in this browser.",
          "分類檢視會建立整齊的共用目錄；自由排列檢視則可拖曳卡片，並在這個瀏覽器中記住版面位置。",
        ),
      },
      {
        element: ".resources-page .resource-sticky",
        title: copy("Open, edit, or expand a resource", "開啟、編輯或延伸資源"),
        description: copy(
          "A resource card links to its main destination and any sub-links. Use its controls when the description, category, or destination changes.",
          "資源卡會連到主要網址與所有子連結。當說明、分類或目的地改變時，可使用卡片上的控制項更新內容。",
        ),
        side: "top",
      },
    ],
  },
};

function bilingualTitle(value) {
  return `<span class="page-guide-title-en" lang="en">${value.en}</span><span class="page-guide-title-zh" lang="zh-Hant-TW">${value.zh}</span>`;
}

function bilingualDescription(value) {
  return `<span class="page-guide-copy-en" lang="en">${value.en}</span><span class="page-guide-copy-divider" aria-hidden="true"></span><span class="page-guide-copy-zh" lang="zh-Hant-TW">${value.zh}</span>`;
}

function readSeenIntros() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SEEN_INTROS_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function markIntroSeen(tabKey) {
  try {
    const seen = readSeenIntros();
    window.localStorage.setItem(
      SEEN_INTROS_KEY,
      JSON.stringify({ ...seen, [tabKey]: true }),
    );
  } catch {
    // A blocked localStorage should not prevent the guide from working.
  }
}

function stepIsAvailable(step) {
  if (!step.element) return true;
  if (document.querySelector(step.element)) return true;
  if (step.reveal?.details) {
    return Boolean(document.querySelector(step.reveal.details));
  }
  return Boolean(
    step.reveal?.trigger && document.querySelector(step.reveal.trigger),
  );
}

function prepareReveal(step, stepIndex, cleanupByStep) {
  const reveal = step.reveal;
  if (!reveal || cleanupByStep.has(stepIndex)) return;

  if (reveal.details) {
    const details = document.querySelector(reveal.details);
    if (!(details instanceof HTMLDetailsElement) || details.open) return;
    details.open = true;
    cleanupByStep.set(stepIndex, () => {
      if (details.isConnected) details.open = false;
    });
    return;
  }

  if (!reveal.trigger) return;
  const isAlreadyOpen = reveal.openSelector
    ? Boolean(document.querySelector(reveal.openSelector))
    : false;
  if (isAlreadyOpen) return;

  const trigger = document.querySelector(reveal.trigger);
  if (!(trigger instanceof HTMLElement)) return;
  trigger.click();

  cleanupByStep.set(stepIndex, () => {
    const closeTarget = document.querySelector(
      reveal.closeTrigger || reveal.trigger,
    );
    if (closeTarget instanceof HTMLElement) closeTarget.click();
  });
}

function createTour(guide) {
  const definitions = [
    {
      title: copy(
        `Welcome to ${guide.title.en}`,
        `歡迎來到「${guide.title.zh}」`,
      ),
      description: guide.intro,
    },
    ...guide.steps.filter(stepIsAvailable),
    {
      title: copy("You’re ready!", "準備好了！"),
      description: guide.outro,
    },
  ];
  const cleanupByStep = new Map();
  const pendingTimers = new Set();

  function cleanupStep(stepIndex) {
    const cleanup = cleanupByStep.get(stepIndex);
    cleanup?.();
    cleanupByStep.delete(stepIndex);
  }

  function cleanupAll() {
    pendingTimers.forEach((timer) => window.clearTimeout(timer));
    pendingTimers.clear();
    [...cleanupByStep.keys()].forEach(cleanupStep);
  }

  function moveTo(driverInstance, currentIndex, nextIndex) {
    cleanupStep(currentIndex);
    if (!definitions[nextIndex]) {
      driverInstance.destroy();
      return;
    }

    prepareReveal(definitions[nextIndex], nextIndex, cleanupByStep);
    const timer = window.setTimeout(() => {
      pendingTimers.delete(timer);
      driverInstance.moveTo(nextIndex);
    }, 90);
    pendingTimers.add(timer);
  }

  const steps = definitions.map((step, stepIndex) => ({
    ...(step.element
      ? { element: () => document.querySelector(step.element) }
      : {}),
    popover: {
      title: bilingualTitle(step.title),
      description: bilingualDescription(step.description),
      side: step.side || "left",
      align: step.align || "start",
      onNextClick: (_element, _step, { driver: driverInstance }) =>
        moveTo(driverInstance, stepIndex, stepIndex + 1),
      onPrevClick: (_element, _step, { driver: driverInstance }) =>
        moveTo(driverInstance, stepIndex, stepIndex - 1),
      onCloseClick: (_element, _step, { driver: driverInstance }) =>
        driverInstance.destroy(),
    },
  }));

  return { steps, cleanupAll };
}

export default function PageGuide({ tabKey }) {
  const activeDriverRef = useRef(null);
  const guide = PAGE_GUIDES[tabKey];

  const startTour = useCallback(() => {
    if (!guide) return;

    activeDriverRef.current?.destroy();
    const tour = createTour(guide);

    const pageDriver = driver({
      animate: true,
      allowClose: true,
      overlayColor: "#2d241f",
      overlayOpacity: 0.55,
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      nextBtnText: "Next 下一步",
      prevBtnText: "Back 上一步",
      doneBtnText: "Done 完成",
      progressText: "{{current}} / {{total}}",
      popoverClass: "coassembly-driver-popover",
      stagePadding: 10,
      stageRadius: 14,
      steps: tour.steps,
      onDestroyed: () => {
        tour.cleanupAll();
        markIntroSeen(tabKey);
        if (activeDriverRef.current === pageDriver) {
          activeDriverRef.current = null;
        }
      },
    });

    activeDriverRef.current = pageDriver;
    pageDriver.drive();
  }, [guide, tabKey]);

  useEffect(() => {
    if (!guide || readSeenIntros()[tabKey]) return undefined;

    const timer = window.setTimeout(startTour, 700);
    return () => window.clearTimeout(timer);
  }, [guide, startTour, tabKey]);

  useEffect(
    () => () => {
      activeDriverRef.current?.destroy();
      activeDriverRef.current = null;
    },
    [],
  );

  if (!guide) return null;

  const replayLabel = `Replay the ${guide.title.en} introduction／重新播放${guide.title.zh}導覽`;

  return (
    <button
      type="button"
      className="page-guide-avatar"
      onClick={startTour}
      aria-label={replayLabel}
      title={replayLabel}
    >
      <span className="page-guide-face" aria-hidden="true">
        <span className="page-guide-eye page-guide-eye--left" />
        <span className="page-guide-eye page-guide-eye--right" />
        <span className="page-guide-smile" />
      </span>
      <span className="page-guide-badge" aria-hidden="true">
        ?
      </span>
    </button>
  );
}
