(() => {
    'use strict';

    const API_URL = 'api.php';
    const STATUS_VALUES = ['todo', 'in_progress', 'completed'];
    const STATUS_LABELS = {
        todo: 'To Do',
        in_progress: 'In Progress',
        completed: 'Completed',
    };
    const PRIORITY_VALUES = ['low', 'medium', 'high'];
    const NAME_PATTERN = /^[\p{L}][\p{L}\p{M}\s.'-]*$/u;
    const ASSIGNEE_MAX = 200;
    const ASSIGNEE_NAME_MIN = 2;
    const ASSIGNEE_NAME_MAX = 60;
    const VIEW_KEY = 'csits.taskView';

    const ICONS = {
        pencil: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>',
        trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>',
        calendar: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>',
    };

    const ui = {
        today: document.getElementById('todayLabel'),
        newTaskBtn: document.getElementById('newTaskBtn'),
        grid: document.getElementById('taskGrid'),
        empty: document.getElementById('emptyState'),
        emptyTitle: document.getElementById('emptyTitle'),
        emptyAction: document.getElementById('emptyAction'),
        filters: document.getElementById('statusFilters'),
        search: document.getElementById('searchInput'),
        sort: document.getElementById('sortSelect'),
        viewBoardBtn: document.getElementById('boardViewBtn'),
        viewCalendarBtn: document.getElementById('calendarViewBtn'),
        calendarView: document.getElementById('calendarView'),
        calendarCard: document.getElementById('calendarCard'),
        calendarGrid: document.getElementById('calendarGrid'),
        calendarMonth: document.getElementById('calendarMonth'),
        calendarSubtitle: document.getElementById('calendarSubtitle'),
        calendarPrev: document.getElementById('calendarPrev'),
        calendarNext: document.getElementById('calendarNext'),
        calendarToday: document.getElementById('calendarToday'),
        statTotal: document.getElementById('statTotal'),
        statTodo: document.getElementById('statTodo'),
        statProgress: document.getElementById('statProgress'),
        statDone: document.getElementById('statDone'),
        statOverdue: document.getElementById('statOverdue'),
        dialog: document.getElementById('taskDialog'),
        form: document.getElementById('taskForm'),
        dialogEyebrow: document.getElementById('taskDialogEyebrow'),
        dialogTitle: document.getElementById('taskDialogTitle'),
        saveBtn: document.getElementById('saveTaskBtn'),
        formAlert: document.getElementById('formAlert'),
        assigneeList: document.getElementById('assigneeList'),
        confirmDialog: document.getElementById('confirmDialog'),
        confirmText: document.getElementById('confirmText'),
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
        toasts: document.getElementById('toasts'),
    };

    const state = {
        tasks: [],
        counts: { total: 0, todo: 0, in_progress: 0, completed: 0, overdue: 0 },
        filter: 'all',
        search: '',
        sort: 'due',
        view: readStoredView(),
        calendarCursor: startOfMonth(new Date()),
        editingId: null,
        pendingDelete: null,
        assignees: [],
        loaded: false,
        loadError: null,
        controller: null,
        searchTimer: null,
    };

    let lastKnownDay = todayISO();

    /* ---------------------------------------------------------------- helpers */

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined && text !== null) {
            node.textContent = text;
        }

        return node;
    }

    function parseDate(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return null;
        }

        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (
            date.getFullYear() !== year
            || date.getMonth() !== month - 1
            || date.getDate() !== day
        ) {
            return null;
        }

        return date;
    }

    function toISODate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    function todayISO() {
        return toISODate(new Date());
    }

    function startOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function isValidDate(value) {
        const date = parseDate(value);

        return date !== null && toISODate(date) === value;
    }

    function initials(name) {
        const parts = String(name).trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
            return '?';
        }

        return parts
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join('')
            .toUpperCase();
    }

    function parseAssignees(value) {
        return String(value ?? '')
            .split(',')
            .map((name) => name.trim().replace(/\s+/g, ' '))
            .filter(Boolean);
    }

    function normalizeAssignees(value) {
        return parseAssignees(value).join(', ');
    }

    function paletteIndex(name) {
        let hash = 0;
        for (let index = 0; index < name.length; index += 1) {
            hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
        }

        return hash % 5;
    }

    function capitalize(value) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function describeError(error) {
        if (error instanceof TypeError) {
            return 'Could not reach the server. Make sure PHP is running.';
        }

        return error && error.message ? error.message : 'Something went wrong.';
    }

    function readStoredView() {
        try {
            return window.localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'board';
        } catch {
            return 'board';
        }
    }

    function storeView(view) {
        try {
            window.localStorage.setItem(VIEW_KEY, view);
        } catch {
            // Storage can be unavailable in private browsing; the view still works for this visit.
        }
    }

    async function api(url, options = {}) {
        const config = {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {}),
            },
        };

        if (options.body !== undefined) {
            config.headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, config);
        const raw = await response.text();
        let payload = null;

        if (raw.trim() !== '') {
            try {
                payload = JSON.parse(raw);
            } catch {
                payload = null;
            }
        }

        if (!response.ok) {
            const error = new Error(
                payload && payload.error
                    ? payload.error
                    : `Request failed with status ${response.status}.`
            );
            error.status = response.status;
            error.errors = payload && payload.errors ? payload.errors : {};
            throw error;
        }

        return payload || {};
    }

    /* --------------------------------------------------------------- rendering */

    function render() {
        renderStats();
        renderFilters();
        syncViewButtons();

        if (state.view === 'calendar') {
            ui.calendarView.hidden = false;
            ui.grid.hidden = true;
            ui.empty.hidden = true;
            renderCalendar();
        } else {
            ui.calendarView.hidden = true;
            renderTasks();
        }
    }

    function renderStats() {
        ui.statTotal.textContent = state.counts.total ?? 0;
        ui.statTodo.textContent = state.counts.todo ?? 0;
        ui.statProgress.textContent = state.counts.in_progress ?? 0;
        ui.statDone.textContent = state.counts.completed ?? 0;
        ui.statOverdue.textContent = state.counts.overdue ?? 0;
    }

    function renderFilters() {
        ui.filters.querySelectorAll('[data-count]').forEach((node) => {
            const key = node.dataset.count;
            node.textContent = state.counts[key] ?? 0;
        });
        syncFilterChips();
    }

    function syncFilterChips() {
        ui.filters.querySelectorAll('[data-status]').forEach((chip) => {
            const selected = chip.dataset.status === state.filter;
            chip.setAttribute('aria-pressed', String(selected));
        });
    }

    function syncViewButtons() {
        ui.viewBoardBtn.setAttribute('aria-pressed', String(state.view === 'board'));
        ui.viewCalendarBtn.setAttribute('aria-pressed', String(state.view === 'calendar'));
    }

    function setView(view) {
        const next = view === 'calendar' ? 'calendar' : 'board';
        if (state.view === next) {
            return;
        }

        state.view = next;
        storeView(next);
        render();
    }

    function renderTasks() {
        ui.calendarView.hidden = true;
        ui.grid.innerHTML = '';
        ui.grid.setAttribute('aria-busy', 'false');

        if (state.loadError) {
            showEmpty('Could not load tasks', 'Try again', () => loadTasks());
            return;
        }

        if (state.tasks.length === 0) {
            if (!state.loaded) {
                return;
            }

            if (state.search !== '' || state.filter !== 'all') {
                showEmpty('No matching tasks', 'Clear filters', clearFilters);
            } else {
                showEmpty('No tasks yet', 'New task', openCreate);
            }
            return;
        }

        hideEmpty();

        const fragment = document.createDocumentFragment();
        state.tasks.forEach((task) => {
            fragment.append(taskCard(task));
        });
        ui.grid.append(fragment);
    }

    function showSkeleton() {
        ui.calendarView.hidden = true;
        ui.empty.hidden = true;
        ui.grid.hidden = false;
        ui.grid.innerHTML = '';
        ui.grid.setAttribute('aria-busy', 'true');

        for (let index = 0; index < 3; index += 1) {
            const block = el('div', 'skeleton');
            block.setAttribute('aria-hidden', 'true');
            ui.grid.append(block);
        }
    }

    function showEmpty(title, actionLabel, action) {
        ui.empty.hidden = false;
        ui.grid.hidden = true;
        ui.emptyTitle.textContent = title;
        ui.emptyAction.textContent = actionLabel;
        ui.emptyAction.onclick = action || openCreate;
    }

    function hideEmpty() {
        ui.empty.hidden = true;
        ui.grid.hidden = false;
    }

    /* --------------------------------------------------------------- calendar */

    function calendarTaskChip(task) {
        const chip = el('button', `calendar-task calendar-task--${task.status}`);
        chip.type = 'button';
        chip.dataset.taskId = task.id;
        chip.title = `${task.title} · ${STATUS_LABELS[task.status]}`;
        chip.setAttribute('aria-label', `Edit “${task.title}” (${STATUS_LABELS[task.status]})`);
        chip.append(
            el('span', 'calendar-task__dot'),
            el('span', 'calendar-task__title', task.title)
        );

        return chip;
    }

    function renderCalendar() {
        const cursor = state.calendarCursor;
        const year = cursor.getFullYear();
        const month = cursor.getMonth();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = toISODate(today);

        const firstOfMonth = new Date(year, month, 1);
        const startOffset = firstOfMonth.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

        ui.calendarView.hidden = false;
        ui.grid.hidden = true;
        ui.empty.hidden = true;

        ui.calendarMonth.textContent = new Intl.DateTimeFormat(undefined, {
            month: 'long',
            year: 'numeric',
        }).format(firstOfMonth);

        const tasksByDate = new Map();
        state.tasks.forEach((task) => {
            const due = parseDate(task.due_date);
            if (!due) {
                return;
            }

            const key = toISODate(due);
            if (!tasksByDate.has(key)) {
                tasksByDate.set(key, []);
            }
            tasksByDate.get(key).push(task);
        });

        let monthCount = 0;
        state.tasks.forEach((task) => {
            const due = parseDate(task.due_date);
            if (due && due.getFullYear() === year && due.getMonth() === month) {
                monthCount += 1;
            }
        });

        const hasFilter = state.filter !== 'all' || state.search !== '';
        if (!state.loaded) {
            ui.calendarSubtitle.textContent = 'Loading tasks...';
        } else if (state.loadError) {
            ui.calendarSubtitle.textContent = 'Could not load tasks.';
        } else if (monthCount === 0) {
            ui.calendarSubtitle.textContent = hasFilter
                ? 'No matching tasks this month'
                : 'No tasks due this month';
        } else {
            ui.calendarSubtitle.textContent = `${monthCount} task${monthCount === 1 ? '' : 's'} ${hasFilter ? 'matching filters' : 'due'} this month`;
        }

        const dayFormatter = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });

        const fragment = document.createDocumentFragment();

        for (let index = 0; index < totalCells; index += 1) {
            const date = new Date(year, month, 1 - startOffset + index);
            const key = toISODate(date);
            const dayTasks = tasksByDate.get(key) || [];

            const cell = el('div', 'calendar-day');
            cell.setAttribute('role', 'group');
            if (date.getMonth() !== month) {
                cell.classList.add('is-outside');
            }
            if (key === todayKey) {
                cell.classList.add('is-today');
                cell.setAttribute('aria-current', 'date');
            }
            cell.setAttribute(
                'aria-label',
                `${dayFormatter.format(date)}${dayTasks.length > 0 ? `, ${dayTasks.length} task${dayTasks.length === 1 ? '' : 's'}` : ''}`
            );

            const number = el('span', 'calendar-day__num', String(date.getDate()));
            const list = el('div', 'calendar-day__tasks');

            dayTasks.slice(0, 3).forEach((task) => {
                list.append(calendarTaskChip(task));
            });

            if (dayTasks.length > 3) {
                const more = el('span', 'calendar-more', `+${dayTasks.length - 3} more`);
                more.title = dayTasks.slice(3).map((task) => task.title).join('\n');
                list.append(more);
            }

            cell.append(number, list);
            fragment.append(cell);
        }

        ui.calendarGrid.innerHTML = '';
        ui.calendarGrid.append(fragment);
    }

    function shiftCalendarMonth(offset) {
        state.calendarCursor = new Date(
            state.calendarCursor.getFullYear(),
            state.calendarCursor.getMonth() + offset,
            1
        );
        renderCalendar();
    }

    function taskCard(task) {
        const card = el('article', `task-card task-card--${task.status}`);
        card.dataset.id = task.id;

        const head = el('div', 'task-card__head');
        const badge = el('span', `badge badge--${task.priority}`, `${capitalize(task.priority)} priority`);

        const actions = el('div', 'card-actions');
        const editButton = iconButton('edit', `Edit “${task.title}”`, 'pencil');
        const deleteButton = iconButton('delete', `Delete “${task.title}”`, 'trash');
        deleteButton.classList.add('icon-btn--danger');
        actions.append(editButton, deleteButton);
        head.append(badge, actions);

        const title = el('h3', 'task-card__title', task.title);
        const description = el(
            'p',
            `task-card__desc${task.description ? '' : ' is-muted'}`,
            task.description || 'No description provided.'
        );

        const meta = el('div', 'task-card__meta');
        meta.append(assigneeChips(task.assignee), dueChip(task));

        const foot = el('div', 'task-card__foot');
        foot.append(statusControl(task));

        card.append(head, title, description, meta, foot);

        return card;
    }

    function iconButton(action, label, icon) {
        const button = el('button', 'icon-btn');
        button.type = 'button';
        button.dataset.action = action;
        button.setAttribute('aria-label', label);
        button.title = label;
        button.innerHTML = ICONS[icon];

        return button;
    }

    function assigneeChips(value) {
        const fragment = document.createDocumentFragment();
        const names = parseAssignees(value);
        if (names.length === 0) {
            names.push('Unassigned');
        }

        names.forEach((name) => {
            const chip = el('span', 'assignee');
            chip.title = name;
            chip.append(
                el('span', `avatar avatar--${paletteIndex(name)}`, initials(name)),
                el('span', 'assignee__name', name)
            );
            fragment.append(chip);
        });

        return fragment;
    }

    function dueChip(task) {
        const due = parseDate(task.due_date);
        if (!due) {
            return el('span', 'due', 'No due date');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const diff = Math.round((dueDay - today) / 86400000);

        const dateLabel = new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            ...(due.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
        }).format(due);

        let text = dateLabel;
        let tone = '';

        if (task.status !== 'completed') {
            if (diff < 0) {
                tone = 'overdue';
                text = `${dateLabel} · ${Math.abs(diff)}d overdue`;
            } else if (diff === 0) {
                tone = 'today';
                text = `${dateLabel} · Due today`;
            } else if (diff === 1) {
                tone = 'soon';
                text = `${dateLabel} · Due tomorrow`;
            }
        }

        const chip = el('span', `due${tone ? ` due--${tone}` : ''}`);
        chip.title = `Due ${dateLabel}`;
        chip.innerHTML = ICONS.calendar;
        chip.append(el('span', '', text));

        return chip;
    }

    function statusControl(task) {
        const wrapper = el('div', 'status-control');
        wrapper.setAttribute('role', 'group');
        wrapper.setAttribute('aria-label', `Status for “${task.title}”`);

        STATUS_VALUES.forEach((value) => {
            const active = value === task.status;
            const button = el('button', `status-btn status-btn--${value}`);
            button.type = 'button';
            button.dataset.status = value;
            button.setAttribute('aria-pressed', String(active));
            button.title = `Mark as ${STATUS_LABELS[value]}`;
            button.append(
                el('span', 'status-dot'),
                el('span', 'status-btn__label', STATUS_LABELS[value])
            );
            wrapper.append(button);
        });

        return wrapper;
    }

    /* ------------------------------------------------------------------- data */

    async function loadTasks(options = {}) {
        const quiet = Boolean(options.quiet) && state.loaded;

        if (state.controller) {
            state.controller.abort();
        }
        const controller = new AbortController();
        state.controller = controller;

        if (quiet) {
            ui.grid.classList.add('is-refreshing');
            ui.calendarCard.classList.add('is-refreshing');
        } else {
            state.loadError = null;
            if (state.view === 'calendar') {
                ui.calendarView.hidden = false;
                ui.calendarCard.classList.add('is-refreshing');
            } else {
                showSkeleton();
            }
        }

        const params = new URLSearchParams();
        if (state.filter !== 'all') {
            params.set('status', state.filter);
        }
        if (state.search !== '') {
            params.set('search', state.search);
        }
        params.set('sort', state.sort);

        try {
            const data = await api(`${API_URL}?${params.toString()}`, { signal: controller.signal });
            state.tasks = Array.isArray(data.tasks) ? data.tasks : [];
            state.counts = data.counts || state.counts;
            state.loadError = null;
            state.loaded = true;
            mergeAssignees(state.tasks);
            render();
        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }

            const message = describeError(error);
            if (quiet && state.tasks.length > 0) {
                toast(message, 'error');
                return;
            }

            state.loadError = message;
            state.tasks = [];
            state.loaded = true;
            render();
        } finally {
            if (state.controller === controller) {
                state.controller = null;
                ui.grid.classList.remove('is-refreshing');
                ui.calendarCard.classList.remove('is-refreshing');
            }
        }
    }

    function mergeAssignees(tasks) {
        const names = new Set(state.assignees);
        tasks.forEach((task) => {
            parseAssignees(task.assignee).forEach((name) => names.add(name));
        });

        state.assignees = [...names].sort((a, b) => a.localeCompare(b));
        ui.assigneeList.innerHTML = '';
        state.assignees.forEach((name) => {
            const option = document.createElement('option');
            option.value = name;
            ui.assigneeList.append(option);
        });
    }

    async function updateStatus(task, nextStatus, control) {
        if (nextStatus === task.status) {
            return;
        }

        control.querySelectorAll('button').forEach((button) => {
            button.disabled = true;
        });
        control.classList.add('is-busy');

        try {
            const data = await api(`${API_URL}?id=${encodeURIComponent(task.id)}`, {
                method: 'PATCH',
                body: JSON.stringify({ status: nextStatus }),
            });
            task.status = data.task.status;
            await loadTasks({ quiet: true });
            const updatedCard = [...ui.grid.querySelectorAll('.task-card')]
                .find((card) => card.dataset.id === task.id);
            const activeButton = updatedCard
                ? updatedCard.querySelector(`.status-btn[data-status="${task.status}"]`)
                : null;
            if (activeButton) {
                activeButton.focus({ preventScroll: true });
            }
            toast(data.message || `Status updated to ${STATUS_LABELS[nextStatus]}.`);
        } catch (error) {
            toast(describeError(error), 'error');
        } finally {
            control.querySelectorAll('button').forEach((button) => {
                button.disabled = false;
            });
            control.classList.remove('is-busy');
        }
    }

    /* ------------------------------------------------------------ dialog form */

    function readForm() {
        const form = ui.form.elements;

        return {
            title: form.title.value.trim(),
            assignee: normalizeAssignees(form.assignee.value),
            due_date: form.due_date.value,
            priority: form.priority.value,
            status: form.status.value,
            description: form.description.value.trim(),
        };
    }

    function validateTask(values, isNew) {
        const errors = {};

        if (values.title === '') {
            errors.title = 'Task title is required.';
        } else if (values.title.length < 3) {
            errors.title = 'Use at least 3 characters.';
        } else if (values.title.length > 120) {
            errors.title = 'Keep the title under 120 characters.';
        }

        const assignees = parseAssignees(values.assignee);
        if (assignees.length === 0) {
            errors.assignee = 'Assign this task to at least one person.';
        } else if (values.assignee.length > ASSIGNEE_MAX) {
            errors.assignee = `Keep the assignee list under ${ASSIGNEE_MAX} characters.`;
        } else if (assignees.some((name) => name.length < ASSIGNEE_NAME_MIN)) {
            errors.assignee = `Each name needs at least ${ASSIGNEE_NAME_MIN} characters.`;
        } else if (assignees.some((name) => name.length > ASSIGNEE_NAME_MAX)) {
            errors.assignee = `Keep each name under ${ASSIGNEE_NAME_MAX} characters.`;
        } else if (assignees.some((name) => !NAME_PATTERN.test(name))) {
            errors.assignee = 'Use letters, spaces, apostrophes, hyphens, or periods for each name.';
        }

        if (values.due_date === '') {
            errors.due_date = 'Set a due date.';
        } else if (!isValidDate(values.due_date)) {
            errors.due_date = 'Enter a valid date.';
        } else if (isNew && values.due_date < todayISO()) {
            errors.due_date = 'Due date cannot be in the past.';
        }

        if (!PRIORITY_VALUES.includes(values.priority)) {
            errors.priority = 'Choose a valid priority.';
        }

        if (!STATUS_VALUES.includes(values.status)) {
            errors.status = 'Choose a valid status.';
        }

        if (values.description.length > 700) {
            errors.description = 'Keep the description under 700 characters.';
        }

        return errors;
    }

    function clearFieldErrors() {
        ui.form.querySelectorAll('.field.is-invalid').forEach((field) => {
            field.classList.remove('is-invalid');
        });
        ui.form.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
            input.removeAttribute('aria-invalid');
        });
        ui.form.querySelectorAll('.field-error').forEach((node) => {
            node.textContent = '';
        });
        ui.formAlert.hidden = true;
        ui.formAlert.textContent = '';
    }

    function showFieldErrors(errors) {
        let firstInvalid = null;

        Object.entries(errors).forEach(([field, message]) => {
            let input = ui.form.elements[field];
            if (input && typeof input.closest !== 'function') {
                input = input[0];
            }
            const wrapper = input ? input.closest('.field') : null;
            if (!input || !wrapper) {
                return;
            }

            wrapper.classList.add('is-invalid');
            wrapper.querySelectorAll('input, select, textarea').forEach((control) => {
                control.setAttribute('aria-invalid', 'true');
            });
            const messageNode = wrapper.querySelector('.field-error');
            if (messageNode) {
                messageNode.textContent = message;
            }
            if (!firstInvalid) {
                firstInvalid = input;
            }
        });

        if (firstInvalid) {
            firstInvalid.focus();
        }
    }

    function showFormAlert(message) {
        ui.formAlert.textContent = message;
        ui.formAlert.hidden = false;
    }

    function openCreate() {
        state.editingId = null;
        ui.form.reset();
        clearFieldErrors();

        ui.dialogEyebrow.textContent = 'Create a task';
        ui.dialogTitle.textContent = 'New task';
        ui.saveBtn.textContent = 'Create task';
        ui.form.elements.due_date.min = todayISO();

        ui.dialog.showModal();
        window.setTimeout(() => ui.form.elements.title.focus(), 40);
    }

    function openEdit(task) {
        state.editingId = task.id;
        ui.form.reset();
        clearFieldErrors();

        const form = ui.form.elements;
        form.title.value = task.title;
        form.assignee.value = task.assignee;
        form.due_date.value = task.due_date;
        form.priority.value = task.priority;
        form.status.value = task.status;
        form.description.value = task.description;

        ui.dialogEyebrow.textContent = 'Edit task';
        ui.dialogTitle.textContent = 'Update task';
        ui.saveBtn.textContent = 'Save changes';
        ui.form.elements.due_date.min = '';

        ui.dialog.showModal();
        window.setTimeout(() => {
            form.title.focus();
            form.title.select();
        }, 40);
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearFieldErrors();

        const values = readForm();
        const isNew = state.editingId === null;
        const errors = validateTask(values, isNew);

        if (Object.keys(errors).length > 0) {
            showFieldErrors(errors);
            return;
        }

        const originalLabel = ui.saveBtn.textContent;
        ui.saveBtn.disabled = true;
        ui.saveBtn.textContent = 'Saving...';

        try {
            const url = isNew
                ? API_URL
                : `${API_URL}?id=${encodeURIComponent(state.editingId)}`;
            const data = await api(url, {
                method: isNew ? 'POST' : 'PUT',
                body: JSON.stringify(values),
            });

            ui.dialog.close();

            if (isNew) {
                state.filter = 'all';
                state.search = '';
                ui.search.value = '';
                syncFilterChips();

                if (state.view === 'calendar') {
                    const due = parseDate(data.task ? data.task.due_date : '');
                    if (due) {
                        state.calendarCursor = startOfMonth(due);
                    }
                }
            }

            await loadTasks({ quiet: true });
            toast(data.message || (isNew ? 'Task created.' : 'Task updated.'));
        } catch (error) {
            if (error.errors && Object.keys(error.errors).length > 0) {
                showFieldErrors(error.errors);
            }
            showFormAlert(describeError(error));
            toast(describeError(error), 'error');
        } finally {
            ui.saveBtn.disabled = false;
            ui.saveBtn.textContent = originalLabel;
        }
    }

    /* ----------------------------------------------------------------- delete */

    function openDelete(task) {
        state.pendingDelete = task;
        ui.confirmText.textContent = `“${task.title}” will be permanently removed. This action can’t be undone.`;
        ui.confirmDialog.showModal();
    }

    async function deleteTask() {
        if (!state.pendingDelete) {
            return;
        }

        ui.confirmDeleteBtn.disabled = true;

        try {
            const data = await api(
                `${API_URL}?id=${encodeURIComponent(state.pendingDelete.id)}`,
                { method: 'DELETE' }
            );
            ui.confirmDialog.close();
            await loadTasks({ quiet: true });
            toast(data.message || 'Task deleted.');
        } catch (error) {
            ui.confirmDeleteBtn.disabled = false;
            toast(describeError(error), 'error');
        }
    }

    /* ---------------------------------------------------------------- toasts */

    function toast(message, type = 'success') {
        if (!ui.toasts) {
            return;
        }

        const node = el('div', `toast toast--${type}`);
        node.append(
            el('span', 'toast__icon', type === 'error' ? '!' : '✓'),
            el('span', 'toast__text', message)
        );
        ui.toasts.append(node);

        requestAnimationFrame(() => node.classList.add('is-visible'));

        let removed = false;
        const remove = () => {
            if (removed) {
                return;
            }
            removed = true;
            node.classList.remove('is-visible');
            window.setTimeout(() => node.remove(), 250);
        };

        window.setTimeout(remove, 3600);
    }

    /* ---------------------------------------------------------------- events */

    function clearFilters() {
        window.clearTimeout(state.searchTimer);
        state.filter = 'all';
        state.search = '';
        ui.search.value = '';
        syncFilterChips();
        loadTasks({ quiet: true });
    }

    function bindEvents() {
        ui.newTaskBtn.addEventListener('click', openCreate);
        ui.form.addEventListener('submit', handleSubmit);

        ui.grid.addEventListener('click', (event) => {
            const card = event.target.closest('.task-card');
            if (!card) {
                return;
            }

            const task = state.tasks.find((item) => item.id === card.dataset.id);
            if (!task) {
                return;
            }

            const statusButton = event.target.closest('.status-btn');
            if (statusButton) {
                const control = statusButton.closest('.status-control');
                if (control) {
                    updateStatus(task, statusButton.dataset.status, control);
                }
                return;
            }

            const button = event.target.closest('button[data-action]');
            if (!button) {
                return;
            }

            if (button.dataset.action === 'edit') {
                openEdit(task);
            } else if (button.dataset.action === 'delete') {
                openDelete(task);
            }
        });

        ui.filters.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-status]');
            if (!chip) {
                return;
            }

            const status = chip.dataset.status;
            if (status === state.filter) {
                return;
            }

            state.filter = status;
            syncFilterChips();
            window.clearTimeout(state.searchTimer);
            loadTasks({ quiet: state.loaded });
        });

        ui.search.addEventListener('input', () => {
            state.search = ui.search.value.trim();
            window.clearTimeout(state.searchTimer);
            state.searchTimer = window.setTimeout(() => {
                loadTasks({ quiet: state.loaded });
            }, 250);
        });

        ui.sort.addEventListener('change', () => {
            state.sort = ui.sort.value;
            loadTasks({ quiet: state.loaded });
        });

        ui.viewBoardBtn.addEventListener('click', () => setView('board'));
        ui.viewCalendarBtn.addEventListener('click', () => setView('calendar'));

        ui.calendarPrev.addEventListener('click', () => shiftCalendarMonth(-1));
        ui.calendarNext.addEventListener('click', () => shiftCalendarMonth(1));
        ui.calendarToday.addEventListener('click', () => {
            state.calendarCursor = startOfMonth(new Date());
            renderCalendar();
        });

        ui.calendarGrid.addEventListener('click', (event) => {
            const chip = event.target.closest('[data-task-id]');
            if (!chip) {
                return;
            }

            const task = state.tasks.find((item) => item.id === chip.dataset.taskId);
            if (task) {
                openEdit(task);
            }
        });

        ui.form.addEventListener('input', (event) => {
            const field = event.target.closest('.field');
            if (!field) {
                return;
            }

            field.classList.remove('is-invalid');
            field.querySelectorAll('[aria-invalid="true"]').forEach((node) => {
                node.removeAttribute('aria-invalid');
            });
            const message = field.querySelector('.field-error');
            if (message) {
                message.textContent = '';
            }
        });

        ui.form.addEventListener('change', (event) => {
            const field = event.target.closest('.field');
            if (!field) {
                return;
            }

            field.classList.remove('is-invalid');
            field.querySelectorAll('[aria-invalid="true"]').forEach((node) => {
                node.removeAttribute('aria-invalid');
            });
            const message = field.querySelector('.field-error');
            if (message) {
                message.textContent = '';
            }
        });

        ui.confirmDeleteBtn.addEventListener('click', deleteTask);

        ui.confirmDialog.addEventListener('close', () => {
            state.pendingDelete = null;
            ui.confirmDeleteBtn.disabled = false;
        });

        document.querySelectorAll('[data-close-dialog]').forEach((button) => {
            button.addEventListener('click', () => {
                const dialog = button.closest('dialog');
                if (dialog) {
                    dialog.close();
                }
            });
        });

        [ui.dialog, ui.confirmDialog].forEach((dialog) => {
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) {
                    dialog.close();
                }
            });
        });
    }

    function renderTodayLabel() {
        ui.today.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        }).format(new Date());
    }

    function refreshIfDayChanged() {
        const now = new Date();
        const current = toISODate(now);
        if (current === lastKnownDay) {
            return;
        }

        const previous = parseDate(lastKnownDay);
        lastKnownDay = current;
        renderTodayLabel();

        if (state.view === 'calendar') {
            const wasShowingCurrentMonth = previous
                && state.calendarCursor.getFullYear() === previous.getFullYear()
                && state.calendarCursor.getMonth() === previous.getMonth();

            if (wasShowingCurrentMonth) {
                state.calendarCursor = startOfMonth(now);
            }

            renderCalendar();
        } else if (state.loaded) {
            loadTasks({ quiet: true });
        }
    }

    function init() {
        bindEvents();
        syncViewButtons();

        if (state.view === 'calendar') {
            ui.calendarView.hidden = false;
            ui.grid.hidden = true;
            ui.empty.hidden = true;
            renderCalendar();
        }

        renderTodayLabel();

        window.setInterval(refreshIfDayChanged, 60 * 1000);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                refreshIfDayChanged();
            }
        });
        window.addEventListener('focus', refreshIfDayChanged);

        loadTasks();
    }

    init();
})();
