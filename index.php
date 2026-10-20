<?php
declare(strict_types=1);

$assetVersion = static function (string $path): int {
    $full = __DIR__ . DIRECTORY_SEPARATOR . $path;
    $mtime = @filemtime($full);

    return $mtime === false ? 1 : $mtime;
};
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="A simple task tracker for the CSITS Organization.">
    <meta name="theme-color" content="#4f46e5">
    <title>CSITS Task Tracker</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234f46e5'/%3E%3Cpath d='M9 16.5l4.5 4.5L23 11' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E">
    <link rel="stylesheet" href="assets/style.css?v=<?= $assetVersion('assets/style.css') ?>">
    <script src="assets/app.js?v=<?= $assetVersion('assets/app.js') ?>" defer></script>
</head>
<body>
    <div class="app">
        <header class="topbar">
            <div class="brand">
                <span class="brand__mark" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12.5l4.2 4.2L19 7"></path>
                    </svg>
                </span>
                <div class="brand__text">
                    <p class="brand__eyebrow">CSITS Organization</p>
                    <h1 class="brand__title">Task Tracker</h1>
                </div>
            </div>

            <div class="topbar__right">
                <p class="topbar__date" id="todayLabel"></p>

                <div class="view-switch" role="group" aria-label="Choose task view">
                    <button type="button" class="view-switch__btn" id="boardViewBtn" data-view="board" aria-pressed="true">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                            <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                            <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                            <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                        </svg>
                        Board
                    </button>
                    <button type="button" class="view-switch__btn" id="calendarViewBtn" data-view="calendar" aria-pressed="false">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <rect x="3" y="4.5" width="18" height="16.5" rx="2"></rect>
                            <path d="M8 2.5v4M16 2.5v4M3 9.5h18"></path>
                        </svg>
                        Calendar
                    </button>
                </div>

                <button type="button" class="btn btn-primary" id="newTaskBtn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14"></path>
                    </svg>
                    New task
                </button>
            </div>
        </header>

        <section class="stats" aria-label="Task summary">
            <article class="stat stat--total">
                <span class="stat__label">Total tasks</span>
                <strong class="stat__value" id="statTotal">0</strong>
                <span class="stat__note">Everything on the board</span>
            </article>
            <article class="stat stat--todo">
                <span class="stat__label">To do</span>
                <strong class="stat__value" id="statTodo">0</strong>
                <span class="stat__note">Not started yet</span>
            </article>
            <article class="stat stat--progress">
                <span class="stat__label">In progress</span>
                <strong class="stat__value" id="statProgress">0</strong>
                <span class="stat__note">Currently being worked on</span>
            </article>
            <article class="stat stat--done">
                <span class="stat__label">Completed</span>
                <strong class="stat__value" id="statDone">0</strong>
                <span class="stat__note">Wrapped up</span>
            </article>
            <article class="stat stat--overdue">
                <span class="stat__label">Overdue</span>
                <strong class="stat__value" id="statOverdue">0</strong>
                <span class="stat__note">Past the due date</span>
            </article>
        </section>

        <section class="toolbar" aria-label="Search, filter, and sort tasks">
            <div class="search">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7"></circle>
                    <path d="M20 20l-3.4-3.4"></path>
                </svg>
                <label class="sr-only" for="searchInput">Search tasks</label>
                <input type="search" id="searchInput" placeholder="Search title, assignee, or notes..." autocomplete="off">
            </div>

            <div class="filters" id="statusFilters" role="group" aria-label="Filter by status">
                <button type="button" class="chip" data-status="all" aria-pressed="true">
                    All <span class="chip__count" data-count="total">0</span>
                </button>
                <button type="button" class="chip" data-status="todo" aria-pressed="false">
                    To Do <span class="chip__count" data-count="todo">0</span>
                </button>
                <button type="button" class="chip" data-status="in_progress" aria-pressed="false">
                    In Progress <span class="chip__count" data-count="in_progress">0</span>
                </button>
                <button type="button" class="chip" data-status="completed" aria-pressed="false">
                    Completed <span class="chip__count" data-count="completed">0</span>
                </button>
            </div>

            <div class="sort">
                <label for="sortSelect">Sort</label>
                <select id="sortSelect">
                    <option value="due">Due date</option>
                    <option value="priority">Priority</option>
                    <option value="created">Newest</option>
                    <option value="title">Title A-Z</option>
                </select>
            </div>
        </section>

        <section class="task-grid" id="taskGrid" aria-live="polite" aria-busy="true"></section>

        <section class="calendar-view" id="calendarView" hidden aria-label="Calendar view">
            <div class="calendar-card" id="calendarCard">
                <header class="calendar-head">
                    <div>
                        <h2 class="calendar-title" id="calendarMonth">Calendar</h2>
                        <p class="calendar-subtitle" id="calendarSubtitle">Loading tasks...</p>
                    </div>
                    <div class="calendar-nav">
                        <button type="button" class="icon-btn calendar-nav__btn" id="calendarPrev" aria-label="Previous month">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M15 5l-7 7 7 7"></path>
                            </svg>
                        </button>
                        <button type="button" class="btn btn-ghost calendar-today" id="calendarToday">Today</button>
                        <button type="button" class="icon-btn calendar-nav__btn" id="calendarNext" aria-label="Next month">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M9 5l7 7-7 7"></path>
                            </svg>
                        </button>
                    </div>
                </header>

                <div class="calendar-scroll">
                    <div class="calendar-month">
                        <div class="calendar-weekdays" aria-hidden="true">
                            <span>Sun</span>
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                            <span>Fri</span>
                            <span>Sat</span>
                        </div>
                        <div class="calendar-grid" id="calendarGrid" role="group" aria-label="Tasks by due date"></div>
                    </div>
                </div>

                <footer class="calendar-legend">
                    <span><i class="legend-dot legend-dot--todo" aria-hidden="true"></i>To Do</span>
                    <span><i class="legend-dot legend-dot--progress" aria-hidden="true"></i>In Progress</span>
                    <span><i class="legend-dot legend-dot--done" aria-hidden="true"></i>Completed</span>
                    <span class="calendar-hint">Titles only &mdash; select a task to edit</span>
                </footer>
            </div>
        </section>

        <section class="empty" id="emptyState" hidden>
            <span class="empty__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="5" y="4" width="14" height="17" rx="2"></rect>
                    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6M9 18h3"></path>
                </svg>
            </span>
            <h2 class="empty__title" id="emptyTitle">No tasks yet</h2>
            <button type="button" class="btn btn-primary" id="emptyAction">New task</button>
        </section>

        <noscript>
            <p class="noscript">This tracker needs JavaScript enabled to load and manage tasks.</p>
        </noscript>
    </div>

    <dialog id="taskDialog" class="modal" aria-labelledby="taskDialogTitle">
        <form id="taskForm" novalidate>
            <header class="modal__head">
                <div>
                    <p class="eyebrow" id="taskDialogEyebrow">Create a task</p>
                    <h2 id="taskDialogTitle">New task</h2>
                </div>
                <button type="button" class="icon-btn" data-close-dialog aria-label="Close dialog">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18"></path>
                    </svg>
                </button>
            </header>

            <div class="modal__body">
                <div class="form-alert" id="formAlert" role="alert" hidden></div>

                <div class="field field--full">
                    <label for="title">Task title <span class="req" aria-hidden="true">*</span></label>
                    <input type="text" id="title" name="title" maxlength="120" placeholder="e.g. Finalize general assembly deck" autocomplete="off" aria-describedby="titleError" required>
                    <p class="field-error" id="titleError" data-error-for="title"></p>
                </div>

                <div class="field field--full">
                    <label for="assignee">Assign to <span class="req" aria-hidden="true">*</span></label>
                    <input type="text" id="assignee" name="assignee" maxlength="200" placeholder="e.g. Mika Reyes, Ari Santos" list="assigneeList" autocomplete="off" aria-describedby="assigneeHint assigneeError" required>
                    <datalist id="assigneeList"></datalist>
                    <p class="field-hint" id="assigneeHint">Separate multiple names with commas.</p>
                    <p class="field-error" id="assigneeError" data-error-for="assignee"></p>
                </div>

                <div class="field">
                    <label for="due_date">Due date <span class="req" aria-hidden="true">*</span></label>
                    <input type="date" id="due_date" name="due_date" aria-describedby="dueDateError" required>
                    <p class="field-error" id="dueDateError" data-error-for="due_date"></p>
                </div>

                <div class="field">
                    <label for="priority">Priority</label>
                    <select id="priority" name="priority" aria-describedby="priorityError">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                    <p class="field-error" id="priorityError" data-error-for="priority"></p>
                </div>

                <fieldset class="field field--status field--full">
                    <legend>Status</legend>
                    <div class="status-choices">
                        <label class="status-option status-option--todo">
                            <input type="radio" name="status" value="todo" checked aria-describedby="statusError">
                            <span class="status-option__face">
                                <span class="status-dot" aria-hidden="true"></span>
                                To Do
                            </span>
                        </label>
                        <label class="status-option status-option--in_progress">
                            <input type="radio" name="status" value="in_progress" aria-describedby="statusError">
                            <span class="status-option__face">
                                <span class="status-dot" aria-hidden="true"></span>
                                In Progress
                            </span>
                        </label>
                        <label class="status-option status-option--completed">
                            <input type="radio" name="status" value="completed" aria-describedby="statusError">
                            <span class="status-option__face">
                                <span class="status-dot" aria-hidden="true"></span>
                                Completed
                            </span>
                        </label>
                    </div>
                    <p class="field-error" id="statusError" data-error-for="status"></p>
                </fieldset>

                <div class="field field--full">
                    <label for="description">Description <span class="optional">(optional)</span></label>
                    <textarea id="description" name="description" rows="3" maxlength="700" placeholder="Add context, links, or acceptance criteria..." aria-describedby="descriptionError"></textarea>
                    <p class="field-error" id="descriptionError" data-error-for="description"></p>
                </div>
            </div>

            <footer class="modal__foot">
                <button type="button" class="btn btn-ghost" data-close-dialog>Cancel</button>
                <button type="submit" class="btn btn-primary" id="saveTaskBtn">Create task</button>
            </footer>
        </form>
    </dialog>

    <dialog id="confirmDialog" class="modal modal--sm" aria-labelledby="confirmTitle">
        <header class="modal__head">
            <div>
                <p class="eyebrow">Confirm deletion</p>
                <h2 id="confirmTitle">Delete this task?</h2>
            </div>
            <button type="button" class="icon-btn" data-close-dialog aria-label="Close dialog">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18"></path>
                </svg>
            </button>
        </header>

        <div class="modal__body">
            <p class="confirm-text" id="confirmText"></p>
        </div>

        <footer class="modal__foot">
            <button type="button" class="btn btn-ghost" data-close-dialog>Cancel</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete task</button>
        </footer>
    </dialog>

    <div class="toasts" id="toasts" aria-live="polite" aria-atomic="false"></div>
</body>
</html>
